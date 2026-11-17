import { and, desc, eq, inArray } from "drizzle-orm";
import {
  contentPrinciples,
  findAuthors,
  isContentQuestion,
  researchAuthors,
} from "@/app/knowledge";
import { getDb } from "@/db";
import {
  conversations,
  crisisEvents,
  messageSources,
  messages,
} from "@/db/schema";
import {
  createGenerativeResponse,
  generativeProvider,
} from "@/lib/server/ai";
import { getAppUser } from "@/lib/server/auth";
import {
  courseProgramMetadata,
  courseProgramText,
  matchesCourseProgramIntent,
} from "@/lib/server/course-program";
import { createGuidedPsychologyResponse } from "@/lib/server/guided-psychology";
import { ApiError, jsonError, safeJson } from "@/lib/server/http";
import { isOllamaResponseFailure } from "@/lib/server/ollama";
import { moderateText } from "@/lib/server/openai";
import { normalizePsychologyLanguage } from "@/lib/server/psychology-protocol";
import {
  consumeModerationQuota,
  releaseChatQuota,
  reserveChatQuota,
} from "@/lib/server/rate-limit";
import {
  assessSafety,
  crisisResponse,
  shouldRepeatCrisisGuidance,
  type Language,
  urgentMedicalResponse,
} from "@/lib/server/safety";
import { CONSENT_VERSION } from "../me/route";

function courseSourceLabel(language: Language) {
  if (language === "KG") return courseProgramMetadata.sourceTitle;
  if (language === "EN")
    return 'Ademi “Quantum Leap” course program (author-provided material)';
  return 'Программа курса Ademi «КВАНТОВЫЙ СКАЧОК» (авторский материал)';
}

function safetyJson(
  text: string,
  conversationId: string | null,
  language: Language,
) {
  return Response.json(
    {
      text,
      safetyLevel: "crisis",
      sources: [],
      conversationId,
      configured: true,
      externalModel: false,
      aiProvider: null,
      answerMode: "guided",
      language,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const user = await getAppUser();
    if (!user)
      throw new ApiError(
        401,
        "Войдите, чтобы продолжить",
        "authentication_required",
      );
    const payload = (await request.json().catch(() => {
      throw new ApiError(400, "Некорректный JSON", "invalid_json");
    })) as {
      message?: string;
      language?: Language;
      conversationId?: string;
      clientRequestId?: string;
      sessionContext?: unknown;
    };
    const message = payload.message?.trim() ?? "";
    const language: Language = normalizePsychologyLanguage(
      payload.language,
      user.preferredLanguage,
    );
    const sessionUserContext = Array.isArray(payload.sessionContext)
      ? payload.sessionContext
          .slice(-1)
          .filter((value): value is string => typeof value === "string")
          .map((content) => content.slice(0, 4000).trim())
          .filter(Boolean)
      : [];
    if (!message)
      throw new ApiError(
        422,
        "Сообщение должно содержать от 1 до 4000 символов",
        "validation_error",
      );
    const localSafety = assessSafety(message);
    if (localSafety.level === "crisis") {
      return safetyJson(crisisResponse(language), null, language);
    }
    if (localSafety.category === "urgent_medical") {
      return safetyJson(urgentMedicalResponse(language), null, language);
    }
    if (
      shouldRepeatCrisisGuidance(message, sessionUserContext.at(-1))
    ) {
      return safetyJson(crisisResponse(language), null, language);
    }
    if (message.length > 4000)
      throw new ApiError(
        422,
        "Сообщение должно содержать от 1 до 4000 символов",
        "validation_error",
      );
    if (user.accountStatus === "suspended") {
      throw new ApiError(403, "Аккаунт приостановлен", "account_suspended");
    }
    if (user.consentVersion !== CONSENT_VERSION)
      throw new ApiError(
        428,
        "Перед началом подтвердите правила безопасного использования",
        "consent_required",
      );
    const clientRequestId =
      payload.clientRequestId?.slice(0, 100) || crypto.randomUUID();
    const db = getDb();
    let conversationId = payload.conversationId;
    let assistantMessageId: string | null = null;
    let priorMessages: Array<{ role: "user" | "assistant"; content: string }> =
      [];

    if (conversationId) {
      const [conversation] = await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, user.id),
          ),
        )
        .limit(1);
      if (!conversation)
        throw new ApiError(404, "Диалог не найден", "not_found");
      const [duplicate] = await db
        .select()
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.clientRequestId, clientRequestId),
          ),
        )
        .limit(1);
      if (duplicate)
        throw new ApiError(
          409,
          "Этот запрос уже обработан",
          "duplicate_request",
        );
      if (user.historyEnabled) {
        const rows = await db
          .select({ role: messages.role, content: messages.content })
          .from(messages)
          .where(eq(messages.conversationId, conversationId))
          .orderBy(desc(messages.ordinal))
          .limit(10);
        priorMessages = rows.reverse().map((row) => ({
          role: row.role,
          content: row.content.slice(0, 2500),
        }));
      }
    }

    if (priorMessages.length === 0) {
      priorMessages = sessionUserContext.map((content) => ({
        role: "user" as const,
        content,
      }));
    } else {
      const latestPersistedUser = priorMessages
        .filter((turn) => turn.role === "user")
        .at(-1)?.content;
      if (
        sessionUserContext.length === 0 &&
        shouldRepeatCrisisGuidance(message, latestPersistedUser)
      ) {
        return safetyJson(
          crisisResponse(language),
          conversationId ?? null,
          language,
        );
      }
    }

    let provider = await generativeProvider();
    const hasLiveModel = Boolean(provider);
    // Reserve before any provider call so requests above the allowance never
    // reach a metered cloud model or start an expensive local generation.
    const chatQuota = await reserveChatQuota(user.id);
    let answer:
      | {
          text: string;
          sources: Array<{ filename: string; fileId: string | null }>;
          model: string | undefined;
          responseId: string | undefined;
          answerMode: "generative";
        }
      | ReturnType<typeof createGuidedPsychologyResponse>;
    let matchedCourseProgram = false;
    try {
      let moderation = { flagged: false, categories: [] as string[] };
      if (provider === "openai") {
        await consumeModerationQuota(user.id);
        moderation = await moderateText(message);
      }
      const moderationCrisis =
        moderation?.categories.some(
          (category) =>
            category.startsWith("self-harm") || category === "violence",
        ) ?? false;
      if (moderationCrisis) {
        const text = crisisResponse(language);
        await db
          .insert(crisisEvents)
          .values({
            id: crypto.randomUUID(),
            userId: user.id,
            conversationId: conversationId ?? null,
            severity: "crisis",
            category: moderation?.categories.join(",") ?? "moderation",
            action: "emergency_guidance_shown",
            locale: language,
            messageFingerprint: null,
          })
          .catch(() => undefined);
        await releaseChatQuota(chatQuota).catch(() => undefined);
        return safetyJson(text, conversationId ?? null, language);
      }

      const courseContextInput = [
        message,
        ...priorMessages
          .filter((turn) => turn.role === "user")
          .slice(-2)
          .map((turn) => turn.content),
      ].join("\n");
      matchedCourseProgram = matchesCourseProgramIntent(courseContextInput);

      const contentQuestion =
        hasLiveModel && user.role === "owner" && isContentQuestion(message);
      const matchedAuthors =
        contentQuestion ? findAuthors(message) : [];
      const ownerReference =
        contentQuestion
          ? safeJson({
              source: "ADEMI_20_psychologists_full_analysis.docx",
              principles: contentPrinciples,
              authors:
                matchedAuthors.length > 0 ? matchedAuthors : researchAuthors,
            })
          : undefined;
      const sourceLabel = courseSourceLabel(language);
      answer = provider
        ? {
            ...(await createGenerativeResponse(provider, message, language, {
              audience: user.role === "owner" ? "owner" : "student",
              history: priorMessages,
              courseReference: matchedCourseProgram
                ? { label: sourceLabel, text: courseProgramText }
                : undefined,
              ownerReference,
            })),
            answerMode: "generative" as const,
          }
        : createGuidedPsychologyResponse(message, language, {
            audience: user.role === "owner" ? "owner" : "student",
            history: priorMessages,
            courseMatched: matchedCourseProgram,
            safetyLevel:
              localSafety.level === "sensitive" ? "sensitive" : "standard",
          });
    } catch (error) {
      if (provider === "ollama" && isOllamaResponseFailure(error)) {
        provider = null;
        answer = createGuidedPsychologyResponse(message, language, {
          audience: user.role === "owner" ? "owner" : "student",
          history: priorMessages,
          courseMatched: matchedCourseProgram,
          safetyLevel:
            localSafety.level === "sensitive" ? "sensitive" : "standard",
        });
      } else {
      // A provider/moderation failure did not deliver an answer, so give the
      // reserved allowance back before surfacing the recoverable error.
        await releaseChatQuota(chatQuota).catch(() => undefined);
        throw error;
      }
    }

    if (user.historyEnabled) {
      if (!conversationId) {
        conversationId = crypto.randomUUID();
        await db.insert(conversations).values({
          id: conversationId,
          userId: user.id,
          title: message.slice(0, 72),
          language,
          lastMessageAt: Date.now(),
        });
      }
      const userMessageId = crypto.randomUUID();
      const newAssistantMessageId = crypto.randomUUID();
      assistantMessageId = newAssistantMessageId;
      const now = Date.now();
      const [lastMessage] = await db
        .select({ ordinal: messages.ordinal })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(desc(messages.ordinal))
        .limit(1);
      const nextOrdinal = (lastMessage?.ordinal ?? 0) + 1;
      const userInsert = db.insert(messages).values({
        id: userMessageId,
        conversationId,
        ordinal: nextOrdinal,
        role: "user" as const,
        content: message,
        status: "complete" as const,
        language,
        safetyLevel: localSafety.level,
        clientRequestId,
        completedAt: now,
      });
      const assistantInsert = db.insert(messages).values({
        id: newAssistantMessageId,
        conversationId,
        ordinal: nextOrdinal + 1,
        role: "assistant" as const,
        content: answer.text,
        status: "complete" as const,
        language,
        safetyLevel: localSafety.level,
        model: answer.model ?? null,
        providerResponseId: answer.responseId ?? null,
        completedAt: now,
      });
      const conversationUpdate = db
        .update(conversations)
        .set({ lastMessageAt: now, updatedAt: now })
        .where(eq(conversations.id, conversationId));
      if (answer.sources.length > 0) {
        const sourceInsert = db.insert(messageSources).values(
          answer.sources.map((source, ordinal) => ({
            messageId: newAssistantMessageId,
            ordinal,
            fileId: source.fileId,
            label: source.filename,
            locatorJson: safeJson({ filename: source.filename }),
          })),
        );
        await db.batch([
          userInsert,
          assistantInsert,
          conversationUpdate,
          sourceInsert,
        ]);
      } else {
        await db.batch([userInsert, assistantInsert, conversationUpdate]);
      }
    }

    return Response.json({
      text: answer.text,
      safetyLevel: localSafety.level,
      sources: answer.sources,
      conversationId: conversationId ?? null,
      assistantMessageId,
      configured: true,
      externalModel: Boolean(provider),
      aiProvider: provider,
      answerMode: answer.answerMode,
      language,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await getAppUser();
    if (!user)
      throw new ApiError(
        401,
        "Войдите, чтобы продолжить",
        "authentication_required",
      );
    const db = getDb();
    const conversationId = new URL(request.url).searchParams.get(
      "conversationId",
    );
    if (conversationId) {
      const [conversation] = await db
        .select({
          id: conversations.id,
          title: conversations.title,
          language: conversations.language,
        })
        .from(conversations)
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.userId, user.id),
          ),
        )
        .limit(1);
      if (!conversation)
        throw new ApiError(404, "Диалог не найден", "not_found");
      const rows = await db
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          language: messages.language,
          safetyLevel: messages.safetyLevel,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.ordinal);
      const assistantIds = rows
        .filter((row) => row.role === "assistant")
        .map((row) => row.id);
      const savedSources =
        assistantIds.length > 0
          ? await db
              .select({
                messageId: messageSources.messageId,
                filename: messageSources.label,
                fileId: messageSources.fileId,
              })
              .from(messageSources)
              .where(inArray(messageSources.messageId, assistantIds))
              .orderBy(messageSources.messageId, messageSources.ordinal)
          : [];
      const sourcesByMessage = new Map<
        string,
        Array<{ filename: string; fileId: string | null }>
      >();
      for (const source of savedSources) {
        const current = sourcesByMessage.get(source.messageId) ?? [];
        current.push({ filename: source.filename, fileId: source.fileId });
        sourcesByMessage.set(source.messageId, current);
      }
      return Response.json(
        {
          conversation,
          messages: rows.map((row) => ({
            ...row,
            sources: sourcesByMessage.get(row.id) ?? [],
          })),
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    const rows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        language: conversations.language,
        lastMessageAt: conversations.lastMessageAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, user.id),
          eq(conversations.status, "active"),
        ),
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(30);
    return Response.json(
      { conversations: rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getAppUser();
    if (!user)
      throw new ApiError(
        401,
        "Войдите, чтобы продолжить",
        "authentication_required",
      );
    const conversationId = new URL(request.url).searchParams.get(
      "conversationId",
    );
    if (!conversationId)
      throw new ApiError(422, "Не указан диалог", "validation_error");
    const deleted = await getDb()
      .delete(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.userId, user.id),
        ),
      )
      .returning({ id: conversations.id });
    if (deleted.length === 0)
      throw new ApiError(404, "Диалог не найден", "not_found");
    return Response.json({ deleted: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
