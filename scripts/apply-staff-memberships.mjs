#!/usr/bin/env node
/**
 * Aplica 026_staff_restaurant_memberships.sql vía Postgres.
 * Requiere SUPABASE_DATABASE_URL o SUPABASE_DB_PASSWORD en .env.local
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const sqlPath = resolve(root, "../ordee-mvp/supabase/026_staff_restaurant_memberships.sql");

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

const conn = databaseUrl();
if (!conn) {
  console.error("Falta SUPABASE_DATABASE_URL o SUPABASE_DB_PASSWORD. Ver STAFF_AUTH_MIGRATION.md");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });

console.log("Aplicando staff restaurant memberships…");
console.log("SQL:", sqlPath);

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(`
    SELECT u.email, m.role, r.slug
    FROM public.staff_restaurant_memberships m
    JOIN auth.users u ON u.id = m.user_id
    JOIN public.restaurants r ON r.id = m.restaurant_id
    WHERE u.email = 'scastrosoria@gmail.com'
    ORDER BY r.slug
  `);
  console.log("Membresías scastrosoria@gmail.com:");
  for (const row of rows) {
    console.log(`  - ${row.slug} (${row.role})`);
  }
  console.log("OK");
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
