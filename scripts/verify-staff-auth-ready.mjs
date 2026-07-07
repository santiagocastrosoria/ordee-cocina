#!/usr/bin/env node
/** Verifica que la migración staff auth esté aplicada antes de correr tests. */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i);
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* */
  }
}

loadEnv(resolve(root, ".env.local"));
loadEnv(resolve(root, "../ordee-mvp/.env.local"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { error: profilesErr } = await admin.from("profiles").select("id").limit(1);
if (profilesErr) {
  console.error("NO LISTO: tabla profiles ausente.");
  console.error("  → Ver STAFF_AUTH_MIGRATION.md (Opción A: SQL Editor)");
  process.exit(1);
}

const { data: staff, error: staffErr } = await admin
  .from("profiles")
  .select("role, full_name, restaurant_id")
  .in("role", ["cocina", "dueno"]);

if (staffErr) {
  console.error("Error leyendo profiles:", staffErr.message);
  process.exit(1);
}

if (!staff?.length) {
  console.error("NO LISTO: sin perfiles cocina/dueno. Ejecutá 024_staff_auth_bootstrap.sql");
  process.exit(1);
}

const { data: restos } = await admin.from("restaurants").select("id, slug").in("slug", ["demo-ordee", "clarkes"]);
const slugs = new Set((restos ?? []).map((r) => r.slug));

console.log("OK: staff auth listo");
console.log("  perfiles:", staff.map((s) => s.role).join(", "));
console.log("  restaurantes:", [...slugs].join(", ") || "(ninguno)");

if (!slugs.has("demo-ordee") || !slugs.has("clarkes")) {
  console.warn("AVISO: falta demo-ordee o clarkes — test T05 puede fallar");
}

process.exit(0);
