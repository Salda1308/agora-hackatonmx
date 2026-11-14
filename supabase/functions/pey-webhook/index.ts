// Receives pey webhooks (codi.qr.payment_received, codi.pn.payment_received,
// payment_link.status_updated), verifies the Standard Webhooks signature and
// confirms the transaction with GET /transaction/:id. It only logs a redacted
// summary: values of fields outside SAFE_KEYS (payer CLABE, bank, tracking key,
// names) are replaced by their type, so field names stay visible.
// Deploy with --no-verify-jwt: pey does not send a Supabase JWT.

const PEY_API = "https://api.pey.mx";
const SAFE_KEYS = new Set([
  "type",
  "amount",
  "codiQrId",
  "concept",
  "datePaid",
  "numRef",
  "transactionId",
  "paymentLinkId",
  "clientReferenceId",
  "status",
  "method",
  "paymentMethod",
  "externalMetadata",
  "createdAt",
  "updatedAt",
]);

function redact(value: unknown, keepScalars = false): unknown {
  if (Array.isArray(value)) return value.map((v) => redact(v, keepScalars));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        redact(v, keepScalars || SAFE_KEYS.has(k)),
      ]),
    );
  }
  return keepScalars || value === null ? value : `[${typeof value}]`;
}

function base64ToBytes(b64: string): Uint8Array {
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

// Standard Webhooks: HMAC-SHA256 over "id.timestamp.body", key is the base64
// part of the whsec_ secret, header carries "v1,<base64>" entries.
async function verifySignature(
  secret: string,
  headers: Headers,
  body: string,
): Promise<"valid" | "invalid" | "missing-headers"> {
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signatures = headers.get("webhook-signature");
  if (!id || !timestamp || !signatures) return "missing-headers";

  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return "invalid";

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
  const expected = bytesToBase64(mac);
  const ok = signatures
    .split(" ")
    .map((s) => s.split(",")[1] ?? "")
    .some((sig) => timingSafeEqual(sig, expected));
  return ok ? "valid" : "invalid";
}

async function fetchTransaction(id: string, apiKey: string) {
  const res = await fetch(`${PEY_API}/transaction/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const body = await req.text();
  const secret = Deno.env.get("PEY_WEBHOOK_SECRET");
  const apiKey = Deno.env.get("PEY_API_KEY");

  const signature = secret
    ? await verifySignature(secret, req.headers, body)
    : "no-secret-configured";

  let event: Record<string, unknown> | null = null;
  try {
    event = JSON.parse(body);
  } catch {
    console.log(JSON.stringify({ msg: "pey-webhook: invalid JSON", signature }));
    return new Response("bad request", { status: 400 });
  }

  const transactionId = typeof event?.transactionId === "string"
    ? event.transactionId
    : null;
  const transaction = transactionId && apiKey
    ? await fetchTransaction(transactionId, apiKey)
    : null;

  console.log(JSON.stringify({
    msg: "pey-webhook: received",
    signature,
    headerNames: [...req.headers.keys()].sort(),
    webhookId: req.headers.get("webhook-id"),
    event: redact(event),
    transaction: transaction
      ? { status: transaction.status, body: redact(transaction.body) }
      : null,
  }));

  if (signature === "invalid") {
    return new Response("invalid signature", { status: 401 });
  }
  return new Response("ok", { status: 200 });
});
