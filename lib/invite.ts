export type Invite = { id: string; invite: string; key: string };
export function parseInvite(fragment: string): Invite | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  const id = params.get('r') ?? '',
    invite = params.get('c') ?? '',
    key = params.get('k') ?? '';
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
