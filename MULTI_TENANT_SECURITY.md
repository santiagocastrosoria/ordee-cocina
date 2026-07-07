# Seguridad Multi-Tenant — ORDEE-COCINA

Ver documento principal en **`../ordee-mvp/MULTI_TENANT_SECURITY.md`**.

## Cambios en este repo

| Archivo | Cambio |
|---------|--------|
| `src/components/panel-screen.tsx` | Realtime solo en tablas con filtro `restaurant_id` |
| `src/app/api/staff/orders/[id]/route.ts` | UPDATE/DELETE con `.eq(restaurant_id)` |
| `src/app/api/staff/menu/route.ts` | Mutaciones con `.eq(restaurant_id)` |
| `src/app/api/staff/tables/route.ts` | Mutaciones con `.eq(restaurant_id)` |
| `src/app/api/staff/help/route.ts` | PATCH con `.eq(restaurant_id)` |

Las migraciones SQL viven en `ordee-mvp/supabase/021_multi_tenant_rls.sql`.
