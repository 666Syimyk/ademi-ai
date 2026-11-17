import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getDb } from "@/db";
import { memberships, users } from "@/db/schema";
import { ApiError } from "./http";
import { runtimeEnv } from "./runtime";

export type AppUser = typeof users.$inferSelect;

export async function getAppUser(): Promise<AppUser | null> {
  const identity = await getChatGPTUser();
  if (!identity) return null;

  const db = getDb();
  const email = identity.email.trim().toLowerCase();
  const ownerEmail = runtimeEnv().ADEMI_OWNER_EMAIL?.trim().toLowerCase();
  const [byAuth] = await db
    .select()
    .from(users)
    .where(eq(users.authUserId, identity.userId))
    .limit(1);
  const [byEmail] = byAuth
    ? []
    : await db.select().from(users).where(eq(users.email, email)).limit(1);
  const now = Date.now();
  const isOwner = Boolean(ownerEmail && ownerEmail === email);

  if (byAuth) {
    const [updated] = await db
      .update(users)
      .set({
        email,
        // Once onboarding is complete, the profile name belongs to the user.
        // Before that, the identity-provider name is a useful initial value.
        fullName: byAuth.profileCompletedAt
          ? byAuth.fullName
          : (identity.fullName ?? byAuth.fullName),
        lastSeenAt: now,
        updatedAt: now,
        role: isOwner ? ("owner" as const) : ("student" as const),
        ...(isOwner ? { accountStatus: "active" as const } : {}),
      })
      .where(eq(users.id, byAuth.id))
      .returning();
    return updated;
  }

  if (byEmail) {
    if (byEmail.authUserId && byEmail.authUserId !== identity.userId) {
      throw new ApiError(
        409,
        "Этот email уже связан с другим аккаунтом",
        "identity_conflict",
      );
    }
    const [claimed] = await db
      .update(users)
      .set({
        authUserId: identity.userId,
        fullName: byEmail.profileCompletedAt
          ? byEmail.fullName
          : (identity.fullName ?? byEmail.fullName),
        lastSeenAt: now,
        updatedAt: now,
        role: isOwner ? ("owner" as const) : ("student" as const),
        ...(isOwner ? { accountStatus: "active" as const } : {}),
      })
      .where(and(eq(users.id, byEmail.id), isNull(users.authUserId)))
      .returning();
    if (!claimed)
      throw new ApiError(
        409,
        "Приглашение уже было использовано",
        "invite_claimed",
      );
    return claimed;
  }

  const [created] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      authUserId: identity.userId,
      email,
      fullName: identity.fullName,
      role: isOwner ? "owner" : "student",
      accountStatus: "active",
      lastSeenAt: now,
    })
    .returning();
  return created;
}

export async function requireAppUser() {
  const user = await getAppUser();
  if (!user)
    throw new ApiError(
      401,
      "Войдите, чтобы продолжить",
      "authentication_required",
    );
  if (user.accountStatus === "suspended")
    throw new ApiError(403, "Аккаунт приостановлен", "account_suspended");
  return user;
}

export async function requireOwner() {
  const user = await requireAppUser();
  const ownerEmail = runtimeEnv().ADEMI_OWNER_EMAIL?.trim().toLowerCase();
  if (!ownerEmail || user.role !== "owner" || user.email !== ownerEmail) {
    throw new ApiError(403, "Доступно только автору курса", "owner_required");
  }
  return user;
}

export async function hasCourseAccess(user: AppUser) {
  if (user.accountStatus === "suspended") return false;
  const ownerEmail = runtimeEnv().ADEMI_OWNER_EMAIL?.trim().toLowerCase();
  if (user.role === "owner" && ownerEmail && user.email === ownerEmail)
    return true;
  const now = Date.now();
  const db = getDb();
  const [membership] = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, user.id),
        inArray(memberships.status, ["active", "trialing", "comped"]),
        lte(memberships.startsAt, now),
        or(isNull(memberships.endsAt), gt(memberships.endsAt, now)),
      ),
    )
    .limit(1);
  return Boolean(membership);
}

export async function requireCourseAccess() {
  const user = await requireAppUser();
  if (!(await hasCourseAccess(user)))
    throw new ApiError(
      403,
      "Для доступа требуется активная оплата курса",
      "subscription_required",
    );
  return user;
}
