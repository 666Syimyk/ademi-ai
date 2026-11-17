import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const nowMs = sql`(unixepoch() * 1000)`;
const timestamps = {
  createdAt: integer("created_at").notNull().default(nowMs),
  updatedAt: integer("updated_at").notNull().default(nowMs),
};

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    authUserId: text("auth_user_id"),
    email: text("email").notNull(),
    fullName: text("full_name"),
    profileCompletedAt: integer("profile_completed_at"),
    avatarR2Key: text("avatar_r2_key"),
    avatarMimeType: text("avatar_mime_type", {
      enum: ["image/jpeg", "image/png", "image/webp"],
    }),
    avatarSizeBytes: integer("avatar_size_bytes"),
    avatarUpdatedAt: integer("avatar_updated_at"),
    role: text("role", { enum: ["owner", "student"] })
      .notNull()
      .default("student"),
    accountStatus: text("account_status", { enum: ["active", "suspended"] })
      .notNull()
      .default("active"),
    preferredLanguage: text("preferred_language", { enum: ["RU", "KG", "EN"] })
      .notNull()
      .default("RU"),
    historyEnabled: integer("history_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    consentVersion: text("consent_version"),
    consentAt: integer("consent_at"),
    lastSeenAt: integer("last_seen_at"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_users_auth_user_id").on(table.authUserId),
    uniqueIndex("idx_users_email").on(table.email),
    uniqueIndex("idx_users_avatar_r2_key").on(table.avatarR2Key),
    index("idx_users_role_status").on(table.role, table.accountStatus),
  ],
);

export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull().default("KGS"),
    durationDays: integer("duration_days"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex("idx_plans_code").on(table.code)],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    planId: text("plan_id").references(() => plans.id),
    status: text("status", {
      enum: [
        "pending",
        "trialing",
        "active",
        "past_due",
        "cancelled",
        "expired",
        "refunded",
        "comped",
      ],
    }).notNull(),
    source: text("source", { enum: ["manual", "payment", "import"] }).notNull(),
    provider: text("provider"),
    providerCustomerId: text("provider_customer_id"),
    providerSubscriptionId: text("provider_subscription_id"),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at"),
    grantedByUserId: text("granted_by_user_id").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    index("idx_memberships_user_status_end").on(
      table.userId,
      table.status,
      table.endsAt,
    ),
    uniqueIndex("idx_memberships_provider_subscription").on(
      table.provider,
      table.providerSubscriptionId,
    ),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    planId: text("plan_id").references(() => plans.id),
    provider: text("provider").notNull(),
    externalPaymentId: text("external_payment_id").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("KGS"),
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_payments_provider_external").on(
      table.provider,
      table.externalPaymentId,
    ),
    index("idx_payments_user_created").on(table.userId, table.createdAt),
  ],
);

export const paymentWebhookEvents = sqliteTable(
  "payment_webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    eventType: text("event_type").notNull(),
    processingStatus: text("processing_status", {
      enum: ["received", "processed", "failed"],
    })
      .notNull()
      .default("received"),
    receivedAt: integer("received_at").notNull().default(nowMs),
    processedAt: integer("processed_at"),
    errorCode: text("error_code"),
  },
  (table) => [
    uniqueIndex("idx_webhook_provider_event").on(
      table.provider,
      table.externalEventId,
    ),
  ],
);

export const materials = sqliteTable(
  "materials",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("course"),
    language: text("language").notNull().default("RU"),
    visibility: text("visibility", { enum: ["owner", "members"] })
      .notNull()
      .default("owner"),
    lifecycle: text("lifecycle", {
      enum: ["draft", "processing", "ready", "failed", "archived"],
    })
      .notNull()
      .default("draft"),
    publishedAt: integer("published_at"),
    currentVersionId: text("current_version_id"),
    createdBy: text("created_by").references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("idx_materials_slug").on(table.slug),
    index("idx_materials_visibility_lifecycle").on(
      table.visibility,
      table.lifecycle,
    ),
  ],
);

export const materialVersions = sqliteTable(
  "material_versions",
  {
    id: text("id").primaryKey(),
    materialId: text("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    versionNo: integer("version_no").notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    rawR2Key: text("raw_r2_key").notNull(),
    extractedR2Key: text("extracted_r2_key"),
    extractionStatus: text("extraction_status", {
      enum: ["stored", "processing", "ready", "failed"],
    })
      .notNull()
      .default("stored"),
    errorMessage: text("error_message"),
    openaiFileId: text("openai_file_id"),
    openaiVectorFileId: text("openai_vector_file_id"),
    indexedAt: integer("indexed_at"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (table) => [
    uniqueIndex("idx_material_versions_number").on(
      table.materialId,
      table.versionNo,
    ),
    uniqueIndex("idx_material_versions_r2_key").on(table.rawR2Key),
    index("idx_material_versions_status").on(table.extractionStatus),
  ],
);

export const conversations = sqliteTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New conversation"),
    language: text("language", { enum: ["RU", "KG", "EN"] })
      .notNull()
      .default("RU"),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    lastMessageAt: integer("last_message_at"),
    ...timestamps,
  },
  (table) => [
    index("idx_conversations_user_status_last").on(
      table.userId,
      table.status,
      table.lastMessageAt,
    ),
  ],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    status: text("status", {
      enum: ["pending", "complete", "failed", "blocked"],
    })
      .notNull()
      .default("complete"),
    language: text("language", { enum: ["RU", "KG", "EN"] }).notNull(),
    safetyLevel: text("safety_level", {
      enum: ["standard", "sensitive", "crisis"],
    })
      .notNull()
      .default("standard"),
    model: text("model"),
    providerResponseId: text("provider_response_id"),
    clientRequestId: text("client_request_id"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    createdAt: integer("created_at").notNull().default(nowMs),
    completedAt: integer("completed_at"),
  },
  (table) => [
    uniqueIndex("idx_messages_request_id").on(
      table.conversationId,
      table.clientRequestId,
    ),
    uniqueIndex("idx_messages_conversation_ordinal").on(
      table.conversationId,
      table.ordinal,
    ),
    index("idx_messages_conversation_created").on(
      table.conversationId,
      table.createdAt,
      table.id,
    ),
  ],
);

export const messageSources = sqliteTable(
  "message_sources",
  {
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    materialId: text("material_id").references(() => materials.id),
    versionId: text("version_id").references(() => materialVersions.id),
    fileId: text("file_id"),
    label: text("label").notNull(),
    locatorJson: text("locator_json").notNull().default("{}"),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.ordinal] })],
);

export const messageFeedback = sqliteTable(
  "message_feedback",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    conversationId: text("conversation_id").references(
      () => conversations.id,
      { onDelete: "set null" },
    ),
    messageId: text("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    category: text("category", {
      enum: ["inaccurate", "unsafe", "unhelpful"],
    }).notNull(),
    note: text("note"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (table) => [
    uniqueIndex("idx_message_feedback_user_message").on(
      table.userId,
      table.messageId,
    ),
    index("idx_message_feedback_created").on(table.createdAt),
  ],
);

export const crisisEvents = sqliteTable(
  "crisis_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    conversationId: text("conversation_id").references(() => conversations.id, {
      onDelete: "set null",
    }),
    messageId: text("message_id").references(() => messages.id, {
      onDelete: "set null",
    }),
    severity: text("severity").notNull(),
    category: text("category").notNull(),
    action: text("action").notNull(),
    locale: text("locale").notNull(),
    messageFingerprint: text("message_fingerprint"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (table) => [index("idx_crisis_events_created").on(table.createdAt)],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actorUserId: text("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    requestId: text("request_id"),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: integer("created_at").notNull().default(nowMs),
  },
  (table) => [
    index("idx_audit_events_created").on(table.createdAt),
    index("idx_audit_events_actor_created").on(
      table.actorUserId,
      table.createdAt,
    ),
    index("idx_audit_events_entity_created").on(
      table.entityType,
      table.entityId,
      table.createdAt,
    ),
  ],
);

export const appSettings = sqliteTable("app_settings", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedBy: text("updated_by").references(() => users.id),
  updatedAt: integer("updated_at").notNull().default(nowMs),
});

export const rateLimits = sqliteTable(
  "rate_limits",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: text("scope", {
      enum: [
        "chat_minute",
        "chat_day",
        "moderation_minute",
        "moderation_day",
      ],
    }).notNull(),
    windowStartedAt: integer("window_started_at").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: integer("updated_at").notNull().default(nowMs),
  },
  (table) => [primaryKey({ columns: [table.userId, table.scope] })],
);
