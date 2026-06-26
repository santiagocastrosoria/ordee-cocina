import { NextRequest, NextResponse } from "next/server";
import { resolveRestaurantBySlug, resolveRestaurantFromRequest } from "@/lib/resolve-restaurant";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

interface Body {
  action: "create" | "update" | "delete";
  id?: string;
  table_number?: string;
  status?: "libre" | "ocupada" | "esperando_pedido" | "comiendo" | "cobrando" | "cerrada";
}

export async function GET(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get("restaurant");
  if (!slug) {
    return NextResponse.json({ error: "Falta restaurant" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const restaurant = await resolveRestaurantBySlug(slug);
  if (!restaurant) return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });

  const { data } = await supabase
    .from("restaurant_tables")
    .select("id,table_number,status,qr_token,created_at")
    .eq("restaurant_id", restaurant.id)
    .order("table_number", { ascending: true });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  const supabase = createSupabaseAdmin();
  const restaurant = await resolveRestaurantFromRequest(request);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurante no encontrado" }, { status: 404 });
  }

  if (body.action === "create") {
    if (!body.table_number) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    const qrToken = `mesa-${body.table_number}`;
    const { error } = await supabase.from("restaurant_tables").insert({
      restaurant_id: restaurant.id,
      table_number: body.table_number,
      status: "libre",
      qr_token: qrToken
    });

    if (error) return NextResponse.json({ error: "No se pudo crear mesa" }, { status: 500 });
  }

  if (body.action === "update") {
    if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    const { data: existing } = await supabase
      .from("restaurant_tables")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (!existing || existing.restaurant_id !== restaurant.id) {
      return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
    }

    const patch: Record<string, string> = {};
    if (body.table_number) patch.table_number = body.table_number;
    if (body.status) patch.status = body.status;

    const { error } = await supabase.from("restaurant_tables").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: "No se pudo actualizar mesa" }, { status: 500 });
  }

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    const { data: existing } = await supabase
      .from("restaurant_tables")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (!existing || existing.restaurant_id !== restaurant.id) {
      return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
    }

    const { error } = await supabase.from("restaurant_tables").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: "No se pudo eliminar mesa" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
