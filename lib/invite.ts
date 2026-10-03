export type Invite = { id: string; invite: string; key: string };

const uuidPattern =
  /^([a-f0-9]{8})-([a-f0-9]{4})-([a-f0-9]{4})-([a-f0-9]{4})-([a-f0-9]{12})$/i;
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeBase64Url(
  value: string,
  expectedBytes: number,
): Uint8Array | null {
  if (!base64UrlPattern.test(value)) return null;
  try {
    const padded =
      value.replace(/-/g, '+').replace(/_/g, '/') +
      '='.repeat((4 - (value.length % 4)) % 4);
    const binary = atob(padded);
    if (binary.length !== expectedBytes) return null;
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    return encodeBase64Url(bytes) === value ? bytes : null;
  } catch {
    return null;
  }
}

function encodeHex(value: string): string {
  if (!/^(?:[a-f0-9]{2})+$/i.test(value))
    throw new Error('Invalid hexadecimal value');
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2)
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  return encodeBase64Url(bytes);
}

function decodeHex(value: string, expectedBytes: number): string | null {
  const bytes = decodeBase64Url(value, expectedBytes);
  return bytes
    ? Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    : null;
}

function compactRoomId(id: string): string {
  const groups = id.match(uuidPattern);
  if (!groups) throw new Error('Invalid room ID');
  return encodeHex(groups.slice(1).join(''));
}

function expandRoomId(value: string): string | null {
  const hex = decodeHex(value, 16);
  return hex
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : null;
}

export function parseInvite(fragment: string, pathname = ''): Invite | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const shortId = pathname.match(/^\/room\/([A-Za-z0-9_-]{22})\/?$/)?.[1];
  if (shortId) {
    const id = expandRoomId(shortId);
    const invite = decodeHex(params.get('c') ?? '', 32);
    const key = decodeHex(params.get('k') ?? '', 32);
    return id && invite && key ? { id, invite, key } : null;
  }

  const id = params.get('r') ?? '';
  const invite = params.get('c') ?? '';
  const key = params.get('k') ?? '';
  return /^[a-f0-9-]{36}$/.test(id) &&
    /^[a-f0-9]{64}$/.test(invite) &&
    /^[a-f0-9]{64}$/.test(key)
    ? { id, invite, key }
    : null;
}
export function inviteFragment(invite: Invite) {
  return (
    '#' +
    new URLSearchParams({
      r: invite.id,
      c: invite.invite,
      k: invite.key,
    }).toString()
  );
}

export function inviteUrl(invite: Invite): string {
  if (
    !/^[a-f0-9]{64}$/i.test(invite.invite) ||
    !/^[a-f0-9]{64}$/i.test(invite.key)
  )
    throw new Error('Invalid invite secret');
  const compactId = compactRoomId(invite.id);
  const compactInvite = encodeHex(invite.invite);
  const compactKey = encodeHex(invite.key);
  return `/room/${compactId}#${new URLSearchParams({ c: compactInvite, k: compactKey })}`;
}
export async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const result = (await response.json()) as { error?: string };
  if (!response.ok)
    throw new Error(
      result.error ?? 'Não foi possível concluir. Tente novamente.',
    );
  return result as T;
}
