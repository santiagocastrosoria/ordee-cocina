#!/usr/bin/env node
/**
 * Aplica 024_staff_auth_bootstrap.sql vía conexión Postgres directa.
 *
 * Requiere SUPABASE_DATABASE_URL en .env.local (o entorno):
 *   postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
 *
 * Obtener en: Supabase Dashboard → Project Settings → Database → Connection string (URI, pooler).
 *
 * Uso:
 *   node scripts/apply-staff-auth-migration.mjs
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const sqlPath = resolve(root, "../ordee-mvp/supabase/024_staff_auth_bootstrap.sql");

function loadEnvFile(path) {
  try {
    const raw = readFileSync(path, "utf8");
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
  } catch {
    // optional
  }
}

loadEnvFile(resolve(root, ".env.local"));
loadEnvFile(resolve(root, "../ordee-mvp/.env.local"));

const databaseUrl = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error(`
ERROR: Falta SUPABASE_DATABASE_URL.

1. Supabase Dashboard → Project Settings → Database
2. Connection string → URI (Transaction pooler o Session pooler)
3. Agregar a ordee-cocina/.env.local:

   SUPABASE_DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@...pooler.supabase.com:6543/postgres

4. Re-ejecutar: node scripts/apply-staff-auth-migration.mjs

Alternativa manual: pegar el contenido de
  ordee-mvp/supabase/024_staff_auth_bootstrap.sql
en Supabase → SQL Editor → Run.
`);
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false }
});

console.log("Aplicando staff auth bootstrap...");
console.log("SQL:", sqlPath);

try {
  await client.connect();
  await client.query(sql);
  const { rows } = await client.query(`
    SELECT p.role, p.full_name, r.slug AS restaurant_slug
    FROM public.profiles p
    JOIN public.restaurants r ON r.id = p.restaurant_id
    WHERE p.role IN ('cocina', 'dueno')
    ORDER BY p.role
  `);
  console.log("Perfiles staff:");
  for (const row of rows) {
    console.log(`  - ${row.role} @ ${row.restaurant_slug} (${row.full_name})`);
  }
  console.log("OK: migración aplicada.");
} catch (err) {
  console.error("ERROR aplicando migración:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
