# Migración Supabase — Staff Auth

Guía para aplicar **profiles**, **roles**, **usuarios demo** y **RLS** necesarios para `STAFF_AUTH` y la suite `npm run test:staff-auth`.

## Qué crea la migración

| Componente | Detalle |
|------------|---------|
| `app_role` enum | `cliente`, `cocina`, `dueno` |
| `profiles` | `id` → `auth.users`, `restaurant_id`, `role`, `full_name` |
| Funciones | `current_role()`, `current_restaurant_id()`, `handle_new_user()` |
| Trigger | Auto-crea perfil `cliente` al registrarse |
| RLS `profiles` | Lectura/actualización propia; **sin escalación** de `role`/`restaurant_id` |
| Restaurantes | `demo-ordee`, `clarkes` (si faltan) |
| Usuarios demo | Solo `@ordee.demo` — **no credenciales personales** |

### Credenciales demo (solo dev/staging)

| Email | Password | Rol | Restaurante |
|-------|----------|-----|-------------|
| `dueno@ordee.demo` | `Demo1234!` | dueno | `demo-ordee` |
| `cocina@ordee.demo` | `Demo1234!` | cocina | `demo-ordee` |

> **Producción:** no uses estas contraseñas. Crea usuarios reales con contraseñas fuertes y elimina o deshabilita las cuentas `@ordee.demo`.

---

## Opción A — SQL Editor (recomendada, 2 min)

1. Abrí [Supabase Dashboard](https://supabase.com/dashboard) → tu proyecto ORDEE.
2. **SQL Editor** → **New query**.
3. Copiá y ejecutá el archivo completo:

   [`ordee-mvp/supabase/024_staff_auth_bootstrap.sql`](../ordee-mvp/supabase/024_staff_auth_bootstrap.sql)

4. Debe terminar sin errores. Verificá:

   ```sql
   SELECT p.role, p.full_name, r.slug
   FROM profiles p
   JOIN restaurants r ON r.id = p.restaurant_id
   WHERE p.role IN ('cocina', 'dueno');
   ```

   Esperado: 2 filas (`dueno`, `cocina`) en `demo-ordee`.

5. En `ordee-cocina`:

   ```bash
   npm run test:staff-auth
   ```

   Objetivo: `PASS=14 FAIL=0 SKIP=0`.

---

## Opción B — Script automático (requiere connection string)

1. Dashboard → **Project Settings** → **Database** → **Connection string** → **URI** (Transaction pooler).
2. Agregá a `ordee-cocina/.env.local` (no commitear):

   ```env
   SUPABASE_DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[DB_PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```

3. Ejecutá:

   ```bash
   cd ordee-cocina
   npm run migrate:staff-auth
   npm run test:staff-auth
   ```

---

## Orden si la base ya tiene datos ORDEE

Tu proyecto ya tiene `restaurants`, `orders`, etc. Solo necesitás **024** (idempotente). No hace falta re-ejecutar 001–023 si esas tablas ya existen.

Si la base es **nueva**, aplicá en orden:

```
001_init.sql → 002_auth_roles_rls.sql → … → 021_multi_tenant_rls.sql → 024_staff_auth_bootstrap.sql
```

Para staff auth mínimo en base existente: **solo 024**.

---

## Scripts útiles

| Comando | Descripción |
|---------|-------------|
| `npm run migrate:staff-auth` | Aplica 024 vía `pg` + `SUPABASE_DATABASE_URL` |
| `node scripts/staff-list-users.mjs` | Lista perfiles staff |
| `node scripts/staff-get-token.mjs dueno@ordee.demo 'Demo1234!'` | Obtiene JWT para curl |
| `npm run test:staff-auth` | Suite T01–T14 |

---

## Seguridad

- Las cuentas `@ordee.demo` son **solo para desarrollo**.
- En producción: contraseñas ≥ 12 caracteres, rotación, y desactivar usuarios demo.
- `SUPABASE_DATABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` nunca en el frontend ni en git.
- La API staff valida JWT + `profiles` en servidor; RLS protege escalación de rol en `profiles`.

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `Could not find the table 'public.profiles'` | Ejecutar 024 |
| `Invalid login credentials` en test | Re-ejecutar bloque DO $$ de usuarios en 024 |
| Test T05 SKIP / 403 falla | Confirmar que existe restaurante `clarkes` (024 lo crea) |
| `Falta SUPABASE_DATABASE_URL` | Usar Opción A (SQL Editor) o agregar URI en `.env.local` |
