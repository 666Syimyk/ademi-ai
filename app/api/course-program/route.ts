import { courseProgram } from "@/lib/server/course-program";
import { requireCourseAccess } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCourseAccess();
    return Response.json(
      { program: courseProgram },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
