import { NextRequest, NextResponse } from "next/server";
import { ensureRestaurantBySlug, getDefaultRestaurantSlug } from "@/lib/restaurant-demo";
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

  const supabase = createSupabaseAdmin();
  const slug = getDefaultRestaurantSlug();
  const ensured = await ensureRestaurantBySlug(supabase, slug);
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.message }, { status: 500 });
  }

  const { error } = await supabase.from("orders").delete().eq("restaurant_id", ensured.id).eq("status", "entregado");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
