#!/usr/bin/env node
/**
 * Repara / crea usuarios demo staff en Supabase Auth + profiles.
 *
 * Requiere una de:
 *   SUPABASE_DATABASE_URL=postgresql://...
 *   SUPABASE_DB_PASSWORD=<database password>  (pooler aws-1-sa-east-1)
 *
 * Uso:
 *   npm run bootstrap:staff-users
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const sqlPath = resolve(root, "../ordee-mvp/supabase/025_fix_demo_staff_auth_users.sql");

const DEMO_USERS = [
  { email: "dueno@ordee.demo", password: "Demo1234!", role: "dueno" },
  { email: "cocina@ordee.demo", password: "Demo1234!", role: "cocina" }
];

function loadEnvFile(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
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
  } catch {
    /* optional */
  }
}

loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, "../ordee-mvp/.env.local"));

function projectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const m = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return m?.[1] ?? null;
}

function databaseUrl() {
  if (process.env.SUPABASE_DATABASE_URL) return process.env.SUPABASE_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const ref = projectRef();
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  if (ref && pwd) {
    return `postgresql://postgres.${ref}:${encodeURIComponent(pwd)}@aws-1-sa-east-1.pooler.supabase.com:6543/postgres`;
  }
  return null;
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function applySqlFix() {
  const conn = databaseUrl();
  if (!conn) {
    console.error(`
ERROR: Falta conexión a Postgres.

Agregá en ordee-cocina/.env.local UNA de estas opciones:

  SUPABASE_DB_PASSWORD=tu_password_de_database

(o la URI completa)

  SUPABASE_DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres

Password: Supabase Dashboard → Project Settings → Database → Database password
`);
    process.exit(1);
  }

  const sql = readFileSync(sqlPath, "utf8");
  const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(sql);
    const { rows } = await client.query(`
      SELECT u.email, p.role, r.slug AS restaurant_slug
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      JOIN public.restaurants r ON r.id = p.restaurant_id
      WHERE u.email IN ('dueno@ordee.demo', 'cocina@ordee.demo')
      ORDER BY u.email
    `);
    console.log("SQL OK — perfiles staff:");
    for (const row of rows) {
      console.log(`  ${row.email} → ${row.role} @ ${row.restaurant_slug}`);
    }
  } finally {
    await client.end();
  }
}

async function verifyAuthUsers() {
  const admin = supabaseAdmin();
  for (const { email } of DEMO_USERS) {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const user = data.users.find((u) => u.email === email);
    if (!user) throw new Error(`auth.users sin ${email}`);
    console.log(`auth.users OK: ${email} (${user.id})`);
  }
}

async function testSignIn() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const client = createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } });

  for (const { email, password } of DEMO_USERS) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session?.access_token) {
      throw new Error(`signInWithPassword ${email}: ${error?.message ?? "sin session"}`);
    }
    console.log(`signInWithPassword OK: ${email}`);
    await client.auth.signOut();
  }
}

console.log("Bootstrap staff users…");
console.log("SQL:", sqlPath);

await applySqlFix();
await verifyAuthUsers();
await testSignIn();

console.log("\nListo: dueno@ordee.demo y cocina@ordee.demo pueden ingresar al panel (Demo1234!).");
