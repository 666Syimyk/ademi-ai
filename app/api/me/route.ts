import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { memberships, users } from "@/db/schema";
import {
  generativeProvider,
  preferredGenerativeProvider,
} from "@/lib/server/ai";
import { getAppUser, hasCourseAccess, requireAppUser } from "@/lib/server/auth";
import { ApiError, jsonError } from "@/lib/server/http";
import { runtimeEnv } from "@/lib/server/runtime";

export const CONSENT_VERSION = "2026-08-14";

const supportedLanguages = new Set(["RU", "KG", "EN"]);

function normalizeFullName(value: unknown) {
  if (typeof value !== "string" || /[\p{Cc}\p{Cf}]/u.test(value)) {
    throw new ApiError(422, "Укажите корректное имя", "invalid_full_name");
  }
  const fullName = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  const length = Array.from(fullName).length;
  if (length < 2 || length > 80 || !/\p{L}/u.test(fullName)) {
    throw new ApiError(
      422,
      "Имя должно содержать от 2 до 80 символов",
      "invalid_full_name",
    );
  }
  return fullName;
}

function avatarUrlFor(user: typeof users.$inferSelect) {
  return user.avatarR2Key
    ? `/api/me/avatar?v=${user.avatarUpdatedAt ?? user.updatedAt}`
    : null;
}

export async function GET() {
  try {
    const user = await getAppUser();
    if (!user)
      return Response.json(
        { authenticated: false },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    const db = getDb();
    const [membership] = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .orderBy(desc(memberships.createdAt))
      .limit(1);
    const aiProviderPreference = preferredGenerativeProvider();
    const aiProvider = await generativeProvider();
    const externalModel = Boolean(aiProvider);
    return Response.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
          preferredLanguage: user.preferredLanguage,
          historyEnabled: user.historyEnabled,
          profileCompletedAt: user.profileCompletedAt,
          avatarUrl: avatarUrlFor(user),
        },
        hasAccess: await hasCourseAccess(user),
        consentRequired: user.consentVersion !== CONSENT_VERSION,
        membership: membership
          ? {
              status: membership.status,
              endsAt: membership.endsAt,
              source: membership.source,
            }
          : null,
        services: {
          ai: true,
          answerMode: externalModel ? "generative" : "guided",
          externalModel,
          aiProvider,
          aiProviderPreference,
          localAudio: runtimeEnv().ADEMI_LOCAL_DEV_AUTH === "true",
          payments: false,
          checkoutPrepared: Boolean(runtimeEnv().PAYMENT_CHECKOUT_URL),
          provider: runtimeEnv().PAYMENT_PROVIDER ?? "freedompay",
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAppUser();
    let payload: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
        throw new Error("invalid payload");
      payload = parsed as Record<string, unknown>;
    } catch {
      throw new ApiError(400, "Некорректный запрос", "invalid_json");
    }
    const now = Date.now();
    const update: Partial<typeof users.$inferInsert> = {
      updatedAt: now,
    };
    if (Object.hasOwn(payload, "fullName")) {
      update.fullName = normalizeFullName(payload.fullName);
    }
    if (Object.hasOwn(payload, "preferredLanguage")) {
      if (
        typeof payload.preferredLanguage !== "string" ||
        !supportedLanguages.has(payload.preferredLanguage)
      )
        throw new ApiError(422, "Неизвестный язык", "validation_error");
      update.preferredLanguage = payload.preferredLanguage as
        | "RU"
        | "KG"
        | "EN";
    }
    if (Object.hasOwn(payload, "historyEnabled")) {
      if (typeof payload.historyEnabled !== "boolean")
        throw new ApiError(422, "Некорректная настройка истории", "validation_error");
      update.historyEnabled = payload.historyEnabled;
    }
    if (Object.hasOwn(payload, "acceptConsent")) {
      if (payload.acceptConsent !== true)
        throw new ApiError(422, "Необходимо подтвердить согласие", "validation_error");
      update.consentVersion = CONSENT_VERSION;
      update.consentAt = now;
    }
    if (Object.hasOwn(payload, "profileCompletedAt")) {
      if (
        typeof payload.profileCompletedAt !== "number" ||
        !Number.isFinite(payload.profileCompletedAt) ||
        payload.profileCompletedAt <= 0
      ) {
        throw new ApiError(422, "Некорректное завершение профиля", "validation_error");
      }
      const effectiveName = update.fullName ?? user.fullName;
      if (!effectiveName) {
        throw new ApiError(422, "Сначала укажите имя", "full_name_required");
      }
      // Never trust a client-provided timestamp. Presence of a valid positive
      // value is the completion signal; the durable time is always server time.
      update.profileCompletedAt = user.profileCompletedAt ?? now;
    }
    const [saved] = await getDb()
      .update(users)
      .set(update)
      .where(eq(users.id, user.id))
      .returning();
    return Response.json(
      {
        user: {
          id: saved.id,
          email: saved.email,
          fullName: saved.fullName,
          role: saved.role,
          preferredLanguage: saved.preferredLanguage,
          historyEnabled: saved.historyEnabled,
          consentVersion: saved.consentVersion,
          profileCompletedAt: saved.profileCompletedAt,
          avatarUrl: avatarUrlFor(saved),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
