import { NextRequest, NextResponse } from "next/server";
import { ensureRestaurantBySlug, getDefaultRestaurantSlug } from "@/lib/restaurant-demo";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = createSupabaseAdmin();
  const slug = getDefaultRestaurantSlug();
  const ensured = await ensureRestaurantBySlug(supabase, slug);
  if (!ensured.ok) {
    console.error("[ORDEE-COCINA staff/help GET] ensure:", ensured.message);
    return NextResponse.json({ error: ensured.message }, { status: 500 });
  }
  const restaurant = { id: ensured.id };

  const { data, error } = await supabase
    .from("help_requests")
    .select("id,table_number,status,created_at")
    .eq("restaurant_id", restaurant.id)
    .eq("status", "nuevo")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: "No se pudo cargar soporte" }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as { id: string };
  if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("help_requests").update({ status: "resuelto" }).eq("id", body.id);

  if (error) return NextResponse.json({ error: "No se pudo resolver" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
