import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";
import { ApiError } from "./http";

type RateLimitScope =
  | "chat_minute"
  | "chat_day"
  | "moderation_minute"
  | "moderation_day";

async function incrementWindow(
  userId: string,
  scope: RateLimitScope,
  windowStartedAt: number,
) {
  const [row] = await getDb()
    .insert(rateLimits)
    .values({
      userId,
      scope,
      windowStartedAt,
      requestCount: 1,
      updatedAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: [rateLimits.userId, rateLimits.scope],
      set: {
        windowStartedAt: sql`CASE WHEN ${rateLimits.windowStartedAt} < ${windowStartedAt} THEN ${windowStartedAt} ELSE ${rateLimits.windowStartedAt} END`,
        requestCount: sql`CASE WHEN ${rateLimits.windowStartedAt} < ${windowStartedAt} THEN 1 ELSE ${rateLimits.requestCount} + 1 END`,
        updatedAt: Date.now(),
      },
    })
    .returning({ count: rateLimits.requestCount });
  return row.count;
}

type ChatQuotaReservation = {
  userId: string;
  minuteStart: number;
  dayStart: number;
};

async function decrementWindow(
  userId: string,
  scope: RateLimitScope,
  windowStartedAt: number,
) {
  await getDb()
    .update(rateLimits)
    .set({
      requestCount: sql`CASE WHEN ${rateLimits.requestCount} > 0 THEN ${rateLimits.requestCount} - 1 ELSE 0 END`,
      updatedAt: Date.now(),
    })
    .where(
      and(
        eq(rateLimits.userId, userId),
        eq(rateLimits.scope, scope),
        eq(rateLimits.windowStartedAt, windowStartedAt),
      ),
    );
}

export async function consumeModerationQuota(userId: string) {
  const now = Date.now();
  const minuteStart = Math.floor(now / 60_000) * 60_000;
  const dayStart = Math.floor(now / 86_400_000) * 86_400_000;
  const minuteCount = await incrementWindow(
    userId,
    "moderation_minute",
    minuteStart,
  );
  if (minuteCount > 20) {
    await decrementWindow(userId, "moderation_minute", minuteStart);
    throw new ApiError(
      429,
      "Слишком много сообщений. Подождите минуту. Если есть непосредственный риск причинить вред себе или другому человеку, звоните 112 и не оставайтесь в одиночестве.",
      "rate_limit_exceeded",
    );
  }
  const dayCount = await incrementWindow(userId, "moderation_day", dayStart);
  if (dayCount > 300) {
    await Promise.all([
      decrementWindow(userId, "moderation_minute", minuteStart),
      decrementWindow(userId, "moderation_day", dayStart),
    ]);
    throw new ApiError(
      429,
      "Дневной лимит сообщений исчерпан. Если есть непосредственный риск причинить вред себе или другому человеку, звоните 112 и не оставайтесь в одиночестве.",
      "daily_quota_exceeded",
    );
  }
}

export async function reserveChatQuota(
  userId: string,
): Promise<ChatQuotaReservation> {
  const now = Date.now();
  const minuteStart = Math.floor(now / 60_000) * 60_000;
  const dayStart = Math.floor(now / 86_400_000) * 86_400_000;
  const reservation = { userId, minuteStart, dayStart };
  const minuteCount = await incrementWindow(userId, "chat_minute", minuteStart);
  if (minuteCount > 12) {
    await decrementWindow(userId, "chat_minute", minuteStart);
    throw new ApiError(
      429,
      "Слишком много сообщений. Подождите минуту. Если есть непосредственный риск причинить вред себе или другому человеку, звоните 112 и не оставайтесь в одиночестве.",
      "rate_limit_exceeded",
    );
  }
  const dayCount = await incrementWindow(userId, "chat_day", dayStart);
  if (dayCount > 250) {
    await Promise.all([
      decrementWindow(userId, "chat_day", dayStart),
      decrementWindow(userId, "chat_minute", minuteStart),
    ]);
    throw new ApiError(
      429,
      "Дневной лимит сообщений исчерпан. Если есть непосредственный риск причинить вред себе или другому человеку, звоните 112 и не оставайтесь в одиночестве.",
      "daily_quota_exceeded",
    );
  }
  return reservation;
}

export async function releaseChatQuota(reservation: ChatQuotaReservation) {
  await Promise.all([
    decrementWindow(
      reservation.userId,
      "chat_minute",
      reservation.minuteStart,
    ),
    decrementWindow(reservation.userId, "chat_day", reservation.dayStart),
  ]);
}

// Keep this small compatibility wrapper for callers that intentionally consume
// a completed request without needing a rollback handle.
export async function consumeChatQuota(userId: string) {
  await reserveChatQuota(userId);
}
