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
  const restaurant = await resolveRestaurantFromRequest(request);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  const body = (await request.json()) as { id: string };
  if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const supabase = createSupabaseAdmin();

  const { data: row } = await supabase
    .from("help_requests")
    .select("id,restaurant_id")
    .eq("id", body.id)
    .maybeSingle();

  if (!row || row.restaurant_id !== restaurant.id) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  const { error } = await supabase.from("help_requests").update({ status: "resuelto" }).eq("id", body.id);

  if (error) return NextResponse.json({ error: "No se pudo resolver" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
