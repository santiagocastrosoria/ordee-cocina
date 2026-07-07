import { NextRequest, NextResponse } from "next/server";
import { jsonError, safeClientDbMessage } from "@/lib/api/http";
import { requireStaffAuth } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireStaffAuth(request, "orders:read");
  if (!auth.ok) return auth.response;

  const { ctx } = auth;

  const { data, error } = await ctx.admin
    .from("orders")
    .select("id, customer_name, table_number, notes, status, payment_status, payment_method, total_ars, created_at, order_items(item_name, quantity, unit_price_ars)")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return jsonError("No se pudieron cargar pedidos", 500, safeClientDbMessage("[staff/orders GET]", error));
  }

  return NextResponse.json({
    orders: data ?? [],
    restaurantId: ctx.restaurant.id
  });
}
