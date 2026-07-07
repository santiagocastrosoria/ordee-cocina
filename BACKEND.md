# Backend — ORDEE Cocina (`ordee-cocina`)

Optimización de APIs staff. **No se modificó frontend.**

Comparte patrones con `ordee-mvp` documentados en [BACKEND.md](../ordee-mvp/BACKEND.md).

## Módulos (`src/lib/api/`)

| Archivo | Propósito |
|---------|-----------|
| `http.ts` | `jsonError`, `parseJsonBody`, `safeClientDbMessage`, `logRouteError` |
| `sanitize.ts` | `sanitizeText`, `sanitizeSlug`, `sanitizeTableNumber`, `isUuid`, `validatePositivePrice` |
| `supabase-route.ts` | `getAdminClientOrResponse()` |

## `resolve-restaurant.ts`

- Slug sanitizado con `sanitizeSlug`.
- Acepta cliente Supabase opcional para reutilizar la instancia del handler.

---

## Rutas staff refactorizadas

| Ruta | Mejoras |
|------|---------|
| `GET /api/staff/orders` | Admin client único, errores DB logueados |
| `PATCH/DELETE /api/staff/orders/[id]` | UUID, `parseJsonBody`, enums de estado, tenant scope |
| `POST /api/staff/orders/cleanup` | `parseJsonBody`, errores sin filtrar al cliente en prod |
| `GET/POST /api/staff/menu` | Sanitización nombre/precio/descripción, UUID en mutaciones |
| `GET/POST /api/staff/tables` | Sanitización mesa, validación estado mesa |
| `GET/PATCH /api/staff/help` | UUID en PATCH, errores DB |
| `GET /api/staff/metrics` | **Fix**: errores de `orders` y `order_items` ya no se ignoran |

---

## Hallazgos corregidos

1. **Errores silenciosos** en `metrics` — consultas sin revisar `error`.
2. **JSON sin try/catch** — reemplazado por `parseJsonBody`.
3. **IDs arbitrarios** — validación UUID antes de mutar.
4. **Estados inválidos** — whitelist en PATCH de pedidos y mesas.
5. **Múltiples admin clients** por request — consolidado.
6. **Slugs sin formato** — `sanitizeSlug` en query params.

---

## Pendiente

- Autenticación/autorización server-side en `/api/staff/*`.
- Rate limiting específico staff (middleware global ya aplica límites básicos).

---

## Verificación

```bash
cd ordee-cocina
npm run lint && npm run typecheck && npm run build
```
