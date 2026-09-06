const COOKIE = '__Host-elo-host';
const encoder = new TextEncoder();
const lifetime = 7 * 24 * 60 * 60;
async function signingKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}
const hex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
export async function issueHostCookie(secret: string) {
  const expiry = Math.floor(Date.now() / 1000) + lifetime;
  const nonce = crypto.randomUUID();
  const payload = `elo-host:${expiry}:${nonce}`;
  const signature = hex(
    await crypto.subtle.sign(
      'HMAC',
      await signingKey(secret),
      encoder.encode(payload),
    ),
  );
  return `${COOKIE}=${expiry}.${nonce}.${signature}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${lifetime}`;
}
export async function hasHostSession(request: Request, secret: string) {
  if (secret.length < 32) return false;
  const value = request.headers
    .get('cookie')
    ?.split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith(COOKIE + '='))
    ?.slice(COOKIE.length + 1);
  if (!value || value.length > 150) return false;
  const [expiry, nonce, signature, ...extra] = value.split('.');
  if (
    extra.length ||
    !/^\d{10}$/.test(expiry) ||
    !/^[-a-f0-9]{36}$/.test(nonce ?? '') ||
    !/^[a-f0-9]{64}$/.test(signature ?? '')
  )
    return false;
  const now = Math.floor(Date.now() / 1000);
  if (Number(expiry) <= now || Number(expiry) > now + lifetime) return false;
  const bytes = new Uint8Array(
    signature.match(/../g)!.map((x) => parseInt(x, 16)),
  );
  return crypto.subtle.verify(
    'HMAC',
    await signingKey(secret),
    bytes,
    encoder.encode(`elo-host:${expiry}:${nonce}`),
  );
}
