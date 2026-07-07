# Autenticación staff — ORDEE-COCINA

Todas las rutas bajo `/api/staff/*` exigen autenticación server-side con JWT de Supabase Auth. **No es posible** invocarlas solo con `?restaurant=slug`.

## Flujo de seguridad

```
Cliente                         API route                         Supabase
  |                                |                                  |
  |-- Authorization: Bearer JWT -->|                                  |
  |                                |-- auth.getUser(jwt) ------------->|
  |                                |-- profiles (role, restaurant_id)->|
  |                                |-- restaurants.slug vs profile ---->|
  |                                |-- permiso por rol --------------->|
  |<-- 200 / 401 / 403 / 404 ------|                                  |
```

1. Extraer token del header `Authorization: Bearer <access_token>`.
2. Validar JWT con `supabase.auth.getUser(token)` (service role en servidor).
3. Cargar `profiles` del usuario (`role`, `restaurant_id`).
4. Resolver restaurante desde `?restaurant=<slug>` (solo para acotar el tenant solicitado).
5. Comparar `profile.restaurant_id` con `restaurant.id` → **403** si no coinciden.
6. Verificar que el rol tenga permiso para la acción → **403** si no.

## Códigos HTTP

| Código | Condición |
|--------|-----------|
| **401** | Sin header `Authorization`, token inválido o expirado |
| **403** | Usuario no staff (`cliente`), otro restaurante, o rol sin permiso |
| **404** | Slug de restaurante inexistente |

## Roles y permisos

| Recurso | cocina | dueno |
|---------|:------:|:-----:|
| Pedidos — lectura (`GET /orders`) | ✓ | ✓ |
| Pedidos — actualizar (`PATCH /orders/[id]`) | ✓ | ✓ |
| Pedidos — eliminar (`DELETE /orders/[id]`) | | ✓ |
| Pedidos — cleanup (`POST /orders/cleanup`) | | ✓ |
| Soporte (`GET/PATCH /help`) | ✓ | ✓ |
| Métricas (`GET /metrics`) | | ✓ |
| Menú (`GET/POST /menu`) | | ✓ |
| Mesas (`GET/POST /tables`) | | ✓ |

Los permisos están definidos en `src/lib/staff-auth.ts` (`ROLE_PERMISSIONS`).

## Archivos clave

| Archivo | Responsabilidad |
|---------|-----------------|
| `src/lib/staff-auth.ts` | `requireStaffAuth()` — validación JWT, profile y permisos |
| `src/lib/staff-client.ts` | Cliente: token, headers, `staffFetch()` |
| `src/app/api/staff/**/route.ts` | Rutas protegidas |
| `src/components/staff-login-screen.tsx` | Login con `signInWithPassword` |
| `src/components/panel-screen.tsx` | Envía `Authorization` en cada fetch |

## Frontend

- La sesión vive en **Supabase Auth** (no en `localStorage` custom).
- Cada `fetch` al staff API usa `staffFetch()` que adjunta `Authorization: Bearer <access_token>`.
- El rol dueño/cocina viene de `profiles.role` en servidor; la UI oculta vistas de dueño si `role === 'cocina'`.
- Se eliminó el desbloqueo admin por contraseña local (`ADMIN_PASS` / `localStorage`).

## Variables de entorno

Mismas que `ordee-mvp` (ver `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (solo servidor — valida JWT y ejecuta queries)

## Usuarios demo

Tras aplicar [`024_staff_auth_bootstrap.sql`](../ordee-mvp/supabase/024_staff_auth_bootstrap.sql) — ver [`STAFF_AUTH_MIGRATION.md`](./STAFF_AUTH_MIGRATION.md):

| Email | Password | Rol |
|-------|----------|-----|
| `dueno@ordee.demo` | `Demo1234!` | dueno |
| `cocina@ordee.demo` | `Demo1234!` | cocina |
| `scastrosoria@gmail.com` | *(no incluido en 024)* | — |

> 024 solo crea cuentas `@ordee.demo`. No uses credenciales personales en tests.

## Prueba manual

Ver suite completa en **[`STAFF_AUTH_TESTS.md`](./STAFF_AUTH_TESTS.md)** (`npm run test:staff-auth`).

```bash
# Sin token → 401
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3010/api/staff/orders?restaurant=demo-ordee"

# Con token válido de otro restaurante → 403
# Con token válido y slug correcto → 200
```

## Lo que NO se confía

- `localStorage` (`ordee_cocina_session`, `ordee_admin_auth`) — **eliminado**
- Parámetro `?restaurant=` solo — **insuficiente** sin JWT
- Rol declarado por el frontend — **siempre** se lee `profiles.role` en servidor
