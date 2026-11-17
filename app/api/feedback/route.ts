import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  auditEvents,
  conversations,
  messageFeedback,
  messages,
} from "@/db/schema";
import { getAppUser } from "@/lib/server/auth";
import { ApiError, jsonError, safeJson } from "@/lib/server/http";

const feedbackCategories = ["inaccurate", "unsafe", "unhelpful"] as const;
type FeedbackCategory = (typeof feedbackCategories)[number];

function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return (
    typeof value === "string" &&
    feedbackCategories.includes(value as FeedbackCategory)
  );
}

export async function POST(request: Request) {
  try {
    const user = await getAppUser();
    if (!user) {
      throw new ApiError(
        401,
        "Войдите, чтобы отправить обратную связь",
        "authentication_required",
      );
    }

    const rawPayload: unknown = await request.json().catch(() => {
      throw new ApiError(400, "Некорректный JSON", "invalid_json");
    });
    if (
      !rawPayload ||
      typeof rawPayload !== "object" ||
      Array.isArray(rawPayload)
    ) {
      throw new ApiError(422, "Некорректный запрос", "validation_error");
    }
    const payload = rawPayload as {
      messageId?: unknown;
      category?: unknown;
      note?: unknown;
    };
    const messageId =
      typeof payload.messageId === "string" ? payload.messageId.trim() : "";
    if (!messageId || messageId.length > 128) {
      throw new ApiError(
        422,
        "Укажите корректный ответ",
        "validation_error",
      );
    }
    if (!isFeedbackCategory(payload.category)) {
      throw new ApiError(
        422,
        "Выберите допустимую категорию отзыва",
        "validation_error",
      );
    }
    if (
      payload.note !== undefined &&
      payload.note !== null &&
      typeof payload.note !== "string"
    ) {
      throw new ApiError(
        422,
        "Комментарий должен быть текстом",
        "validation_error",
      );
    }
    const note =
      typeof payload.note === "string" ? payload.note.trim() || null : null;
    if (note && note.length > 500) {
      throw new ApiError(
        422,
        "Комментарий не должен превышать 500 символов",
        "validation_error",
      );
    }

    const db = getDb();
    const [ownedMessage] = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
      })
      .from(messages)
      .innerJoin(
        conversations,
        eq(conversations.id, messages.conversationId),
      )
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.role, "assistant"),
          eq(conversations.userId, user.id),
        ),
      )
      .limit(1);
    if (!ownedMessage) {
      throw new ApiError(404, "Ответ не найден", "not_found");
    }

    const [existing] = await db
      .select({ id: messageFeedback.id })
      .from(messageFeedback)
      .where(
        and(
          eq(messageFeedback.userId, user.id),
          eq(messageFeedback.messageId, ownedMessage.id),
        ),
      )
      .limit(1);
    if (existing) {
      throw new ApiError(
        409,
        "Отзыв для этого ответа уже отправлен",
        "feedback_exists",
      );
    }

    const feedbackId = crypto.randomUUID();
    try {
      await db.batch([
        db.insert(messageFeedback).values({
          id: feedbackId,
          userId: user.id,
          conversationId: ownedMessage.conversationId,
          messageId: ownedMessage.id,
          category: payload.category,
          note,
        }),
        db.insert(auditEvents).values({
          id: crypto.randomUUID(),
          actorUserId: user.id,
          action: "message_feedback.created",
          entityType: "message_feedback",
          entityId: feedbackId,
          metadataJson: safeJson({
            category: payload.category,
            hasNote: Boolean(note),
            messageId: ownedMessage.id,
          }),
        }),
      ]);
    } catch (error) {
      const [concurrentDuplicate] = await db
        .select({ id: messageFeedback.id })
        .from(messageFeedback)
        .where(
          and(
            eq(messageFeedback.userId, user.id),
            eq(messageFeedback.messageId, ownedMessage.id),
          ),
        )
        .limit(1);
      if (concurrentDuplicate) {
        throw new ApiError(
          409,
          "Отзыв для этого ответа уже отправлен",
          "feedback_exists",
        );
      }
      throw error;
    }

    return Response.json(
      {
        feedback: {
          id: feedbackId,
          category: payload.category,
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
