import { NextRequest, NextResponse } from "next/server";
import { resolveRestaurantFromRequest } from "@/lib/resolve-restaurant";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Limpia pedidos entregados para evitar acumulación infinita en el panel.
 * No toca mesas ni menú.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "delivered") {
    return NextResponse.json({ error: "Accion invalida" }, { status: 400 });
  }

  const restaurant = await resolveRestaurantFromRequest(request);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const supabase = createSupabaseAdmin();
  const { error } = await supabase
    .from("orders")
    .delete()
    .eq("restaurant_id", restaurant.id)
    .eq("status", "entregado");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
