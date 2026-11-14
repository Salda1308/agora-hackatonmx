<img src="assets/icon.svg" width="64" height="64" alt="">

# Ágora

Red de apoyo por unidades para organizaciones en México: las organizaciones publican lo que necesitan en unidades con precio fijo, cualquiera las paga con CoDi y la barra de avance se llena en vivo.

> En construcción. Los datos que se muestran en la demo son de ejemplo y se marcan como tales.

## Estructura
- `web/`: aplicación web (Vite, React, TypeScript).
- `supabase/`: migraciones, políticas de acceso y Edge Functions (cobro y webhook).

## Desarrollo
```
npm --prefix web install
npm run web
```

Backend local (requiere Docker):
```
npm install
npx supabase start     # aplica supabase/migrations
npx supabase test db   # pruebas de reglas de acceso (supabase/tests)
```

Las credenciales van en variables de entorno; ver `.env.example`. No se guardan en el repositorio.

| Variable | Dónde | Qué es |
|---|---|---|
| `VITE_SUPABASE_URL` | web | URL de la API de Supabase (`npx supabase status`) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | web | Llave pública de Supabase |
| Credenciales de pey | solo backend | Un secreto por tienda; `tiendas_cobro.credencial_ref` guarda el nombre del secreto, nunca el valor |

## Modelo de datos
Migraciones en `supabase/migrations/`. El cliente nunca escribe pagos, contadores de unidades, pedidos ni campos de moderación (`verificada`, `suspendida`, `retirada`): eso lo hace el backend con `service_role`. Las tablas nuevas de `public` reciben todos los privilegios por defecto; cada migración nueva debe quitarlos y dar solo los necesarios, como `20261114120100_politicas_acceso.sql`.
