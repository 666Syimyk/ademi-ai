import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { materials, materialVersions } from "@/db/schema";
import { requireCourseAccess } from "@/lib/server/auth";
import { ApiError, jsonError } from "@/lib/server/http";
import { runtimeEnv } from "@/lib/server/runtime";

export async function GET(request: Request) {
  try {
    const user = await requireCourseAccess();
    const materialId = new URL(request.url).searchParams.get("materialId");
    if (!materialId)
      throw new ApiError(422, "Не указан материал", "validation_error");
    const [row] = await getDb()
      .select({ material: materials, version: materialVersions })
      .from(materials)
      .innerJoin(
        materialVersions,
        eq(materials.currentVersionId, materialVersions.id),
      )
      .where(eq(materials.id, materialId))
      .limit(1);
    if (!row) throw new ApiError(404, "Материал не найден", "not_found");
    if (
      user.role !== "owner" &&
      (row.material.visibility !== "members" ||
        row.material.lifecycle !== "ready")
    ) {
      throw new ApiError(404, "Материал не найден", "not_found");
    }
    const object = await runtimeEnv().MATERIALS.get(row.version.rawR2Key);
    if (!object?.body)
      throw new ApiError(404, "Файл не найден", "blob_not_found");
    const filename = row.version.originalFilename.replace(/["\r\n]/g, "_");
    return new Response(object.body, {
      headers: {
        "Content-Type": row.version.mimeType,
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
