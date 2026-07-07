import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, safeClientDbMessage } from "@/lib/api/http";
import { isUuid, sanitizeTableNumber } from "@/lib/api/sanitize";
import { requireStaffAuth } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

const TABLE_STATUSES = new Set(["libre", "ocupada", "esperando_pedido", "comiendo", "cobrando", "cerrada"]);

interface Body {
  action: "create" | "update" | "delete";
  id?: string;
  table_number?: string;
  status?: string;
}

export async function GET(request: NextRequest) {
  const auth = await requireStaffAuth(request, "tables:read");
  if (!auth.ok) return auth.response;

  const { ctx } = auth;

  const { data, error } = await ctx.admin
    .from("restaurant_tables")
    .select("id,table_number,status,qr_token,created_at")
    .eq("restaurant_id", ctx.restaurant.id)
    .order("table_number", { ascending: true });

  if (error) {
    return jsonError("No se pudieron cargar mesas", 500, safeClientDbMessage("[staff/tables GET]", error));
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const auth = await requireStaffAuth(request, "tables:write");
  if (!auth.ok) return auth.response;

  const parsed = await parseJsonBody<Body>(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const { ctx } = auth;

  if (body.action === "create") {
    const tableNumber = sanitizeTableNumber(body.table_number);
    if (!tableNumber) {
      return jsonError("Datos invalidos", 400);
    }

    const qrToken = `mesa-${tableNumber}`;
    const { error } = await ctx.admin.from("restaurant_tables").insert({
      restaurant_id: ctx.restaurant.id,
      table_number: tableNumber,
      status: "libre",
      qr_token: qrToken
    });

    if (error) return jsonError("No se pudo crear mesa", 500, safeClientDbMessage("[staff/tables create]", error));
  }

  if (body.action === "update") {
    if (!isUuid(body.id)) return jsonError("Falta id", 400);

    const { data: existing, error: fetchError } = await ctx.admin
      .from("restaurant_tables")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (fetchError || !existing || existing.restaurant_id !== ctx.restaurant.id) {
      return jsonError("Mesa no encontrada", 404);
    }

    const patch: Record<string, string> = {};
    const tableNumber = sanitizeTableNumber(body.table_number);
    if (tableNumber) patch.table_number = tableNumber;
    if (body.status) {
      if (!TABLE_STATUSES.has(body.status)) {
        return jsonError("Estado de mesa invalido", 400);
      }
      patch.status = body.status;
    }

    if (Object.keys(patch).length === 0) {
      return jsonError("Nada que actualizar", 400);
    }

    const { error } = await ctx.admin
      .from("restaurant_tables")
      .update(patch)
      .eq("id", body.id)
      .eq("restaurant_id", ctx.restaurant.id);
    if (error) return jsonError("No se pudo actualizar mesa", 500, safeClientDbMessage("[staff/tables update]", error));
  }

  if (body.action === "delete") {
    if (!isUuid(body.id)) return jsonError("Falta id", 400);

    const { data: existing, error: fetchError } = await ctx.admin
      .from("restaurant_tables")
      .select("restaurant_id")
      .eq("id", body.id)
      .maybeSingle();
    if (fetchError || !existing || existing.restaurant_id !== ctx.restaurant.id) {
      return jsonError("Mesa no encontrada", 404);
    }

    const { error } = await ctx.admin
      .from("restaurant_tables")
      .delete()
      .eq("id", body.id)
      .eq("restaurant_id", ctx.restaurant.id);
    if (error) return jsonError("No se pudo eliminar mesa", 500, safeClientDbMessage("[staff/tables delete]", error));
  }

  return NextResponse.json({ ok: true });
}
