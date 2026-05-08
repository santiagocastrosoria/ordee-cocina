import { createClient } from "@supabase/supabase-js";
import { requiredEnv, requiredOneOfEnv } from "@/lib/env";

export function createSupabaseAdmin() {
  return createClient(requiredOneOfEnv("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
