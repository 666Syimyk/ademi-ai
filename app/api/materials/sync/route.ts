import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { materials, materialVersions } from "@/db/schema";
import { requireOwner } from "@/lib/server/auth";
import { ApiError, jsonError } from "@/lib/server/http";
import {
  getKnowledgeFileStatus,
  uploadFileToKnowledge,
} from "@/lib/server/openai";
import { runtimeEnv } from "@/lib/server/runtime";

export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    const { materialId } = (await request.json()) as { materialId?: string };
    if (!materialId)
      throw new ApiError(422, "materialId обязателен", "validation_error");
    const db = getDb();
    const [row] = await db
      .select({ material: materials, version: materialVersions })
      .from(materials)
      .innerJoin(
        materialVersions,
        eq(materials.currentVersionId, materialVersions.id),
      )
      .where(
        and(eq(materials.id, materialId), eq(materials.visibility, "members")),
      )
      .limit(1);
    if (!row)
      throw new ApiError(
        404,
        "Материал не найден или не опубликован ученикам",
        "not_found",
      );
    let indexed = {
      fileId: row.version.openaiFileId ?? undefined,
      vectorStoreFileId: row.version.openaiVectorFileId ?? undefined,
      status: undefined as string | undefined,
    };
    if (row.version.openaiVectorFileId) {
      indexed.status = await getKnowledgeFileStatus(
        row.version.openaiVectorFileId,
      );
    } else {
      const object = await runtimeEnv().MATERIALS.get(row.version.rawR2Key);
      if (!object)
        throw new ApiError(404, "Исходный файл не найден", "blob_not_found");
      const bytes = await object.arrayBuffer();
      indexed = await uploadFileToKnowledge(
        new File([bytes], row.version.originalFilename, {
          type: row.version.mimeType,
        }),
        owner.id,
      );
    }
    const ready = indexed.status === "completed";
    const failed =
      indexed.status === "failed" || indexed.status === "cancelled";
    await db.batch([
      db
        .update(materialVersions)
        .set({
          extractionStatus: ready ? "ready" : failed ? "failed" : "processing",
          errorMessage: failed ? "vector_index_failed" : null,
          openaiFileId: indexed.fileId ?? null,
          openaiVectorFileId: indexed.vectorStoreFileId ?? null,
          indexedAt: ready ? Date.now() : null,
        })
        .where(eq(materialVersions.id, row.version.id)),
      db
        .update(materials)
        .set({
          lifecycle: ready ? "ready" : failed ? "failed" : "processing",
          publishedAt: row.material.publishedAt ?? Date.now(),
          updatedAt: Date.now(),
        })
        .where(eq(materials.id, materialId)),
    ]);
    return Response.json(
      { status: ready ? "ready" : failed ? "failed" : "processing" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
