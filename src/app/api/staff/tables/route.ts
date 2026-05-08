import { NextRequest, NextResponse } from "next/server";
import { ensureRestaurantBySlug, getDefaultRestaurantSlug } from "@/lib/restaurant-demo";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

interface Body {
  action: "create" | "update" | "delete";
  id?: string;
  table_number?: string;
  status?: "libre" | "ocupada" | "esperando_pedido" | "comiendo" | "cobrando" | "cerrada";
}

async function resolveRestaurant(supabase: ReturnType<typeof createSupabaseAdmin>) {
  const ensured = await ensureRestaurantBySlug(supabase, getDefaultRestaurantSlug());
  if (!ensured.ok) return null;
  return { id: ensured.id, created: ensured.created };
}

export async function GET() {
  const supabase = createSupabaseAdmin();
  const context = await resolveRestaurant(supabase);
  if (!context) return NextResponse.json([], { status: 200 });

  const { data } = await supabase
    .from("restaurant_tables")
    .select("id,table_number,status,qr_token,created_at")
    .eq("restaurant_id", context.id)
    .order("table_number", { ascending: true });

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Body;
  const supabase = createSupabaseAdmin();

  if (body.action === "create") {
    const ctx = await resolveRestaurant(supabase);
    if (!ctx || !body.table_number) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    const qrToken = `mesa-${body.table_number}`;
    const { error } = await supabase.from("restaurant_tables").insert({
      restaurant_id: ctx.id,
      table_number: body.table_number,
      status: "libre",
      qr_token: qrToken
    });

    if (error) return NextResponse.json({ error: "No se pudo crear mesa" }, { status: 500 });
  }

  if (body.action === "update") {
    if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    const patch: Record<string, string> = {};
    if (body.table_number) patch.table_number = body.table_number;
    if (body.status) patch.status = body.status;

    const { error } = await supabase.from("restaurant_tables").update(patch).eq("id", body.id);
    if (error) return NextResponse.json({ error: "No se pudo actualizar mesa" }, { status: 500 });
  }

  if (body.action === "delete") {
    if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", body.id);
    if (error) return NextResponse.json({ error: "No se pudo eliminar mesa" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
