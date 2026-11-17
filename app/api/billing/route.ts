import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { memberships } from "@/db/schema";
import { hasCourseAccess, requireAppUser } from "@/lib/server/auth";
import { ApiError, jsonError } from "@/lib/server/http";
import { runtimeEnv } from "@/lib/server/runtime";

export async function GET() {
  try {
    const user = await requireAppUser();
    const [membership] = await getDb()
      .select()
      .from(memberships)
      .where(eq(memberships.userId, user.id))
      .orderBy(desc(memberships.createdAt))
      .limit(1);
    return Response.json(
      {
        hasAccess: await hasCourseAccess(user),
        membership: membership
          ? {
              status: membership.status,
              startsAt: membership.startsAt,
              endsAt: membership.endsAt,
              source: membership.source,
            }
          : null,
        provider: runtimeEnv().PAYMENT_PROVIDER ?? "freedompay",
        checkoutConfigured: Boolean(runtimeEnv().PAYMENT_CHECKOUT_URL),
        productionReady: false,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST() {
  try {
    const user = await requireAppUser();
    void user;
    throw new ApiError(
      503,
      "Оплата откроется после договора Freedom Pay и подключения проверенного серверного webhook.",
      "payments_not_configured",
    );
  } catch (error) {
    return jsonError(error);
  }
}
