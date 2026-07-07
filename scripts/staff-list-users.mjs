#!/usr/bin/env node
/** Lista perfiles staff (cocina/dueno) en Supabase. */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  const raw = readFileSync(resolve(root, ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: profiles, error } = await admin
  .from("profiles")
  .select("id, role, restaurant_id, full_name")
  .in("role", ["cocina", "dueno"]);

if (error) {
  console.error(error.message);
  process.exit(1);
}

const restaurantIds = [...new Set((profiles ?? []).map((p) => p.restaurant_id).filter(Boolean))];
const { data: restaurants } = await admin.from("restaurants").select("id, slug").in("id", restaurantIds);
const slugById = new Map((restaurants ?? []).map((r) => [r.id, r.slug]));

for (const p of profiles ?? []) {
  const { data: user } = await admin.auth.admin.getUserById(p.id);
  console.log(
    JSON.stringify({
      email: user?.user?.email ?? "?",
      role: p.role,
      restaurant_slug: slugById.get(p.restaurant_id) ?? p.restaurant_id,
      full_name: p.full_name
    })
  );
}
