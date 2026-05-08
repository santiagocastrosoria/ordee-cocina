import { NextRequest, NextResponse } from "next/server";
import { ensureRestaurantBySlug, getDefaultRestaurantSlug } from "@/lib/restaurant-demo";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type OrderRow = {
  id: string;
  total_ars: number;
  payment_status: string;
  payment_method: string;
  created_at: string;
  table_number: string | null;
};

type OrderItemRow = {
  order_id: string;
  item_name: string;
  quantity: number;
};

export async function GET(request: NextRequest) {
  const restaurantSlug = request.nextUrl.searchParams.get("restaurant") ?? getDefaultRestaurantSlug();
  const supabase = createSupabaseAdmin();

  const ensured = await ensureRestaurantBySlug(supabase, restaurantSlug);
  if (!ensured.ok) {
    console.error("[ORDEE-COCINA staff/metrics] ensure:", ensured.message);
    return NextResponse.json({ error: ensured.message }, { status: 500 });
  }
  const restaurant = { id: ensured.id };

  const { data: orders } = await supabase
    .from("orders")
    .select("id,total_ars,payment_status,payment_method,created_at,table_number")
    .eq("restaurant_id", restaurant.id);

  const { data: orderItems } = await supabase
    .from("order_items")
    .select("order_id,item_name,quantity")
    .in("order_id", (orders ?? []).map((row) => row.id));

  const rows = (orders ?? []) as OrderRow[];
  const itemRows = (orderItems ?? []) as OrderItemRow[];

  const now = new Date();
  const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startDay);
  startWeek.setDate(startWeek.getDate() - 7);
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const inRange = (date: string, start: Date) => new Date(date) >= start;

  const dayOrders = rows.filter((row) => inRange(row.created_at, startDay));
  const weekOrders = rows.filter((row) => inRange(row.created_at, startWeek));
  const monthOrders = rows.filter((row) => inRange(row.created_at, startMonth));

  const sum = (arr: OrderRow[]) => arr.reduce((acc, row) => acc + row.total_ars, 0);
  const avgTicket = rows.length ? Math.round(sum(rows) / rows.length) : 0;

  const paymentMethods = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.payment_method] = (acc[row.payment_method] ?? 0) + 1;
    return acc;
  }, {});

  const itemsSold = itemRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.item_name] = (acc[row.item_name] ?? 0) + row.quantity;
    return acc;
  }, {});

  const topProducts = Object.entries(itemsSold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, qty]) => ({ name, qty }));

  const peakHoursMap = rows.reduce<Record<string, number>>((acc, row) => {
    const hour = new Date(row.created_at).getHours();
    const key = `${hour.toString().padStart(2, "0")}:00`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const peakHours = Object.entries(peakHoursMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([hour, ordersCount]) => ({ hour, ordersCount }));

  const topTablesMap = rows.reduce<Record<string, number>>((acc, row) => {
    if (!row.table_number) return acc;
    acc[row.table_number] = (acc[row.table_number] ?? 0) + row.total_ars;
    return acc;
  }, {});

  const topTables = Object.entries(topTablesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([table, amount]) => ({ table, amount }));

  return NextResponse.json({
    dailyRevenue: sum(dayOrders),
    weeklyRevenue: sum(weekOrders),
    monthlyRevenue: sum(monthOrders),
    ordersCount: rows.length,
    avgTicket,
    paymentMethods,
    paidToday: dayOrders.filter((row) => row.payment_status === "pagado").length,
    pendingToday: dayOrders.filter((row) => row.payment_status !== "pagado").length,
    topProducts,
    peakHours,
    topTables
  });
}
