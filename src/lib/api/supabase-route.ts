import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api/http";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

export function getAdminClientOrResponse():
  | { ok: true; client: SupabaseClient }
  | { ok: false; response: NextResponse } {
  try {
    return { ok: true, client: createSupabaseAdmin() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, response: jsonError("Config server invalida", 500, msg) };
  }
}
