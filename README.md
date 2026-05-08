# ORDEE-COCINA (Staff)

Panel staff separado de ORDEE-MVP.

## Requisitos

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

## Arranque

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abrir: http://localhost:3010

## Login temporal

- Mail: `scastrosoria@gmail.com`
- Password: `123456789`

## Vistas del panel

- Cocina (realtime por suscripciones Supabase + polling de respaldo)
- Caja/Encargado
- Dueño/Admin (metricas)
- Gestion de menu
- Gestion de mesas
- Alertas de soporte en tiempo real (boton \"Necesito ayuda\" del cliente)

## Conexion con ORDEE-MVP

Ambas apps comparten la misma base Supabase.
Cada pedido confirmado en ORDEE-MVP se guarda en `orders` y aparece en ORDEE-COCINA automaticamente.
Los cambios de menu y mesas impactan directo en ORDEE-MVP porque ambos leen la misma DB.
