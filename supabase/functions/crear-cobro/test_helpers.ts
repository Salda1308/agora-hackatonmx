export function assert(
  value: unknown,
  message = "Falló una comprobación",
): asserts value {
  if (!value) throw new Error(message);
}
export function igual(actual: unknown, expected: unknown) {
  const normalizar = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalizar);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map((
          [k, v],
        ) => [k, normalizar(v)]),
      );
    }
    return value;
  };
  assert(
    JSON.stringify(normalizar(actual)) === JSON.stringify(normalizar(expected)),
    "El resultado no coincide con el esperado",
  );
}
