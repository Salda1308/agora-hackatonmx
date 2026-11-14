# Sesión y navegación por rol (R1)

`SessionProvider` está montado en `main.tsx`. `App` añade `SessionControls`,
`RoleDock` y un caso de ruta para `RoleScreen`; el Home y el componente Dock de D3
se conservan. La navegación pública sigue siendo Inicio, Solicitudes y Siguiendo.

Consumir `useSession()` dentro del proveedor ya montado:

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

`SessionControls` muestra el panel desplegable de acceso con los cuatro botones
de `demoAccounts` (en `demo.ts`), selección activa, errores y salida.
`signInDemo(role)` ejecuta `signInWithPassword` con la cuenta precargada; no cambia
el rol por estado local. Capturar sus errores para mostrarlos y desactivar los
botones mientras `loading` sea verdadero. `signOut()` cierra la sesión de este
dispositivo y vuelve al comprador visitante. El selector está rotulado
**Acceso de demostración** y lleva `SampleBadge`. Si `demoEnabled` es falso, el
selector queda oculto; una sesión existente conserva el control de salida.

La demo exige `VITE_DEMO_AUTH_ENABLED=true` y una URL Supabase de loopback
(`localhost`, `127.0.0.1` o `[::1]`), además de su llave pública. Está apagada por defecto, también en builds
de producción. Se permite un build de demostración contra un backend local.
No se han utilizado ni configurado cuentas reales o endpoints remotos.

`navigation` entrega los accesos del rol, vacío mientras no haya sesión resuelta.
`role-routes.ts` resuelve únicamente destinos operativos conocidos; el router hash
le delega esas rutas y mantiene las públicas intactas. `RoleScreen` protege cada
vista con `RequireRole` y ofrece marcadores de posición para las tareas siguientes.
Las políticas RLS siguen autorizando cada petición de datos.

## Integración con T05 y T06

- Los destinos y etiquetas viven en `roles.ts`. `#/fundacion` y
  `#/fundacion/publicar` son los puntos para T06; el resto de destinos de cada rol
  queda declarado en el mismo archivo.
- Para sustituir un marcador: añadir el caso correspondiente antes del caso
  genérico `role` de App, o resolverlo dentro de una pantalla del rol, siempre
  conservando `RequireRole`. No hace falta cambiar el dock base.
- `RoleDock` usa la misma API de D3; solo Fundación tiene la acción Publicar.
  No se incorpora Sistema ni un corazón a la navegación pública.
- `supabase` en `lib/supabase.ts` ahora puede ser `null` si faltan URL/llave.
  Comprobarlo antes de consultar; la página pública sigue funcionando sin backend
  y nunca adquiere permisos de rol. No se inventa una llave ni un backend de reserva.

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

## Toma de tareas (resuelto en T09)

R1 documentó que `UPDATE tareas` directo daba `42501`: la fila nueva no pasa la
política SELECT. T09 lo resolvió con la migración `20261114170000_tareas_repartidor.sql`:
el repartidor toma y libera solo con `public.tomar_tarea` y `public.liberar_tarea`
(funciones atómicas); el UPDATE directo ya no tiene política ni GRANT.
