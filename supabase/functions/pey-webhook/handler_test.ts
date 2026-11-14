// Pruebas unitarias sin red: firma, interpretación de los tres eventos,
// confirmación con pey simulado y registro sin datos del pagador.
import { crearHandler, Dependencias } from "./handler.ts";
import { interpretarEvento } from "./evento.ts";
import { leerApiKey, leerTransaccion } from "./pey.ts";
import { Almacen, Anomalia, Pago } from "./store.ts";
import {
  assert,
  DATOS_PAGADOR,
  eventoCodi,
  eventoLink,
  igual,
  peticionFirmada,
  SECRETO_PRUEBA,
  transaccionPey,
} from "./test_helpers.ts";

const PAGO_ID = "11111111-1111-4111-8111-111111111111";
const TX = "01KTRANSACCIONFICTICIA0001";

function pagoBase(cambios: Partial<Pago> = {}): Pago {
  return {
    id: PAGO_ID,
    numRef: 1401,
    solicitudId: "22222222-2222-4222-8222-222222222222",
    tiendaId: "33333333-3333-4333-8333-333333333333",
    montoCentavos: 1,
    metodo: "qr",
    estado: "creado",
    peyTransaccionId: null,
    peyIds: ["QRFICTICIO"],
    credencialRef: "PEY_TIENDA_TEST",
    ...cambios,
  };
}

function entorno(opciones: {
  pagos?: Pago[];
  transaccion?: unknown;
  httpPey?: number;
  secreto?: string | undefined;
} = {}) {
  const logs: Record<string, unknown>[] = [];
  const anomalias: Anomalia[] = [];
  const confirmados: string[] = [];
  const consultas: string[] = [];
  let pagos = opciones.pagos ?? [pagoBase()];
  const almacen: Almacen = {
    buscarPagos: (pistas) => {
      return Promise.resolve(
        pagos.filter((p) =>
          pistas.pagoIds.includes(p.id) || pistas.numRefs.includes(p.numRef) ||
          p.peyTransaccionId === pistas.transactionId
        ),
      );
    },
    registrarAnomalia: (_id, a) => {
      anomalias.push(a);
      return Promise.resolve();
    },
    confirmar: ({ pagoId, transaccion }) => {
      const p = pagos.find((x) => x.id === pagoId)!;
      if (p.estado === "pagado") {
        return Promise.resolve(
          p.peyTransaccionId === transaccion.id
            ? { tipo: "duplicado" as const }
            : { tipo: "anomalia" as const, motivo: "otra" },
        );
      }
      pagos = pagos.map((x) =>
        x.id === pagoId
          ? { ...x, estado: "pagado", peyTransaccionId: transaccion.id }
          : x
      );
      confirmados.push(transaccion.id);
      return Promise.resolve({
        tipo: "confirmado" as const,
        folio: "AGORA-0001401",
      });
    },
  };
  const deps: Dependencias = {
    secreto: "secreto" in opciones ? opciones.secreto : SECRETO_PRUEBA,
    almacen,
    apiKeyDe: (ref) => ref === "PEY_TIENDA_TEST" ? "clave-ficticia" : null,
    consultar: (_k, id) => {
      consultas.push(id);
      if (opciones.httpPey === 404) {
        return Promise.resolve({ tipo: "no_encontrada" });
      }
      if (opciones.httpPey) {
        return Promise.resolve({ tipo: "error", http: opciones.httpPey });
      }
      const t = leerTransaccion(
        opciones.transaccion ??
          transaccionPey({ id, pagoId: PAGO_ID, numRef: 1401 }),
      );
      return Promise.resolve(
        t ? { tipo: "ok", transaccion: t } : { tipo: "error", http: 200 },
      );
    },
    log: (r) => logs.push(r),
  };
  return {
    handler: crearHandler(deps),
    logs,
    anomalias,
    confirmados,
    consultas,
  };
}

const qr = () =>
  eventoCodi("qr", { transactionId: TX, pagoId: PAGO_ID, numRef: 1401 });

Deno.test("firma: rechaza firma falsa, sin headers, vieja y secreto ausente", async () => {
  const e = entorno();
  const falsa = await peticionFirmada(qr(), {
    secreto: "whsec_" + btoa("otro-secreto"),
  });
  igual((await e.handler(falsa)).status, 401);
  const sinHeaders = new Request("http://x", { method: "POST", body: "{}" });
  igual((await e.handler(sinHeaders)).status, 401);
  const vieja = await peticionFirmada(qr(), {
    ahora: Date.now() - 10 * 60 * 1000,
  });
  igual((await e.handler(vieja)).status, 401);
  // Cuerpo alterado tras firmar.
  const original = await peticionFirmada(qr());
  const alterada = new Request(original.url, {
    method: "POST",
    headers: original.headers,
    body: JSON.stringify({ ...qr(), amount: 999 }),
  });
  igual((await e.handler(alterada)).status, 401);
  const sinSecreto = entorno({ secreto: undefined });
  igual((await sinSecreto.handler(await peticionFirmada(qr()))).status, 503);
  igual(e.confirmados.length + e.consultas.length, 0);
});

Deno.test("QR válido: confirma con pey y financia una vez; el repetido no", async () => {
  const e = entorno();
  const id = "msg_repetido";
  igual(
    (await e.handler(await peticionFirmada(qr(), { webhookId: id }))).status,
    200,
  );
  igual(
    (await e.handler(await peticionFirmada(qr(), { webhookId: id }))).status,
    200,
  );
  igual((await e.handler(await peticionFirmada(qr()))).status, 200);
  igual(e.confirmados, [TX]);
  // El repetido ya no consulta pey.
  igual(e.consultas, [TX]);
  igual(
    e.logs.map((l) => (l.resultados as { resultado: string }[])[0].resultado),
    ["confirmado", "duplicado", "duplicado"],
  );
});

Deno.test("push correlaciona por numRef y payment link por clientReferenceId", async () => {
  const push = entorno({
    pagos: [pagoBase({ metodo: "push", peyIds: [] })],
    transaccion: transaccionPey({
      id: TX,
      payableType: "API_CODI_PN",
      numRef: 1401,
      pagoId: PAGO_ID,
    }),
  });
  const ev = eventoCodi("pn", { transactionId: TX, numRef: 1401 });
  igual((await push.handler(await peticionFirmada(ev))).status, 200);
  igual(push.confirmados, [TX]);

  const link = entorno({
    pagos: [pagoBase({ metodo: "link", peyIds: [] })],
    transaccion: transaccionPey({
      id: TX,
      payableType: "PAYMENT_LINK",
      payableId: "01LINK",
      pagoId: PAGO_ID,
    }),
  });
  const evLink = eventoLink({
    transactionIds: [TX],
    clientReferenceId: PAGO_ID,
  });
  igual((await link.handler(await peticionFirmada(evLink))).status, 200);
  igual(link.confirmados, [TX]);
  igual(link.consultas, [TX]);
});

Deno.test("link no pagado, tipo desconocido y JSON inválido no financian", async () => {
  const e = entorno();
  const pendiente = eventoLink({
    transactionIds: [TX],
    clientReferenceId: PAGO_ID,
    status: "pending",
  });
  igual((await e.handler(await peticionFirmada(pendiente))).status, 200);
  igual(
    (await e.handler(await peticionFirmada({ type: "otro.evento" }))).status,
    200,
  );
  igual((await e.handler(await peticionFirmada("no-json"))).status, 400);
  igual(e.consultas.length + e.confirmados.length, 0);
});

Deno.test("numRef desconocido: se registra y no financia", async () => {
  const e = entorno();
  const ev = eventoCodi("qr", { transactionId: TX, numRef: 9999 });
  igual((await e.handler(await peticionFirmada(ev))).status, 200);
  igual(e.confirmados.length + e.consultas.length, 0);
  igual(
    (e.logs[0].resultados as { resultado: string }[])[0].resultado,
    "pago_desconocido",
  );
});

Deno.test("anomalías confirmadas por pey se anotan y no financian", async () => {
  const casos: [unknown, string][] = [
    [
      transaccionPey({ id: TX, base: 0.02, amount: 0.02, pagoId: PAGO_ID }),
      "monto_distinto",
    ],
    [
      transaccionPey({ id: TX, currency: "USD", pagoId: PAGO_ID }),
      "moneda_distinta",
    ],
    [
      transaccionPey({
        id: TX,
        pagoId: "44444444-4444-4444-8444-444444444444",
      }),
      "correlacion_distinta",
    ],
    [
      transaccionPey({ id: TX, payableId: "OTRO" }),
      "correlacion_no_confirmada",
    ],
    [
      transaccionPey({ id: TX, pagoId: PAGO_ID, payableType: "PAYMENT_LINK" }),
      "metodo_distinto",
    ],
    [
      transaccionPey({ id: "01KOTRATRANSACCION00000000", pagoId: PAGO_ID }),
      "transaccion_inconsistente",
    ],
  ];
  for (const [transaccion, motivo] of casos) {
    const e = entorno({ transaccion });
    igual((await e.handler(await peticionFirmada(qr()))).status, 200);
    igual(e.confirmados, []);
    igual(e.anomalias.map((a) => a.motivo), [motivo]);
  }
  // Propina en link: se cobra el base reservado; no es anomalía.
  const conPropina = entorno({
    transaccion: transaccionPey({
      id: TX,
      amount: 0.05,
      base: 0.01,
      pagoId: PAGO_ID,
    }),
  });
  igual((await conPropina.handler(await peticionFirmada(qr()))).status, 200);
  igual(conPropina.confirmados, [TX]);
});

Deno.test("PENDING, pey caído o credencial ausente: 503 sin financiar ni liberar", async () => {
  const pend = entorno({
    transaccion: transaccionPey({ id: TX, status: "PENDING", pagoId: PAGO_ID }),
  });
  igual((await pend.handler(await peticionFirmada(qr()))).status, 503);
  const caido = entorno({ httpPey: 500 });
  igual((await caido.handler(await peticionFirmada(qr()))).status, 503);
  const sinCred = entorno({
    pagos: [pagoBase({ credencialRef: "NO_EXISTE" })],
  });
  igual((await sinCred.handler(await peticionFirmada(qr()))).status, 503);
  const noEncontrada = entorno({ httpPey: 404 });
  igual((await noEncontrada.handler(await peticionFirmada(qr()))).status, 200);
  igual(noEncontrada.anomalias.map((a) => a.motivo), [
    "transaccion_no_encontrada",
  ]);
  for (const e of [pend, caido, sinCred, noEncontrada]) {
    igual(e.confirmados, []);
  }
});

Deno.test("logs sin datos bancarios del pagador ni credenciales", async () => {
  const e = entorno();
  await e.handler(await peticionFirmada(qr()));
  await e.handler(
    await peticionFirmada(
      eventoLink({ transactionIds: [TX], clientReferenceId: PAGO_ID }),
    ),
  );
  const texto = JSON.stringify(e.logs);
  // accountType (40) es demasiado corto para buscarlo como texto; su valor se
  // redacta igual que el resto por la lista de campos permitidos.
  for (
    const valor of Object.values(DATOS_PAGADOR).map(String).filter((v) =>
      v.length >= 5
    )
  ) {
    assert(!texto.includes(valor), `log contiene ${valor}`);
  }
  assert(!/"accountType":40/.test(texto));
  assert(!texto.includes("clave-ficticia"));
  assert(!texto.includes(SECRETO_PRUEBA.slice(6)));
});

Deno.test("interpretarEvento: pistas de las tres vías y transacciones del link", () => {
  const qrEv = interpretarEvento(qr());
  assert(qrEv.tipo === "pago");
  igual(qrEv.candidatos, [{
    transactionId: TX,
    pagoIds: [PAGO_ID],
    numRefs: [1401],
  }]);
  const link = interpretarEvento(
    eventoLink({
      transactionIds: [TX, "01KSEGUNDA"],
      clientReferenceId: PAGO_ID,
    }),
  );
  assert(link.tipo === "pago");
  igual(link.candidatos.map((c) => c.transactionId), [TX, "01KSEGUNDA"]);
  igual(link.candidatos[0].pagoIds, [PAGO_ID]);
  const malo = interpretarEvento({
    type: "codi.qr.payment_received",
    transactionId: "../x",
  });
  igual(malo.tipo, "ignorado");
});

Deno.test("leerApiKey y leerTransaccion validan formato", () => {
  igual(leerApiKey(() => '{"apiKey":"k"}', "PEY_TIENDA"), "k");
  igual(leerApiKey(() => '{"apiKey":"k"}', "minusculas"), null);
  igual(leerApiKey(() => "no-json", "PEY_TIENDA"), null);
  const t = leerTransaccion(
    transaccionPey({ id: TX, pagoId: PAGO_ID, numRef: 7 }),
  );
  igual(t?.montoBaseCentavos, 1);
  igual(t?.metodo, "qr");
  igual(t?.numRef, 7);
  igual(leerTransaccion({ id: TX }), null);
});
