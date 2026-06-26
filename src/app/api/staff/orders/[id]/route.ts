import { NextRequest, NextResponse } from "next/server";
import { resolveRestaurantFromRequest } from "@/lib/resolve-restaurant";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

interface Body {
  status?: "nuevo" | "preparando" | "listo" | "entregado" | "cancelado";
  paymentStatus?: "pendiente" | "pagado" | "fallido";
  cancelReason?: string;
}

async function assertOrderBelongsToRestaurant(orderId: string, restaurantId: string) {
  const supabase = createSupabaseAdmin();
  const { data } = await supabase.from("orders").select("id,restaurant_id").eq("id", orderId).maybeSingle();
  if (!data || data.restaurant_id !== restaurantId) return false;
  return true;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const restaurant = await resolveRestaurantFromRequest(request);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const belongs = await assertOrderBelongsToRestaurant(params.id, restaurant.id);
  if (!belongs) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const body = (await request.json()) as Body;
  const update: Record<string, string> = {};

  if (body.status) update.status = body.status;
  if (body.paymentStatus) update.payment_status = body.paymentStatus;
  if (body.cancelReason) update.notes = `CANCELADO: ${body.cancelReason}`;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("orders").update(update).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar pedido" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const restaurant = await resolveRestaurantFromRequest(request);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const belongs = await assertOrderBelongsToRestaurant(params.id, restaurant.id);
  if (!belongs) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("orders").delete().eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "No se pudo eliminar el pedido" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
