import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, memberships, plans, users } from "@/db/schema";
import { requireOwner } from "@/lib/server/auth";
import { ApiError, jsonError, safeJson } from "@/lib/server/http";

async function ensureManualPlan() {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(plans)
    .where(eq(plans.code, "course_pro"))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(plans)
    .values({
      id: crypto.randomUUID(),
      code: "course_pro",
      name: "ADEMI Course Pro",
      priceMinor: 0,
      currency: "KGS",
      durationDays: 30,
    })
    .returning();
  return created;
}

export async function GET() {
  try {
    await requireOwner();
    const db = getDb();
    const members = await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
    const access = await db
      .select()
      .from(memberships)
      .orderBy(desc(memberships.createdAt));
    return Response.json(
      {
        members: members.map((member) => ({
          id: member.id,
          email: member.email,
          fullName: member.fullName,
          role: member.role,
          accountStatus: member.accountStatus,
          memberships: access
            .filter((row) => row.userId === member.id)
            .map((row) => ({
              id: row.id,
              status: row.status,
              startsAt: row.startsAt,
              endsAt: row.endsAt,
              source: row.source,
            })),
        })),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    const payload = (await request.json()) as {
      email?: string;
      fullName?: string;
      accessDays?: number;
    };
    const email = payload.email?.trim().toLowerCase() ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new ApiError(422, "Введите корректный email", "validation_error");
    const accessDays = Math.min(
      3650,
      Math.max(1, Math.floor(payload.accessDays ?? 30)),
    );
    const db = getDb();
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const user =
      existing ??
      (
        await db
          .insert(users)
          .values({
            id: crypto.randomUUID(),
            email,
            fullName: payload.fullName?.trim().slice(0, 120) || null,
            role: "student",
            accountStatus: "active",
          })
          .returning()
      )[0];
    const plan = await ensureManualPlan();
    const now = Date.now();
    const endsAt = now + accessDays * 24 * 60 * 60 * 1000;
    const membershipId = crypto.randomUUID();
    await db.batch([
      db
        .insert(memberships)
        .values({
          id: membershipId,
          userId: user.id,
          planId: plan.id,
          status: "comped",
          source: "manual",
          startsAt: now,
          endsAt,
          grantedByUserId: owner.id,
          createdAt: now,
          updatedAt: now,
        }),
      db
        .insert(auditEvents)
        .values({
          id: crypto.randomUUID(),
          actorUserId: owner.id,
          action: "membership.granted",
          entityType: "membership",
          entityId: membershipId,
          metadataJson: safeJson({ userId: user.id, accessDays }),
          createdAt: now,
        }),
    ]);
    return Response.json(
      {
        member: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          accessUntil: endsAt,
        },
      },
      {
        status: 201,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const owner = await requireOwner();
    const payload = (await request.json()) as {
      userId?: string;
      accountStatus?: "active" | "suspended";
      membershipId?: string;
      revoke?: boolean;
    };
    const db = getDb();
    const now = Date.now();
    if (payload.userId && payload.accountStatus) {
      const [target] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
      if (!target || target.role === "owner")
        throw new ApiError(404, "Ученик не найден", "not_found");
      await db
        .update(users)
        .set({ accountStatus: payload.accountStatus, updatedAt: now })
        .where(eq(users.id, target.id));
      await db
        .insert(auditEvents)
        .values({
          id: crypto.randomUUID(),
          actorUserId: owner.id,
          action: `user.${payload.accountStatus}`,
          entityType: "user",
          entityId: target.id,
          metadataJson: "{}",
          createdAt: now,
        });
      return Response.json(
        { status: payload.accountStatus },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (payload.membershipId && payload.revoke) {
      await db
        .update(memberships)
        .set({ status: "cancelled", endsAt: now, updatedAt: now })
        .where(eq(memberships.id, payload.membershipId));
      await db
        .insert(auditEvents)
        .values({
          id: crypto.randomUUID(),
          actorUserId: owner.id,
          action: "membership.revoked",
          entityType: "membership",
          entityId: payload.membershipId,
          metadataJson: "{}",
          createdAt: now,
        });
      return Response.json(
        { status: "cancelled" },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    throw new ApiError(422, "Не указано действие", "validation_error");
  } catch (error) {
    return jsonError(error);
  }
}
