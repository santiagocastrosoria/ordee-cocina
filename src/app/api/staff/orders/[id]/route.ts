import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, safeClientDbMessage } from "@/lib/api/http";
import { isUuid, sanitizeText } from "@/lib/api/sanitize";
import { requireStaffAuth } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

const ORDER_STATUSES = new Set(["nuevo", "preparando", "listo", "entregado", "cancelado"]);
const PAYMENT_STATUSES = new Set(["pendiente", "pagado", "fallido"]);

interface Body {
  status?: string;
  paymentStatus?: string;
  cancelReason?: string;
}

async function assertOrderBelongsToRestaurant(client: SupabaseClient, orderId: string, restaurantId: string) {
  const { data, error } = await client.from("orders").select("id,restaurant_id").eq("id", orderId).maybeSingle();
  if (error || !data || data.restaurant_id !== restaurantId) return false;
  return true;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) {
    return jsonError("Pedido no encontrado", 404);
  }

  const auth = await requireStaffAuth(request, "orders:write");
  if (!auth.ok) return auth.response;

  const { ctx } = auth;

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const belongs = await assertOrderBelongsToRestaurant(ctx.admin, params.id, ctx.restaurant.id);
  if (!belongs) {
    return jsonError("Pedido no encontrado", 404);
  }

  const update: Record<string, string> = {};

  if (body.status !== undefined) {
    if (!ORDER_STATUSES.has(body.status)) {
      return jsonError("Estado invalido", 400);
    }
    update.status = body.status;
  }

  if (body.paymentStatus !== undefined) {
    if (!PAYMENT_STATUSES.has(body.paymentStatus)) {
      return jsonError("Estado de pago invalido", 400);
    }
    update.payment_status = body.paymentStatus;
  }

  if (body.cancelReason) {
    const reason = sanitizeText(body.cancelReason, 300);
    if (reason) update.notes = `CANCELADO: ${reason}`;
  }

  if (Object.keys(update).length === 0) {
    return jsonError("Nada que actualizar", 400);
  }

  const { error } = await ctx.admin
    .from("orders")
    .update(update)
    .eq("id", params.id)
    .eq("restaurant_id", ctx.restaurant.id);

  if (error) {
    return jsonError("No se pudo actualizar pedido", 500, safeClientDbMessage("[staff/orders PATCH]", error));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) {
    return jsonError("Pedido no encontrado", 404);
  }

  const auth = await requireStaffAuth(request, "orders:delete");
  if (!auth.ok) return auth.response;

  const { ctx } = auth;

  const belongs = await assertOrderBelongsToRestaurant(ctx.admin, params.id, ctx.restaurant.id);
  if (!belongs) {
    return jsonError("Pedido no encontrado", 404);
  }

  const { error } = await ctx.admin.from("orders").delete().eq("id", params.id).eq("restaurant_id", ctx.restaurant.id);

  if (error) {
    return jsonError("No se pudo eliminar el pedido", 500, safeClientDbMessage("[staff/orders DELETE]", error));
  }

  return NextResponse.json({ ok: true });
}
