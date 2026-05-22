import { NextRequest, NextResponse } from "next/server";
import { ensureRestaurantBySlug, getDefaultRestaurantSlug } from "@/lib/restaurant-demo";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const restaurantSlug = request.nextUrl.searchParams.get("restaurant") ?? getDefaultRestaurantSlug();
  const supabase = createSupabaseAdmin();

  const ensured = await ensureRestaurantBySlug(supabase, restaurantSlug);
  if (!ensured.ok) {
    console.error("[ORDEE-COCINA staff/orders] ensure restaurant:", ensured.message);
    return NextResponse.json({ error: ensured.message }, { status: 500 });
  }
  const restaurant = { id: ensured.id };
  if (ensured.created) {
    console.info("[ORDEE-COCINA staff/orders] restaurant creado restaurant_id=", ensured.id);
  }

  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_name, table_number, notes, status, payment_status, payment_method, total_ars, created_at, order_items(item_name, quantity, unit_price_ars)")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar pedidos" }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
