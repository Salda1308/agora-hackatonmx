import {
  Almacen,
  ErrorCobro,
  Metodo,
  Reserva,
  ResultadoPey,
  validarEntrada,
} from "./domain.ts";
import { crearClaveOrigen, crearHandler, ipDe } from "./handler.ts";
import { Configuracion, leerCuenta } from "./pey.ts";
import { assert, igual } from "./test_helpers.ts";

const SOL = "10000000-0000-4000-8000-000000000001";
const ART = "20000000-0000-4000-8000-000000000001";
const base = (metodo: Metodo = "qr") => ({
  solicitudId: SOL,
  metodo,
  articulos: [{ solicitudArticuloId: ART, unidades: 1 }],
  ...(metodo === "push" ? { phoneNumber: "0000000000" } : {}),
});
const config: Configuracion = {
  cuenta: () => ({ apiKey: "fake-test-key", useLinkedAccount: true }),
  maximoCentavos: 1,
  successUrl: "https://example.com/exito",
  backUrl: "https://example.com/volver",
};
function request(body: unknown, method = "POST") {
  return new Request("https://example.com/crear-cobro", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}
function fixture(
  fetcher: typeof fetch,
  options: {
    failSave?: boolean;
    failMark?: boolean;
    emitirSeguimiento?: (id: string) => Promise<string>;
  } = {},
) {
  const attempts: string[] = [];
  const saved: ResultadoPey[] = [];
  let calls = 0;
  const almacen: Almacen = {
    reservar(input, validate) {
      calls++;
      validate("PEY_TIENDA_TEST");
      return Promise.resolve({
        id: "30000000-0000-4000-8000-000000000001",
        numRef: 31,
        solicitudId: SOL,
        tiendaId: "40000000-0000-4000-8000-000000000001",
        montoCentavos: 1,
        metodo: input.metodo,
        articulos: input.articulos,
        concept: "Agora solicitud ref31 1art",
        credencialRef: "PEY_TIENDA_TEST",
      });
    },
    guardarResultado(_r: Reserva, result: ResultadoPey) {
      if (options.failSave) throw new Error("Fallo de persistencia simulado");
      saved.push(result);
      return Promise.resolve();
    },
    marcarIntento(_r, state) {
      if (options.failMark) throw new Error("Fallo de persistencia simulado");
      attempts.push(state);
      return Promise.resolve();
    },
  };
  return {
    handler: crearHandler(almacen, config, fetcher, options.emitirSeguimiento),
    attempts,
    saved,
    calls: () => calls,
  };
}
const neverFetch: typeof fetch = () => {
  throw new Error("No debe llamar a pey");
};

Deno.test("rechaza monto, precio, metadata, cuenta, duplicados y cantidades inválidas antes de reservar", async () => {
  const bad: unknown[] = [
    null,
    [],
    { ...base(), amount: .01 },
    { ...base(), montoCentavos: 1 },
    { ...base(), numRef: "7" },
    { ...base(), metadata: {} },
    { ...base(), bankAccountId: "otra" },
    { ...base(), articulos: [{ ...base().articulos[0], precio: 1 }] },
    { ...base(), articulos: [base().articulos[0], base().articulos[0]] },
    ...[0, -1, .5, "1", 2147483648].map((unidades) => ({
      ...base(),
      articulos: [{ solicitudArticuloId: ART, unidades }],
    })),
    { ...base(), articulos: [] },
    { ...base(), articulos: Array(11).fill(base().articulos[0]) },
    { ...base(), solicitudId: "no-uuid" },
    { ...base(), metodo: "efectivo" },
    { ...base("push"), phoneNumber: undefined },
    { ...base("push"), phoneNumber: "123" },
    { ...base(), phoneNumber: "0000000000" },
  ];
  const f = fixture(neverFetch);
  for (const input of bad) igual((await f.handler(request(input))).status, 400);
  igual(f.calls(), 0);
});

Deno.test("normaliza UUID y rechaza duplicados con mayúsculas", () => {
  const id = "abcdef00-0000-4000-8000-000000000001";
  igual(
    validarEntrada({
      ...base(),
      solicitudId: SOL.toUpperCase(),
      articulos: [{ solicitudArticuloId: id.toUpperCase(), unidades: 1 }],
    }).articulos[0].solicitudArticuloId,
    id,
  );
  let rejected = false;
  try {
    validarEntrada({
      ...base(),
      articulos: [{ solicitudArticuloId: id, unidades: 1 }, {
        solicitudArticuloId: id.toUpperCase(),
        unidades: 1,
      }],
    });
  } catch {
    rejected = true;
  }
  assert(rejected);
});

Deno.test("CORS, método, tipo, JSON y límite de cuerpo", async () => {
  const f = fixture(neverFetch);
  igual((await f.handler(request(null, "OPTIONS"))).status, 204);
  igual((await f.handler(request(null, "GET"))).status, 405);
  igual(
    (await f.handler(
      new Request("https://example.com", { method: "POST", body: "x" }),
    )).status,
    415,
  );
  const json = (body: string) =>
    new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  igual((await f.handler(json("{"))).status, 400);
  igual((await f.handler(json(" ".repeat(17000)))).status, 413);
  igual(f.calls(), 0);
});

for (const metodo of ["qr", "push", "link"] as const) {
  Deno.test(`${metodo}: contrato pey y respuesta pública sin datos extra`, async () => {
    let called = 0;
    const f = fixture((url, init) => {
      called++;
      assert(
        String(url).endsWith(
          metodo === "qr"
            ? "/codi/qr"
            : metodo === "push"
            ? "/codi/pn"
            : "/payment-link/create",
        ),
      );
      const body = JSON.parse(String(init?.body));
      igual(body.amount, .01);
      igual(body.metadata.pago_id, "30000000-0000-4000-8000-000000000001");
      igual(body.metadata.articulo_1, `${ART}:1`);
      assert(
        Object.values(body.metadata).every((v) =>
          typeof v === "string" && v.length <= 500
        ),
      );
      if (metodo === "link") {
        igual(body.hasTip, false);
        igual(body.clientReferenceId, body.metadata.pago_id);
        assert(!("numRef" in body));
      } else {
        igual(body.numRef, "31");
        igual(body.expiration, 600);
      }
      if (metodo === "push") igual(body.phoneNumber, "0000000000");
      else assert(!("phoneNumber" in body));
      if (metodo === "qr") igual(body.generateImage, true);
      return Promise.resolve(Response.json({
        ...(metodo === "qr"
          ? { id: "QR_TEST", qrString: "qr-test", qrImage: "png-test" }
          : metodo === "push"
          ? { transactionId: "TRANSACTION_TEST", codiId: "CODI_TEST" }
          : {
            id: "LINK_TEST",
            url: "https://app.mipey.mx/checkout/payment-link/test",
          }),
        privateField: "must-be-discarded",
      }));
    });
    const response = await f.handler(request(base(metodo)));
    igual(response.status, 201);
    igual(response.headers.get("cache-control"), "no-store");
    const text = await response.text();
    assert(
      !text.includes("privateField") && !text.includes("fake-test-key") &&
        !text.includes('0000000000"'),
    );
    igual(called, 1);
    igual(f.saved.length, 1);
    igual(f.attempts, []);
  });
}

Deno.test("QR válido con qrImage null se entrega sin duplicar cobro", async () => {
  const f = fixture(() =>
    Promise.resolve(
      Response.json({ id: "QR_TEST", qrString: "payload", qrImage: null }),
    )
  );
  const response = await f.handler(request(base()));
  igual(response.status, 201);
  igual((await response.json()).qrImage, null);
});

Deno.test("rechazo definitivo libera; timeout, 500, 429 y respuesta inválida conservan reserva sin reintentar", async () => {
  for (
    const [fetcher, status, expected] of [
      [
        () =>
          Promise.resolve(
            Response.json({
              error: { type: "INVALID_AMOUNT", message: "private" },
            }, { status: 400 }),
          ),
        502,
        "rechazado",
      ],
      [
        () => Promise.resolve(Response.json({}, { status: 403 })),
        502,
        "rechazado",
      ],
      [
        () => Promise.reject(new Error("simulated-private-error")),
        202,
        "incierto",
      ],
      [
        () => Promise.resolve(Response.json({}, { status: 500 })),
        202,
        "incierto",
      ],
      [
        () => Promise.resolve(Response.json({}, { status: 429 })),
        202,
        "incierto",
      ],
      [
        () => Promise.resolve(Response.json({}, { status: 400 })),
        202,
        "incierto",
      ],
      [() => Promise.resolve(new Response("bad json")), 202, "incierto"],
      [
        () => Promise.resolve(Response.json({ id: "missing-qr" })),
        202,
        "incierto",
      ],
    ] as const
  ) {
    let calls = 0;
    const f = fixture(() => {
      calls++;
      return fetcher();
    });
    const response = await f.handler(request(base()));
    igual(response.status, status);
    igual(f.attempts, [expected]);
    igual(calls, 1);
    assert(!(await response.text()).includes("private"));
  }
});

Deno.test("fallo al guardar un cobro ya creado devuelve incertidumbre", async () => {
  const f = fixture(
    () => Promise.resolve(Response.json({ id: "qr", qrString: "payload" })),
    { failSave: true },
  );
  igual((await f.handler(request(base()))).status, 202);
  igual(f.attempts, ["incierto"]);
  const g = fixture(
    () =>
      Promise.resolve(
        Response.json({ error: { type: "INVALID_AMOUNT" } }, { status: 400 }),
      ),
    { failMark: true },
  );
  igual((await g.handler(request(base()))).status, 202);
});

Deno.test("credencial de tienda exige destino explícito; link exige cuenta vinculada", () => {
  let rejected = 0;
  for (
    const [secret, ref, metodo] of [
      [undefined, "PEY_TEST", "qr"],
      ["{", "PEY_TEST", "qr"],
      ['{"apiKey":"fake"}', "PEY_TEST", "qr"],
      [
        '{"apiKey":"fake","bankAccountId":"01ARZ3NDEKTSV4RRFFQ69G5FAV"}',
        "PEY_TEST",
        "link",
      ],
      ['{"apiKey":"fake","useLinkedAccount":true}', "bad-ref", "qr"],
    ] as const
  ) {
    try {
      leerCuenta(() => secret, ref, metodo);
    } catch {
      rejected++;
    }
  }
  igual(rejected, 5);
  igual(
    leerCuenta(
      () => '{"apiKey":"fake","useLinkedAccount":true}',
      "PEY_TEST",
      "link",
    ).useLinkedAccount,
    true,
  );
});

Deno.test("URL de checkout inválida y redirección insegura no se entregan", async () => {
  for (
    const url of [
      "http://app.mipey.mx/x",
      "https://evil.example/x",
      "https://fake@app.mipey.mx/x",
    ]
  ) {
    const f = fixture(() =>
      Promise.resolve(Response.json({ id: "link", url }))
    );
    igual((await f.handler(request(base("link")))).status, 202);
  }
});

Deno.test("token de seguimiento acompaña 201, 202 y 502 sin enviarse a pey", async () => {
  for (const status of [201, 202, 502]) {
    const f = fixture((_url, init) => {
      assert(!String(init?.body).includes("signed-token"));
      if (status === 202) throw new Error("timeout simulado");
      return Promise.resolve(
        status === 201
          ? Response.json({ id: "QR_TEST", qrString: "payload", qrImage: null })
          : Response.json({}, { status: 403 }),
      );
    }, { emitirSeguimiento: (id) => Promise.resolve(`signed-token-${id}`) });
    const response = await f.handler(request(base()));
    igual(response.status, status);
    const body = await response.json();
    igual(body.seguimientoToken, `signed-token-${body.pagoId}`);
  }
});

Deno.test("T20: la clave de origen es un HMAC de la IP y llega al almacén", async () => {
  const clave = crearClaveOrigen("x".repeat(32));
  const conIp = (headers: Record<string, string>) =>
    new Request("https://example.com/crear-cobro", { method: "POST", headers });
  igual(
    ipDe(conIp({ "x-forwarded-for": " 203.0.113.9 , 10.0.0.1" })),
    "203.0.113.9",
  );
  igual(
    ipDe(
      conIp({
        "cf-connecting-ip": "198.51.100.7",
        "x-forwarded-for": "1.1.1.1",
      }),
    ),
    "198.51.100.7",
  );
  igual(ipDe(conIp({})), null);
  igual(await clave(conIp({})), null);
  const a = await clave(conIp({ "x-real-ip": "203.0.113.9" }));
  assert(a && /^[0-9a-f]{64}$/.test(a) && !a.includes("203"));
  igual(await clave(conIp({ "x-forwarded-for": "203.0.113.9" })), a);
  assert(a !== await clave(conIp({ "x-real-ip": "203.0.113.10" })));

  const vistos: (string | undefined)[] = [];
  const almacen: Almacen = {
    reservar(_input, _validate, origen) {
      vistos.push(origen);
      return Promise.reject(
        new ErrorCobro(
          429,
          "DEMASIADOS_INTENTOS",
          "Demasiados intentos de pago. Espera unos minutos.",
        ),
      );
    },
    guardarResultado: () => Promise.resolve(),
    marcarIntento: () => Promise.resolve(),
  };
  const handler = crearHandler(almacen, config, neverFetch, undefined, clave);
  const req = request(base());
  req.headers.set("x-real-ip", "203.0.113.9");
  const res = await handler(req);
  igual(res.status, 429);
  igual((await res.json()).error.codigo, "DEMASIADOS_INTENTOS");
  igual(vistos, [a]);
});
