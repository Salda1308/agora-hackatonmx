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

Las credenciales van en variables de entorno; ver `.env.example`. No se guardan en el repositorio.
