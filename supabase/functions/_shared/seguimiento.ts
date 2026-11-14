const encoder = new TextEncoder();
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0"))
    .join("");
export function seguimiento(secret: string) {
  if (secret.length < 32) {
    throw new Error(
      "AGORA_SEGUIMIENTO_SECRET requiere al menos 32 caracteres.",
    );
  }
  const key = crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return {
    async emitir(pagoId: string, now = Date.now()) {
      const payload = `${pagoId}.${Math.floor(now / 1000) + 604800}`;
      return `${payload}.${
        hex(
          await crypto.subtle.sign("HMAC", await key, encoder.encode(payload)),
        )
      }`;
    },
    async verificar(token: string, now = Date.now()): Promise<string | null> {
      const parts = token.split(".");
      if (
        parts.length !== 3 || !/^[0-9a-f-]{36}$/.test(parts[0]) ||
        !/^\d{10}$/.test(parts[1]) || !/^[0-9a-f]{64}$/.test(parts[2])
      ) return null;
      const expires = Number(parts[1]);
      if (
        expires <= Math.floor(now / 1000) ||
        expires > Math.floor(now / 1000) + 604800
      ) return null;
      const signature = Uint8Array.from(
        parts[2].match(/../g)!,
        (b) => parseInt(b, 16),
      );
      const valid = await crypto.subtle.verify(
        "HMAC",
        await key,
        signature,
        encoder.encode(`${parts[0]}.${parts[1]}`),
      );
      return valid ? parts[0] : null;
    },
  };
}
