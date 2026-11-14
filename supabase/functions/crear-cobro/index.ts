import { crearHandler } from "./handler.ts";
import { leerCuenta } from "./pey.ts";
import { conectar, crearAlmacen } from "./store.ts";

// SUPABASE_DB_URL lo proporciona el runtime. Una conexión SQL permite reservar
// pagos y pago_articulos atómicamente sin agregar RPCs ni cambiar políticas.
const sql = conectar(Deno.env.get("SUPABASE_DB_URL") ?? "");
const limite = Number(Deno.env.get("PEY_MAXIMO_CENTAVOS") ?? "1");
if (!Number.isSafeInteger(limite) || limite < 1 || limite > 100000000) {
  throw new Error(
    "PEY_MAXIMO_CENTAVOS debe ser un entero entre 1 y 100000000.",
  );
}

Deno.serve(crearHandler(crearAlmacen(sql, limite), {
  cuenta: (ref, metodo) => leerCuenta(Deno.env.get, ref, metodo),
  maximoCentavos: limite,
  successUrl: Deno.env.get("PEY_SUCCESS_URL") ?? "",
  backUrl: Deno.env.get("PEY_BACK_URL") ?? "",
}));
