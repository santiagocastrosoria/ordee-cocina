import { NextRequest, NextResponse } from "next/server";
import { resolveRestaurantFromRequest } from "@/lib/resolve-restaurant";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  const restaurant = await resolveRestaurantFromRequest(request);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("orders")
    .select("id, customer_name, table_number, notes, status, payment_status, payment_method, total_ars, created_at, order_items(item_name, quantity, unit_price_ars)")
    .eq("restaurant_id", restaurant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "No se pudieron cargar pedidos" }, { status: 500 });
  }

  return NextResponse.json({
    orders: data ?? [],
    restaurantId: restaurant.id
  });
}
