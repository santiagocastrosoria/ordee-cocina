# Frontend — ORDEE Cocina (`ordee-cocina`)

Optimización de UI staff. **Sin cambios en lógica de negocio.**

Ver también [FRONTEND.md](../ordee-mvp/FRONTEND.md) para patrones compartidos.

## Hallazgos y correcciones

### Re-renders / polling

| Problema | Corrección |
|----------|------------|
| Polling cada 2s con pestaña en background | Intervalo respeta `document.visibilityState` |
| `fetchMenu` / `fetchTables` en mount aunque no se usen | Lazy fetch al abrir vista `menu` / `mesas` |
| `console.info` en `.map()` del ticket | Eliminado del render path |
| Fragment sin `key` en items del ticket | `Fragment` con `key` estable |

### Bundles / Lazy Loading

| Ruta | Cambio |
|------|--------|
| `/panel`, `/r/[slug]/panel` | `next/dynamic` para `PanelScreen` |
| Mismas rutas | `loading.tsx` con skeleton |

### Hydration / CLS

| Problema | Nota |
|----------|------|
| Flash de login antes de redirect por sesión | Patrón `useEffect` + localStorage — sin cambio de flujo |
| Nombre staff `"Staff"` → real post-mount | Mejorable con `useMounted` gate (futuro) |

### Imágenes

No hay `<img>` ni `next/image` en UI actual. `image_url` se guarda pero no se renderiza.

### Core Web Vitals

| Métrica | Mejora |
|---------|--------|
| **LCP** | Skeleton en panel mientras carga chunk |
| **INP** | Menos trabajo en background (polling pausado) |

---

## Archivos nuevos

- `src/components/ui/route-skeleton.tsx`
- `loading.tsx` en rutas panel

---

## Pendiente

- Dividir `panel-screen.tsx` en vistas con `dynamic()` (cocina, caja, dueño, menú, mesas)
- `React.memo` en tarjetas de pedido
- Virtualizar historial si crece >50 ítems

---

## Verificación

```bash
cd ordee-cocina && npm run lint && npm run typecheck && npm run build
```
