import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  conversations,
  memberships,
  messageFeedback,
  messages,
  messageSources,
  plans,
} from "@/db/schema";
import { getAppUser } from "@/lib/server/auth";
import { ApiError, jsonError } from "@/lib/server/http";

const privateHeaders = {
  "Cache-Control": "private, no-store",
};

function toIso(value: number | null) {
  return value === null ? null : new Date(value).toISOString();
}

function publicLocator(raw: string) {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return null;

    const source = parsed as Record<string, unknown>;
    const locator: {
      filename?: string;
      page?: number;
      section?: string;
    } = {};

    if (typeof source.filename === "string")
      locator.filename = source.filename.slice(0, 255);
    if (
      typeof source.page === "number" &&
      Number.isInteger(source.page) &&
      source.page >= 0
    )
      locator.page = source.page;
    if (typeof source.section === "string")
      locator.section = source.section.slice(0, 255);

    return Object.keys(locator).length > 0 ? locator : null;
  } catch {
    return null;
  }
}

async function authenticatedUser() {
  const user = await getAppUser();
  if (!user)
    throw new ApiError(
      401,
      "Войдите, чтобы управлять своими данными",
      "authentication_required",
    );
  return user;
}

export async function GET() {
  try {
    const user = await authenticatedUser();
    const db = getDb();

    const membershipRows = await db
      .select({
        status: memberships.status,
        source: memberships.source,
        startsAt: memberships.startsAt,
        endsAt: memberships.endsAt,
        createdAt: memberships.createdAt,
        updatedAt: memberships.updatedAt,
        planCode: plans.code,
        planName: plans.name,
        planPriceMinor: plans.priceMinor,
        planCurrency: plans.currency,
        planDurationDays: plans.durationDays,
      })
      .from(memberships)
      .leftJoin(plans, eq(memberships.planId, plans.id))
      .where(eq(memberships.userId, user.id))
      .orderBy(desc(memberships.createdAt));

    const conversationRows = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        language: conversations.language,
        status: conversations.status,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(eq(conversations.userId, user.id))
      .orderBy(asc(conversations.createdAt));

    const messageRows = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        ordinal: messages.ordinal,
        role: messages.role,
        content: messages.content,
        status: messages.status,
        language: messages.language,
        safetyLevel: messages.safetyLevel,
        createdAt: messages.createdAt,
        completedAt: messages.completedAt,
      })
      .from(messages)
      .innerJoin(
        conversations,
        eq(messages.conversationId, conversations.id),
      )
      .where(eq(conversations.userId, user.id))
      .orderBy(asc(messages.createdAt), asc(messages.ordinal));

    const sourceRows = await db
      .select({
        messageId: messageSources.messageId,
        ordinal: messageSources.ordinal,
        label: messageSources.label,
        locatorJson: messageSources.locatorJson,
      })
      .from(messageSources)
      .innerJoin(messages, eq(messageSources.messageId, messages.id))
      .innerJoin(
        conversations,
        eq(messages.conversationId, conversations.id),
      )
      .where(eq(conversations.userId, user.id))
      .orderBy(asc(messageSources.ordinal));

    const feedbackRows = await db
      .select({
        category: messageFeedback.category,
        note: messageFeedback.note,
        createdAt: messageFeedback.createdAt,
      })
      .from(messageFeedback)
      .where(eq(messageFeedback.userId, user.id))
      .orderBy(asc(messageFeedback.createdAt));

    const sourcesByMessage = new Map<
      string,
      Array<{
        ordinal: number;
        label: string;
        locator: ReturnType<typeof publicLocator>;
      }>
    >();
    for (const source of sourceRows) {
      const grouped = sourcesByMessage.get(source.messageId) ?? [];
      grouped.push({
        ordinal: source.ordinal,
        label: source.label,
        locator: publicLocator(source.locatorJson),
      });
      sourcesByMessage.set(source.messageId, grouped);
    }

    const messagesByConversation = new Map<
      string,
      Array<{
        ordinal: number;
        role: "user" | "assistant";
        content: string;
        status: "pending" | "complete" | "failed" | "blocked";
        language: "RU" | "KG" | "EN";
        safetyLevel: "standard" | "sensitive" | "crisis";
        createdAt: string;
        completedAt: string | null;
        messageSources: Array<{
          ordinal: number;
          label: string;
          locator: ReturnType<typeof publicLocator>;
        }>;
      }>
    >();
    for (const message of messageRows) {
      const grouped = messagesByConversation.get(message.conversationId) ?? [];
      grouped.push({
        ordinal: message.ordinal,
        role: message.role,
        content: message.content,
        status: message.status,
        language: message.language,
        safetyLevel: message.safetyLevel,
        createdAt: toIso(message.createdAt)!,
        completedAt: toIso(message.completedAt),
        messageSources: sourcesByMessage.get(message.id) ?? [],
      });
      messagesByConversation.set(message.conversationId, grouped);
    }

    const exportedAt = new Date();
    const data = {
      exportVersion: 1,
      exportedAt: exportedAt.toISOString(),
      profile: {
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        accountStatus: user.accountStatus,
        preferredLanguage: user.preferredLanguage,
        historyEnabled: user.historyEnabled,
        profileCompletedAt: toIso(user.profileCompletedAt),
        avatarUploaded: Boolean(user.avatarR2Key),
        consent: {
          version: user.consentVersion,
          acceptedAt: toIso(user.consentAt),
        },
        lastSeenAt: toIso(user.lastSeenAt),
        createdAt: toIso(user.createdAt),
        updatedAt: toIso(user.updatedAt),
      },
      memberships: membershipRows.map((membership) => ({
        status: membership.status,
        source: membership.source,
        startsAt: toIso(membership.startsAt),
        endsAt: toIso(membership.endsAt),
        createdAt: toIso(membership.createdAt),
        updatedAt: toIso(membership.updatedAt),
        plan: membership.planCode
          ? {
              code: membership.planCode,
              name: membership.planName,
              priceMinor: membership.planPriceMinor,
              currency: membership.planCurrency,
              durationDays: membership.planDurationDays,
            }
          : null,
      })),
      conversations: conversationRows.map((conversation) => ({
        title: conversation.title,
        language: conversation.language,
        status: conversation.status,
        lastMessageAt: toIso(conversation.lastMessageAt),
        createdAt: toIso(conversation.createdAt),
        updatedAt: toIso(conversation.updatedAt),
        messages: messagesByConversation.get(conversation.id) ?? [],
      })),
      feedback: feedbackRows.map((feedback) => ({
        category: feedback.category,
        note: feedback.note,
        createdAt: toIso(feedback.createdAt),
      })),
    };

    return Response.json(data, {
      headers: {
        ...privateHeaders,
        "Content-Disposition": `attachment; filename="ademi-ai-data-${exportedAt
          .toISOString()
          .slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  try {
    const user = await authenticatedUser();
    const db = getDb();
    const ownedConversations = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.userId, user.id));
    await db.batch([
      db.delete(messageFeedback).where(eq(messageFeedback.userId, user.id)),
      db.delete(conversations).where(eq(conversations.userId, user.id)),
    ]);

    return Response.json(
      {
        deleted: true,
        deletedConversations: ownedConversations.length,
        deletedFeedback: true,
      },
      { headers: privateHeaders },
    );
  } catch (error) {
    return jsonError(error);
  }
}
