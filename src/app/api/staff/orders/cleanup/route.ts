import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, safeClientDbMessage } from "@/lib/api/http";
import { requireStaffAuth } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

/**
 * Limpia pedidos entregados para evitar acumulación infinita en el panel.
 * No toca mesas ni menú.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody<{ action?: string }>(request);
  if (!parsed.ok) return parsed.response;

  if (parsed.data.action !== "delivered") {
    return jsonError("Accion invalida", 400);
  }

  const auth = await requireStaffAuth(request, "orders:delete");
  if (!auth.ok) return auth.response;

  const { ctx } = auth;

  const { error } = await ctx.admin
    .from("orders")
    .delete()
    .eq("restaurant_id", ctx.restaurant.id)
    .eq("status", "entregado");

  if (error) {
    return jsonError("No se pudo limpiar pedidos", 500, safeClientDbMessage("[staff/orders/cleanup]", error));
  }

  return NextResponse.json({ ok: true });
}
