export type Metodo = "qr" | "push" | "link";
export type Articulo = { solicitudArticuloId: string; unidades: number };
export type Entrada = {
  solicitudId: string;
  metodo: Metodo;
  articulos: Articulo[];
  phoneNumber?: string;
};

export class ErrorCobro extends Error {
  constructor(public status: number, public codigo: string, message: string) {
    super(message);
  }
}

export function objeto(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function invalida(): never {
  throw new ErrorCobro(
    400,
    "PETICION_INVALIDA",
    "Revisa los campos de la petición.",
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarEntrada(value: unknown): Entrada {
  if (!objeto(value)) invalida();
  // Lista cerrada: amount, precios, metadata, cuenta y numRef nunca vienen del cliente.
  if (
    Object.keys(value).some((k) =>
      !["solicitudId", "metodo", "articulos", "phoneNumber"].includes(k)
    )
  ) invalida();
  if (typeof value.solicitudId !== "string" || !UUID.test(value.solicitudId)) {
    invalida();
  }
  if (!["qr", "push", "link"].includes(value.metodo as string)) invalida();
  if (
    !Array.isArray(value.articulos) || value.articulos.length < 1 ||
    value.articulos.length > 10
  ) invalida();
  const articulos: Articulo[] = [];
  const ids = new Set<string>();
  for (const a of value.articulos) {
    if (
      !objeto(a) ||
      Object.keys(a).some((k) =>
        !["solicitudArticuloId", "unidades"].includes(k)
      )
    ) invalida();
    if (
      typeof a.solicitudArticuloId !== "string" ||
      !UUID.test(a.solicitudArticuloId)
    ) invalida();
    if (
      typeof a.unidades !== "number" || !Number.isSafeInteger(a.unidades) ||
      a.unidades < 1 || a.unidades > 2147483647
    ) invalida();
    const id = a.solicitudArticuloId.toLowerCase();
    if (ids.has(id)) invalida();
    ids.add(id);
    articulos.push({ solicitudArticuloId: id, unidades: a.unidades });
  }
  if (value.metodo === "push") {
    if (
      typeof value.phoneNumber !== "string" ||
      !/^[0-9]{10}$/.test(value.phoneNumber)
    ) invalida();
  } else if ("phoneNumber" in value) invalida();
  return {
    solicitudId: value.solicitudId.toLowerCase(),
    metodo: value.metodo as Metodo,
    articulos: articulos.sort((a, b) =>
      a.solicitudArticuloId.localeCompare(b.solicitudArticuloId)
    ),
    ...(value.metodo === "push"
      ? { phoneNumber: value.phoneNumber as string }
      : {}),
  };
}

export type Reserva = {
  id: string;
  numRef: number;
  solicitudId: string;
  tiendaId: string;
  montoCentavos: number;
  metodo: Metodo;
  articulos: Articulo[];
  concept: string;
  credencialRef: string;
};

export type ResultadoPey =
  | { metodo: "qr"; id: string; qrString: string; qrImage: string | null }
  | { metodo: "push"; transactionId: string; codiId: string }
  | { metodo: "link"; id: string; url: string };

export interface Almacen {
  reservar(
    entrada: Entrada,
    validarConfiguracion: (ref: string) => void,
  ): Promise<Reserva>;
  guardarResultado(reserva: Reserva, resultado: ResultadoPey): Promise<void>;
  marcarIntento(
    reserva: Reserva,
    estado: "rechazado" | "incierto",
  ): Promise<void>;
}
