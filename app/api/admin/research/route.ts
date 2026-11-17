import {
  contentPrinciples,
  researchAuthors,
  researchSource,
} from "@/app/knowledge";
import { requireOwner } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/http";

export async function GET() {
  try {
    await requireOwner();
    return Response.json(
      {
        source: researchSource,
        authors: researchAuthors,
        contentPrinciples,
      },
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
