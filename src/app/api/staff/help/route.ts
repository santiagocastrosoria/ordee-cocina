import { NextRequest, NextResponse } from "next/server";
import { jsonError, parseJsonBody, safeClientDbMessage } from "@/lib/api/http";
import { isUuid } from "@/lib/api/sanitize";
import { requireStaffAuth } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireStaffAuth(request, "help:read");
  if (!auth.ok) return auth.response;

  const { ctx } = auth;

  const { data, error } = await ctx.admin
    .from("help_requests")
    .select("id,table_number,status,created_at")
    .eq("restaurant_id", ctx.restaurant.id)
    .eq("status", "nuevo")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return jsonError("No se pudo cargar soporte", 500, safeClientDbMessage("[staff/help GET]", error));
  return NextResponse.json(data ?? []);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStaffAuth(request, "help:write");
  if (!auth.ok) return auth.response;

  const { ctx } = auth;

  const parsed = await parseJsonBody<{ id?: string }>(request);
  if (!parsed.ok) return parsed.response;

  if (!isUuid(parsed.data.id)) return jsonError("Falta id", 400);

  const { data: row, error: fetchError } = await ctx.admin
    .from("help_requests")
    .select("id,restaurant_id")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (fetchError || !row || row.restaurant_id !== ctx.restaurant.id) {
    return jsonError("Solicitud no encontrada", 404);
  }

  const { error } = await ctx.admin
    .from("help_requests")
    .update({ status: "resuelto" })
    .eq("id", parsed.data.id)
    .eq("restaurant_id", ctx.restaurant.id);

  if (error) return jsonError("No se pudo resolver", 500, safeClientDbMessage("[staff/help PATCH]", error));
  return NextResponse.json({ ok: true });
}
