#!/usr/bin/env node
/**
 * Asigna scastrosoria@gmail.com a demo-ordee + clarkes (dueno).
 * Usa staff_restaurant_memberships si existe; si no, app_metadata (hasta aplicar 026).
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const EMAIL = "scastrosoria@gmail.com";
const SLUGS = ["demo-ordee", "clarkes"];

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i === -1) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
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
  console.error("Faltan variables Supabase");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUserByEmail() {
  const list = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (!list.error) {
    const hit = (list.data.users ?? []).find((u) => u.email === EMAIL);
    if (hit) return hit;
  }

  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const login = await anon.auth.signInWithPassword({ email: EMAIL, password: "Demo1234!" });
  if (login.data.user?.email === EMAIL) {
    const byId = await admin.auth.admin.getUserById(login.data.user.id);
    if (byId.data.user) return byId.data.user;
  }

  return null;
}

const user = await findUserByEmail();
if (!user) {
  console.error(`Usuario ${EMAIL} no encontrado en auth.users`);
  process.exit(1);
}

console.log("auth.users OK:", user.id, user.email);

const { data: restos } = await admin.from("restaurants").select("id, slug").in("slug", SLUGS);
if (!restos?.length) {
  console.error("Faltan restaurantes demo-ordee/clarkes");
  process.exit(1);
}

const { error: tableProbe } = await admin.from("staff_restaurant_memberships").select("id").limit(1);
const hasMembershipsTable = !tableProbe;

if (hasMembershipsTable) {
  for (const resto of restos) {
    const { error } = await admin.from("staff_restaurant_memberships").upsert(
      { user_id: user.id, restaurant_id: resto.id, role: "dueno" },
      { onConflict: "user_id,restaurant_id" }
    );
    if (error) {
      console.error(`membresía ${resto.slug}:`, error.message);
      process.exit(1);
    }
    console.log(`membresía OK: ${resto.slug} (dueno)`);
  }
} else {
  console.warn("Tabla staff_restaurant_memberships ausente — usando app_metadata temporal.");
  console.warn("Ejecutá 026_staff_restaurant_memberships.sql en Supabase SQL Editor.");
  const staffRestaurants = restos.map((r) => ({ slug: r.slug, role: "dueno" }));
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    password: "Demo1234!",
    email_confirm: true,
    app_metadata: {
      ...(user.app_metadata ?? {}),
      staff_restaurants: staffRestaurants
    }
  });
  if (error) {
    console.error("updateUser app_metadata:", error.message);
    process.exit(1);
  }
  console.log("app_metadata.staff_restaurants:", staffRestaurants.map((s) => s.slug).join(", "));
}

await admin.from("profiles").upsert(
  { id: user.id, role: "dueno", full_name: "Santiago Castro", restaurant_id: restos.find((r) => r.slug === "demo-ordee")?.id },
  { onConflict: "id" }
);

console.log("profiles OK (dueno)");
