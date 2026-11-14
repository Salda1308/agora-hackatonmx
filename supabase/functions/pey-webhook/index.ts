// Edge Function pública del webhook de pey (T04). Desplegar con
// --no-verify-jwt: pey no manda JWT de Supabase; la autenticación es la firma.
// Ver README.md para configuración y contrato.
import { crearHandler } from "./handler.ts";
import { consultarTransaccion, leerApiKey } from "./pey.ts";
import { conectar, crearAlmacen } from "./store.ts";

const dbUrl = Deno.env.get("SUPABASE_DB_URL");

Deno.serve(crearHandler({
  secreto: Deno.env.get("PEY_WEBHOOK_SECRET"),
  almacen: dbUrl ? crearAlmacen(conectar(dbUrl)) : null,
  apiKeyDe: (ref) => leerApiKey((k) => Deno.env.get(k), ref),
  consultar: (apiKey, id) => consultarTransaccion(fetch, apiKey, id),
  log: (registro) => console.log(JSON.stringify(registro)),
}));
