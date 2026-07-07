# Pruebas manuales — STAFF_AUTH

Suite de verificación para autenticación/autorización server-side en `/api/staff/*`.

Relacionado: [`STAFF_AUTH.md`](./STAFF_AUTH.md)

---

## Prerrequisitos

1. **Migración staff auth aplicada** — ver [`STAFF_AUTH_MIGRATION.md`](./STAFF_AUTH_MIGRATION.md) (`024_staff_auth_bootstrap.sql`).
2. **Supabase** con `profiles`, usuarios `dueno@ordee.demo` / `cocina@ordee.demo`, restaurantes `demo-ordee` y `clarkes`.
3. **`.env.local`** con Supabase URL, anon key y service role.
4. **Servidor** `npm run dev` (puerto 3010).

```bash
cd ordee-cocina
npm run build          # recomendado: build limpio antes de probar
npm run dev            # puerto 3010
# o
npm run start          # producción local
```

> **Si ves HTTP 500** en rutas staff con HTML de error Next.js (`Cannot find module './chunks/vendor-chunks/...'`), el caché `.next` está corrupto. Solución:
>
> ```bash
> rm -rf .next && npm run build && npm run start
> ```

### Usuarios demo (tras migración 004)

| Email | Password | Rol | Restaurante |
|-------|----------|-----|-------------|
| `cocina@ordee.demo` | `Demo1234!` | cocina | `demo-ordee` |
| `dueno@ordee.demo` | `Demo1234!` | dueno | `demo-ordee` |

Alternativa: `scastrosoria@gmail.com` / `123456789` (dueno, `demo-ordee`) si existe migración `005_user_scastrosoria.sql`.

---

## Ejecución automatizada

```bash
cd ordee-cocina

# Servidor en 3010 (default del script)
npm run dev

# En otra terminal
npm run test:staff-auth

# Otro puerto
BASE_URL=http://localhost:3012 npm run test:staff-auth
```

### Tokens manuales (sin login en script)

Si los usuarios demo no existen en tu Supabase pero tenés sesión en el panel:

```bash
# 1. Login en /r/demo-ordee/panel
# 2. DevTools → Application → ver access_token de Supabase
#    o en consola: (await supabase.auth.getSession()).data.session.access_token

export STAFF_TEST_DUENO_TOKEN="<jwt>"
export STAFF_TEST_COCINA_TOKEN="<jwt>"
npm run test:staff-auth
```

### Listar staff en Supabase

```bash
node scripts/staff-list-users.mjs
```

### Obtener token por curl

```bash
# Cargar .env.local
source .env.local

node scripts/staff-get-token.mjs dueno@ordee.demo 'Demo1234!' > /tmp/dueno.jwt

curl -s -H "Authorization: Bearer $(cat /tmp/dueno.jwt)" \
  "http://localhost:3010/api/staff/orders?restaurant=demo-ordee"
```

---

## Matriz de pruebas

| ID | Caso | Método | Ruta | Auth | Esperado |
|----|------|--------|------|------|----------|
| T01 | Sin token | GET | `/api/staff/orders` | — | **401** |
| T02 | Sin token | GET | `/api/staff/metrics` | — | **401** |
| T03 | Token inválido | GET | `/api/staff/orders` | `Bearer token.invalido` | **401** |
| T04 | Slug inexistente | GET | `/api/staff/orders?restaurant=slug-inexistente-ord33-test` | dueño JWT | **404** |
| T05 | Cross-tenant | GET | `/api/staff/orders?restaurant=clarkes` | dueño de `demo-ordee` | **403** |
| T06 | Cocina → pedidos | GET | `/api/staff/orders?restaurant=demo-ordee` | cocina JWT | **200** |
| T07 | Cocina → métricas | GET | `/api/staff/metrics?restaurant=demo-ordee` | cocina JWT | **403** |
| T08 | Cocina → menú | GET | `/api/staff/menu?restaurant=demo-ordee` | cocina JWT | **403** |
| T09 | Cocina → mesas | GET | `/api/staff/tables?restaurant=demo-ordee` | cocina JWT | **403** |
| T10 | Cocina → actualizar pedido | PATCH | `/api/staff/orders/{uuid}?restaurant=demo-ordee` | cocina JWT | **404**¹ |
| T11 | Dueño → pedidos | GET | `/api/staff/orders?restaurant=demo-ordee` | dueño JWT | **200** |
| T12 | Dueño → métricas | GET | `/api/staff/metrics?restaurant=demo-ordee` | dueño JWT | **200** |
| T13 | Dueño → menú | GET | `/api/staff/menu?restaurant=demo-ordee` | dueño JWT | **200** |
| T14 | Dueño → mesas | GET | `/api/staff/tables?restaurant=demo-ordee` | dueño JWT | **200** |

¹ **404** con UUID válido inexistente confirma que **pasó auth y permiso `orders:write`** (no 401 ni 403). Si el pedido existiera, esperar **200** con `{ "ok": true }`.

---

## Comandos curl (copiar/pegar)

Variables de entorno para los ejemplos:

```bash
export BASE="http://localhost:3010"
export REST="demo-ordee"
export OTHER="clarkes"
export BAD="slug-inexistente-ord33-test"

# Obtener tokens (requiere usuarios demo en Supabase)
export DUENO_TOKEN=$(node scripts/staff-get-token.mjs dueno@ordee.demo 'Demo1234!')
export COCINA_TOKEN=$(node scripts/staff-get-token.mjs cocina@ordee.demo 'Demo1234!')
```

### T01–T03: 401

```bash
# T01 — sin token
curl -s -w "\nHTTP %{http_code}\n" \
  "$BASE/api/staff/orders?restaurant=$REST"
# → {"error":"No autorizado"} + HTTP 401

# T02 — sin token (métricas)
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  "$BASE/api/staff/metrics?restaurant=$REST"
# → HTTP 401

# T03 — token inválido
curl -s -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid" \
  "$BASE/api/staff/orders?restaurant=$REST"
# → {"error":"No autorizado"} + HTTP 401
```

### T04: 404 slug inexistente

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer $DUENO_TOKEN" \
  "$BASE/api/staff/orders?restaurant=$BAD"
# → {"error":"Restaurante no encontrado"} + HTTP 404
```

### T05: 403 otro restaurante

Usuario `dueno@ordee.demo` pertenece a `demo-ordee`. Pedir `clarkes`:

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -H "Authorization: Bearer $DUENO_TOKEN" \
  "$BASE/api/staff/orders?restaurant=$OTHER"
# → {"error":"Acceso denegado"} + HTTP 403
```

### T06–T09: cocina — pedidos sí, admin no

```bash
# T06 — OK
curl -s -o /dev/null -w "orders: %{http_code}\n" \
  -H "Authorization: Bearer $COCINA_TOKEN" \
  "$BASE/api/staff/orders?restaurant=$REST"

# T07–T09 — prohibido
curl -s -o /dev/null -w "metrics: %{http_code}\n" \
  -H "Authorization: Bearer $COCINA_TOKEN" \
  "$BASE/api/staff/metrics?restaurant=$REST"

curl -s -o /dev/null -w "menu: %{http_code}\n" \
  -H "Authorization: Bearer $COCINA_TOKEN" \
  "$BASE/api/staff/menu?restaurant=$REST"

curl -s -o /dev/null -w "tables: %{http_code}\n" \
  -H "Authorization: Bearer $COCINA_TOKEN" \
  "$BASE/api/staff/tables?restaurant=$REST"
# → metrics/menu/tables: HTTP 403
```

### T10: cocina actualiza pedido (permiso write)

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -X PATCH \
  -H "Authorization: Bearer $COCINA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"preparando"}' \
  "$BASE/api/staff/orders/00000000-0000-0000-0000-000000000001?restaurant=$REST"
# → {"error":"Pedido no encontrado"} + HTTP 404  (auth OK, permiso OK)
```

Con un `ORDER_ID` real del GET /orders:

```bash
curl -s -w "\nHTTP %{http_code}\n" \
  -X PATCH \
  -H "Authorization: Bearer $COCINA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"preparando"}' \
  "$BASE/api/staff/orders/$ORDER_ID?restaurant=$REST"
# → {"ok":true} + HTTP 200
```

### T11–T14: dueño — acceso completo lectura

```bash
for path in orders metrics menu tables; do
  curl -s -o /dev/null -w "$path: %{http_code}\n" \
    -H "Authorization: Bearer $DUENO_TOKEN" \
    "$BASE/api/staff/$path?restaurant=$REST"
done
# → todos HTTP 200
```

---

## Resultados verificados

**Última ejecución:** 2026-07-07  
**Estado:** migración **pendiente** — tabla `profiles` ausente en Supabase (`gipictcenjmsznsvcmgk`).

| ID | Resultado | HTTP | Notas |
|----|-----------|------|-------|
| T01 | ✅ PASS | 401 | |
| T02 | ✅ PASS | 401 | |
| T03 | ✅ PASS | 401 | |
| T04–T14 | ⏭ SKIP | — | Requiere migración 024 + usuarios `@ordee.demo` |

```
PASS=3  FAIL=0  SKIP=13  (objetivo: PASS=14 SKIP=0)
```

**Siguiente paso:** aplicar [`STAFF_AUTH_MIGRATION.md`](./STAFF_AUTH_MIGRATION.md) → `npm run verify:staff-auth` → `npm run test:staff-auth`.

### Resultado esperado post-migración

```
PASS=14  FAIL=0  SKIP=0
```

---

## Checklist manual en UI

| Paso | Acción | Esperado |
|------|--------|----------|
| 1 | Abrir `/r/demo-ordee` sin login | Pantalla login |
| 2 | Login `cocina@ordee.demo` | Panel carga; pedidos visibles |
| 3 | Intentar vista Dueño / Menú / Mesas | Bloqueado (rol cocina) |
| 4 | Logout; login `dueno@ordee.demo` | Vistas admin desbloqueadas |
| 5 | DevTools → Network → fetch `/api/staff/orders` | Header `Authorization: Bearer ...` presente |
| 6 | Borrar header Authorization y repetir fetch | 401 |

---

## Archivos de la suite

| Archivo | Propósito |
|---------|-----------|
| `scripts/staff-auth-tests.sh` | Suite bash automatizada |
| `scripts/staff-get-token.mjs` | Obtiene JWT vía password grant |
| `scripts/staff-list-users.mjs` | Lista perfiles staff en Supabase |
| `package.json` → `test:staff-auth` | Atajo npm |

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| HTTP 500 + HTML Next.js | Caché `.next` corrupto o mezcla dev/prod | `rm -rf .next && npm run build` |
| SKIP en todos los JWT | Usuarios demo no creados | Ejecutar `004_quickstart_demo_staff.sql` |
| 401 con token válido | Token expirado | Renovar con `staff-get-token.mjs` |
| 403 con slug correcto | `profile.restaurant_id` no coincide | Verificar perfil en Supabase |
| `profiles` no existe | Migración 002 pendiente | Aplicar SQL en Supabase |
