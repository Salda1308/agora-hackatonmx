import { seguimiento } from "../_shared/seguimiento.ts";
import { conectar } from "../crear-cobro/store.ts";
import { crearHandler, type Pago } from "./handler.ts";
const tokens = seguimiento(Deno.env.get("AGORA_SEGUIMIENTO_SECRET") ?? "");
const sql = conectar(Deno.env.get("SUPABASE_DB_URL") ?? "");
Deno.serve(crearHandler(tokens.verificar, async (id) => {
  const rows = await sql.begin(async (tx) => {
    await tx`set local role service_role`;
    await tx`set local statement_timeout = '5s'`;
    return await tx<
      Pago[]
    >`select id, solicitud_id, estado, monto_centavos, metodo, pagado_en, metadata from public.pagos where id = ${id}`;
  });
  return rows[0] ?? null;
}));
