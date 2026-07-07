#!/usr/bin/env bash
# Suite T01–T14 para STAFF_AUTH. Uso: npm run test:staff-auth

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

BASE_URL="${BASE_URL:-http://localhost:3010}"
RESTAURANT="${RESTAURANT_SLUG:-demo-ordee}"
OTHER_RESTAURANT="${OTHER_RESTAURANT_SLUG:-clarkes}"
BAD_SLUG="slug-inexistente-ord33-test"
SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"
ANON_KEY="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}"

COCINA_TOKEN="${STAFF_TEST_COCINA_TOKEN:-}"
DUENO_TOKEN="${STAFF_TEST_DUENO_TOKEN:-}"
COCINA_EMAIL="${STAFF_TEST_COCINA_EMAIL:-cocina@ordee.demo}"
COCINA_PASSWORD="${STAFF_TEST_COCINA_PASSWORD:-Demo1234!}"
DUENO_EMAIL="${STAFF_TEST_DUENO_EMAIL:-dueno@ordee.demo}"
DUENO_PASSWORD="${STAFF_TEST_DUENO_PASSWORD:-Demo1234!}"

PASS=0
FAIL=0
SKIP=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() { PASS=$((PASS + 1)); echo -e "${GREEN}PASS${NC} $1 (HTTP $3, expected $2)"; }
log_fail() { FAIL=$((FAIL + 1)); echo -e "${RED}FAIL${NC} $1 (HTTP $3, expected $2) — $4"; }
log_skip() { SKIP=$((SKIP + 1)); echo -e "${YELLOW}SKIP${NC} $1 — $2"; }

get_token() {
  local email="$1" password="$2" response
  response=$(curl -sS -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
    -H "apikey: ${ANON_KEY}" -H "Content-Type: application/json" \
    -d "{\"email\":\"${email}\",\"password\":\"${password}\"}" 2>/dev/null || true)
  echo "$response" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c);
    process.stdin.on('end',()=>{ try { const j=JSON.parse(d); if(j.access_token) process.stdout.write(j.access_token); else process.exit(1);} catch{process.exit(1);} });
  " 2>/dev/null || echo ""
}

staff_request() {
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  local args=(-sS -o /tmp/staff_auth_body.txt -w "%{http_code}" -X "$method")
  [[ -n "$token" ]] && args+=(-H "Authorization: Bearer ${token}")
  [[ -n "$body" ]] && args+=(-H "Content-Type: application/json" -d "$body")
  curl "${args[@]}" "${BASE_URL}${path}" 2>/dev/null || echo "000"
}

assert_status() {
  local id="$1" method="$2" path="$3" token="${4:-}" expected="$5" body="${6:-}"
  local got detail
  got=$(staff_request "$method" "$path" "$token" "$body")
  detail=$(head -c 200 /tmp/staff_auth_body.txt 2>/dev/null || true)
  if [[ "$got" == "$expected" ]]; then log_pass "$id" "$expected" "$got"
  else log_fail "$id" "$expected" "$got" "$detail"; fi
}

echo "=== STAFF_AUTH T01–T14 ==="
echo "BASE_URL=$BASE_URL RESTAURANT=$RESTAURANT"
echo ""

if ! curl -sS -o /dev/null --connect-timeout 2 "${BASE_URL}/api/staff/orders?restaurant=${RESTAURANT}" 2>/dev/null; then
  echo -e "${RED}ERROR${NC}: No responde ${BASE_URL}. Ejecuta: npm run dev"
  exit 1
fi

if [[ -z "$SUPABASE_URL" || -z "$ANON_KEY" ]]; then
  echo -e "${RED}ERROR${NC}: Faltan variables Supabase en .env.local"
  exit 1
fi

if ! node scripts/verify-staff-auth-ready.mjs >/dev/null 2>&1; then
  echo -e "${YELLOW}AVISO${NC}: Migración staff auth no aplicada. Ver STAFF_AUTH_MIGRATION.md"
  node scripts/verify-staff-auth-ready.mjs 2>&1 || true
  echo ""
fi

echo "--- T01–T03: 401 ---"
assert_status "T01 sin token → orders" GET "/api/staff/orders?restaurant=${RESTAURANT}" "" 401
assert_status "T02 sin token → metrics" GET "/api/staff/metrics?restaurant=${RESTAURANT}" "" 401
assert_status "T03 token inválido → orders" GET "/api/staff/orders?restaurant=${RESTAURANT}" "token.invalido.jwt" 401

echo ""
echo "--- Tokens demo @ordee.demo ---"
[[ -z "$COCINA_TOKEN" ]] && COCINA_TOKEN=$(get_token "$COCINA_EMAIL" "$COCINA_PASSWORD")
[[ -z "$DUENO_TOKEN" ]] && DUENO_TOKEN=$(get_token "$DUENO_EMAIL" "$DUENO_PASSWORD")
[[ -n "$COCINA_TOKEN" ]] && echo "cocina token OK" || log_skip "tokens" "sin cocina (${COCINA_EMAIL})"
[[ -n "$DUENO_TOKEN" ]] && echo "dueno token OK" || log_skip "tokens" "sin dueno (${DUENO_EMAIL})"

echo ""
if [[ -z "$DUENO_TOKEN" ]]; then
  log_skip "T04 slug inexistente" "sin token dueno"
  log_skip "T05 cross-tenant 403" "sin token dueno"
else
  assert_status "T04 slug inexistente → orders" GET "/api/staff/orders?restaurant=${BAD_SLUG}" "$DUENO_TOKEN" 404
  assert_status "T05 otro restaurante → orders" GET "/api/staff/orders?restaurant=${OTHER_RESTAURANT}" "$DUENO_TOKEN" 403
fi

echo ""
if [[ -z "$COCINA_TOKEN" ]]; then
  for id in T06 T07 T08 T09 T10; do log_skip "$id" "sin token cocina"; done
else
  assert_status "T06 cocina → GET orders" GET "/api/staff/orders?restaurant=${RESTAURANT}" "$COCINA_TOKEN" 200
  assert_status "T07 cocina → GET metrics" GET "/api/staff/metrics?restaurant=${RESTAURANT}" "$COCINA_TOKEN" 403
  assert_status "T08 cocina → GET menu" GET "/api/staff/menu?restaurant=${RESTAURANT}" "$COCINA_TOKEN" 403
  assert_status "T09 cocina → GET tables" GET "/api/staff/tables?restaurant=${RESTAURANT}" "$COCINA_TOKEN" 403
  assert_status "T10 cocina → PATCH order" PATCH \
    "/api/staff/orders/00000000-0000-0000-0000-000000000001?restaurant=${RESTAURANT}" \
    "$COCINA_TOKEN" 404 '{"status":"preparando"}'
fi

echo ""
if [[ -z "$DUENO_TOKEN" ]]; then
  for id in T11 T12 T13 T14; do log_skip "$id" "sin token dueno"; done
else
  assert_status "T11 dueno → GET orders" GET "/api/staff/orders?restaurant=${RESTAURANT}" "$DUENO_TOKEN" 200
  assert_status "T12 dueno → GET metrics" GET "/api/staff/metrics?restaurant=${RESTAURANT}" "$DUENO_TOKEN" 200
  assert_status "T13 dueno → GET menu" GET "/api/staff/menu?restaurant=${RESTAURANT}" "$DUENO_TOKEN" 200
  assert_status "T14 dueno → GET tables" GET "/api/staff/tables?restaurant=${RESTAURANT}" "$DUENO_TOKEN" 200
fi

echo ""
echo "=== Resumen: PASS=$PASS FAIL=$FAIL SKIP=$SKIP (objetivo: PASS=14 SKIP=0) ==="

[[ "$FAIL" -gt 0 || "$SKIP" -gt 0 ]] && exit 1
exit 0
