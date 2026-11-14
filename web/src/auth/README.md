# Sesión R1 (lista para integrar con D3)

Este módulo todavía no está montado en `main.tsx`. El selector y el dock visual
esperan el aviso del control sobre D3. No hay cambio visual en esta entrega parcial.

Envolver la aplicación con `SessionProvider` y consumir `useSession()`:

```tsx
import { SessionProvider } from './auth/SessionProvider'
import { useSession } from './auth/useSession'
import { RequireRole } from './auth/RequireRole'

// En el punto de entrada: <SessionProvider><App /></SessionProvider>
// En las vistas: const { user, role, organizationId, loading, error,
//   demoEnabled, signInDemo, signOut, retry, navigation } = useSession()
// En contenido restringido:
// <RequireRole allowed={['tienda']} pending={<Cargando />} fallback={<SinAcceso />}>
//   <Pedidos />
// </RequireRole>
```

`role` es `null` mientras carga o si hay un error. El visitante y el usuario Auth
sin perfil son `comprador`; `user` permite distinguirlos. Los roles operativos y
la organización provienen exclusivamente de `public.perfiles`, nunca de metadata
de Auth ni del selector. `organizationId` es el UUID o `null`; no carga la ficha
de organización. Un error de perfil cierra el acceso y expone `retry` y `signOut`.
La suscripción de Auth cubre renovación de token, cambios de cuenta y salida.
Las respuestas tardías no restauran permisos de cuentas anteriores.

`demoAccounts` (en `demo.ts`) aporta los cuatro botones del selector.
`signInDemo(role)` ejecuta `signInWithPassword` con la cuenta precargada; no cambia
el rol por estado local. Capturar sus errores para mostrarlos y desactivar los
botones mientras `loading` sea verdadero. `signOut()` cierra la sesión de este
dispositivo y vuelve al comprador visitante. El selector debe rotularse
**Acceso de demostración · datos de ejemplo**, y ocultarse si `demoEnabled` es falso.

La demo exige `VITE_DEMO_AUTH_ENABLED=true` y una URL Supabase de loopback
(`localhost`, `127.0.0.1` o `[::1]`). Está apagada por defecto, también en builds
de producción. Se permite un build de demostración contra un backend local.
No se han utilizado ni configurado cuentas reales o endpoints remotos.

`navigation` entrega los accesos propuestos para cada rol, vacío mientras no haya
sesión resuelta. No se ha elegido un router ni implementado rutas: D3 conectará
estos destinos con vistas protegidas o marcadores de posición. `RequireRole`
protege la interfaz; las políticas RLS siguen autorizando cada petición de datos.

Pruebas sin dependencias adicionales (Node >= 22.18, con soporte TypeScript):

```sh
node --test web/tests/auth/session.test.ts
# Opt-in después de levantar un stack local y aplicar seed.sql:
R1_SUPABASE_URL=http://127.0.0.1:54321 \
R1_SUPABASE_PUBLISHABLE_KEY=<llave-publica-local> \
node --test web/tests/auth/local-auth.test.ts
```

La prueba local recorre login, cambio entre las cuatro cuentas, refresh,
restauración y cierre de sesión; rechaza endpoints que no sean loopback.

## Bloqueo de políticas documentado

El repartidor demo puede leer una tarea abierta, pero `UPDATE tareas SET
repartidor_id = auth.uid(), estado = 'asignada' WHERE id = ...` devuelve `42501`,
con o sin `RETURNING`, con las políticas actuales de T02. El caso queda como TODO
en `supabase/tests/database/demo.test.sql`; el usuario decidió dejar las políticas
intactas y continuar R1 hasta el límite de D3. La toma de tareas requiere revisión
por su tarea dueña antes de habilitar ese flujo. No se agregó migración ni bypass.
