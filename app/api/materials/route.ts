import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, materials, materialVersions } from "@/db/schema";
import { requireCourseAccess, requireOwner } from "@/lib/server/auth";
import { jsonError, safeJson, ApiError } from "@/lib/server/http";
import {
  removeFileFromKnowledge,
  uploadFileToKnowledge,
} from "@/lib/server/openai";
import { runtimeEnv } from "@/lib/server/runtime";

const allowedTypes = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);
const maxBytes = 20 * 1024 * 1024;

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 54) || "material"
  );
}

export async function GET() {
  try {
    const user = await requireCourseAccess();
    const db = getDb();
    const publicFields = {
      id: materials.id,
      title: materials.title,
      category: materials.category,
      language: materials.language,
      visibility: materials.visibility,
      lifecycle: materials.lifecycle,
      updatedAt: materials.updatedAt,
    };
    const rows =
      user.role === "owner"
        ? await db
            .select(publicFields)
            .from(materials)
            .orderBy(desc(materials.updatedAt))
        : await db
            .select(publicFields)
            .from(materials)
            .where(
              and(
                eq(materials.visibility, "members"),
                eq(materials.lifecycle, "ready"),
              ),
            )
            .orderBy(desc(materials.publishedAt));
    return Response.json(
      { materials: rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ApiError(
        422,
        "Выберите DOCX, PDF, TXT или Markdown файл",
        "file_required",
      );
    if (!allowedTypes.has(file.type))
      throw new ApiError(
        415,
        "Этот формат пока не поддерживается",
        "unsupported_file_type",
      );
    if (file.size > maxBytes)
      throw new ApiError(
        413,
        "Максимальный размер файла — 20 МБ",
        "file_too_large",
      );

    const title = String(form.get("title") || file.name.replace(/\.[^.]+$/, ""))
      .trim()
      .slice(0, 160);
    const category = String(form.get("category") || "course")
      .trim()
      .slice(0, 48);
    const language = String(form.get("language") || "RU")
      .trim()
      .slice(0, 16);
    const visibility =
      form.get("visibility") === "members"
        ? ("members" as const)
        : ("owner" as const);
    const materialId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const bytes = await file.arrayBuffer();
    const hash = await sha256(bytes);
    const r2Key = `materials/${materialId}/${versionId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const now = Date.now();
    await runtimeEnv().MATERIALS.put(r2Key, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: { sha256: hash, materialId, versionId },
    });

    const db = getDb();
    await db.batch([
      db
        .insert(materials)
        .values({
          id: materialId,
          slug: `${slugify(title)}-${materialId.slice(0, 8)}`,
          title,
          category,
          language,
          visibility,
          lifecycle: visibility === "owner" ? "ready" : "processing",
          currentVersionId: versionId,
          publishedAt: visibility === "members" ? now : null,
          createdBy: owner.id,
          createdAt: now,
          updatedAt: now,
        }),
      db
        .insert(materialVersions)
        .values({
          id: versionId,
          materialId,
          versionNo: 1,
          originalFilename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          sha256: hash,
          rawR2Key: r2Key,
          extractionStatus: "stored",
          createdBy: owner.id,
          createdAt: now,
        }),
      db
        .insert(auditEvents)
        .values({
          id: crypto.randomUUID(),
          actorUserId: owner.id,
          action: "material.uploaded",
          entityType: "material",
          entityId: materialId,
          metadataJson: safeJson({
            category,
            language,
            visibility,
            sizeBytes: file.size,
            sha256: hash,
          }),
          createdAt: now,
        }),
    ]);

    let indexing: { configured: boolean; status: string } = {
      configured: Boolean(runtimeEnv().OPENAI_API_KEY),
      status: visibility === "owner" ? "not_published" : "stored",
    };
    if (visibility === "members" && runtimeEnv().OPENAI_API_KEY) {
      try {
        const indexed = await uploadFileToKnowledge(
          new File([bytes], file.name, { type: file.type }),
          owner.id,
        );
        const ready = indexed.status === "completed";
        await db.batch([
          db
            .update(materialVersions)
            .set({
              extractionStatus: ready ? "ready" : "processing",
              openaiFileId: indexed.fileId,
              openaiVectorFileId: indexed.vectorStoreFileId ?? null,
              indexedAt: ready ? Date.now() : null,
            })
            .where(eq(materialVersions.id, versionId)),
          db
            .update(materials)
            .set({
              lifecycle: ready ? "ready" : "processing",
              updatedAt: Date.now(),
            })
            .where(eq(materials.id, materialId)),
        ]);
        indexing = { configured: true, status: ready ? "ready" : "processing" };
      } catch (error) {
        const message =
          error instanceof ApiError ? error.code : "indexing_error";
        await db.batch([
          db
            .update(materialVersions)
            .set({ extractionStatus: "failed", errorMessage: message })
            .where(eq(materialVersions.id, versionId)),
          db
            .update(materials)
            .set({ lifecycle: "failed", updatedAt: Date.now() })
            .where(eq(materials.id, materialId)),
        ]);
        indexing = { configured: true, status: "failed" };
      }
    }

    return Response.json(
      {
        material: { id: materialId, title, category, language, visibility },
        indexing,
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

export async function DELETE(request: Request) {
  try {
    const owner = await requireOwner();
    const materialId = new URL(request.url).searchParams.get("materialId");
    if (!materialId)
      throw new ApiError(422, "Не указан материал", "validation_error");
    const db = getDb();
    const [row] = await db
      .select({ material: materials, version: materialVersions })
      .from(materials)
      .innerJoin(
        materialVersions,
        eq(materials.currentVersionId, materialVersions.id),
      )
      .where(eq(materials.id, materialId))
      .limit(1);
    if (!row) throw new ApiError(404, "Материал не найден", "not_found");
    if (row.version.openaiFileId || row.version.openaiVectorFileId) {
      await removeFileFromKnowledge(
        row.version.openaiFileId,
        row.version.openaiVectorFileId,
      );
    }
    const now = Date.now();
    await db.batch([
      db
        .update(materials)
        .set({ lifecycle: "archived", visibility: "owner", updatedAt: now })
        .where(eq(materials.id, materialId)),
      db
        .insert(auditEvents)
        .values({
          id: crypto.randomUUID(),
          actorUserId: owner.id,
          action: "material.archived",
          entityType: "material",
          entityId: materialId,
          metadataJson: "{}",
          createdAt: now,
        }),
    ]);
    return Response.json(
      { archived: true },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
