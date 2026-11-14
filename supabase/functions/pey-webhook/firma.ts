// Standard Webhooks: HMAC-SHA256 sobre "id.timestamp.body", la llave es la
// parte base64 del secreto whsec_ y el header trae entradas "v1,<base64>".

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function firmar(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return bytesToBase64(mac);
}

export async function verificarFirma(
  secret: string,
  headers: Headers,
  body: string,
  ahoraSegundos: number,
): Promise<"valida" | "invalida" | "sin_headers"> {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return "sin_headers";
  if (!/^[0-9]{1,12}$/.test(timestamp)) return "invalida";
  if (Math.abs(ahoraSegundos - Number(timestamp)) > 300) return "invalida";

  let expected: string;
  try {
    expected = await firmar(secret, id, timestamp, body);
  } catch {
    return "invalida";
  }
  const ok = signatures
    .split(" ")
    .map((s) => s.split(",")[1] ?? "")
    .some((sig) => timingSafeEqual(sig, expected));
  return ok ? "valida" : "invalida";
}
