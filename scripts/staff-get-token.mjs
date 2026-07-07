#!/usr/bin/env node
/**
 * Obtiene JWT de staff vía Supabase Auth (password grant).
 * Uso: node scripts/staff-get-token.mjs dueno@ordee.demo 'Demo1234!'
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  try {
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
  } catch {
    // ignore
  }
}

loadEnv();

const email = process.argv[2];
const password = process.argv[3];
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!email || !password || !url || !anon) {
  console.error("Uso: node scripts/staff-get-token.mjs <email> <password>");
  process.exit(1);
}

const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password })
});

const body = await res.json();
if (!res.ok || !body.access_token) {
  console.error(JSON.stringify(body));
  process.exit(1);
}

process.stdout.write(body.access_token);
