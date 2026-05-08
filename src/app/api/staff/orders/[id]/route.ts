import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

interface Body {
  status?: "nuevo" | "preparando" | "listo" | "entregado" | "cancelado";
  paymentStatus?: "pendiente" | "pagado" | "fallido";
  cancelReason?: string;
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const body = (await request.json()) as Body;
  const update: Record<string, string> = {};

  if (body.status) update.status = body.status;
  if (body.paymentStatus) update.payment_status = body.paymentStatus;
  if (body.cancelReason) update.notes = `CANCELADO: ${body.cancelReason}`;

  const supabase = createSupabaseAdmin();
  const { error } = await supabase.from("orders").update(update).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: "No se pudo actualizar pedido" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
