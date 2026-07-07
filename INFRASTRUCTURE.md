# Infraestructura — ORDEE-COCINA

Documentación de endurecimiento de infraestructura (sin cambios de lógica de negocio).

## Resumen de cambios

| Área | Cambio | Archivos |
|------|--------|----------|
| Build | Scripts `lint` y `typecheck` añadidos | `package.json` |
| Build | ESLint + `eslint-config-next` | `package.json`, `.eslintrc.json` |
| Build | `engines.node >= 18.18.0`, `.nvmrc` | `package.json`, `.nvmrc` |
| Vercel | Config de deploy, región `gru1` | `vercel.json` |
| Middleware | **Nuevo** — antes no existía | `middleware.ts` |
| Headers | CSP, HSTS, X-Frame-Options, COOP, CORP | `src/lib/infra/*` |
| HTTPS | HSTS en producción | `security-headers.ts` |
| CORS | Preflight API restringido a orígenes permitidos | `cors.ts` |
| Rate limiting | 120 req/min por IP en `/api/staff/*` | `rate-limit.ts` |
| Compresión | `compress: true`, `poweredByHeader: false` | `next.config.mjs` |
| Secrets | `.env.example` documentado por secciones | `.env.example` |
| Secrets | `.gitignore` endurecido | `.gitignore` |
| Dependencias | Next.js `14.2.5` → `14.2.35` | `package.json` |

## Vercel

- Proyecto independiente de `ordee-mvp`, mismo Supabase.
- Región **gru1** para menor latencia en LATAM.
- `SUPABASE_SERVICE_ROLE_KEY` solo en variables de servidor de Vercel.

## Headers de seguridad

Igual que MVP, sin dominios de Mercado Pago en CSP (esta app no integra pagos).

## CORS

Orígenes permitidos: URLs públicas configuradas + `localhost:3000` / `localhost:3010` en desarrollo.

## Rate limiting

120 solicitudes por minuto por IP en todas las rutas `/api/*`.

## Cache / CDN

Assets estáticos con extensión de imagen/fuente reciben `Cache-Control: public, max-age=31536000, immutable` vía middleware.

## Cookies

Panel staff usa `localStorage` (sin cambio). Ver notas en `ordee-mvp/INFRASTRUCTURE.md` para migración futura.

## Comandos de verificación

```bash
npm run lint
npm run typecheck
npm run build
```

## Archivos de infraestructura

```
middleware.ts          # nuevo
next.config.mjs
vercel.json            # nuevo
.env.example
.nvmrc                 # nuevo
.eslintrc.json         # nuevo
src/lib/infra/
  env.ts
  security-headers.ts
  rate-limit.ts
  cors.ts
  apply-response-headers.ts
```

## Pendiente (fuera de este alcance)

- Autenticación server-side en `/api/staff/*`
- Rate limit distribuido / WAF
