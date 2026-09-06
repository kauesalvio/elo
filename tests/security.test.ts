import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { env } from './runtime';
import { TokenVerifier } from 'livekit-server-sdk';
import {
  apiError,
  hash,
  randomSecret,
  readBody,
  shortText,
} from '../lib/security';
import { inviteFragment, parseInvite } from '../lib/invite';
import {
  authorize,
  closeRoom,
  configured,
  createRoom,
  joinRoom,
  rateLimit,
} from '../lib/server';

const service = vi.hoisted(() => ({
  createRoom: vi.fn().mockResolvedValue({}),
  deleteRoom: vi.fn().mockResolvedValue({}),
}));
vi.mock('livekit-server-sdk', async (importOriginal) => ({
  ...(await importOriginal<typeof import('livekit-server-sdk')>()),
  RoomServiceClient: class {
    createRoom = service.createRoom;
    deleteRoom = service.deleteRoom;
  },
}));
let sqlite: DatabaseSync;
beforeEach(() => {
  sqlite?.close();
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    readFileSync(
      new URL('../drizzle/0000_milky_satana.sql', import.meta.url),
      'utf8',
    ),
  );
  const prepare = (sql: string, args: unknown[] = []) => ({
    bind: (...values: unknown[]) => prepare(sql, values),
    first: async () =>
      sqlite.prepare(sql).get(...(args as (string | number)[])) ?? null,
    run: async () => sqlite.prepare(sql).run(...(args as (string | number)[])),
  });
  Object.assign(env, {
    DB: { prepare },
    LIVEKIT_URL: 'wss://test.invalid',
    LIVEKIT_API_KEY: 'test-api',
    LIVEKIT_API_SECRET: 'test-secret-with-32-characters-minimum',
    ELO_HOST_KEY: 'h'.repeat(64),
  });
  service.createRoom.mockClear();
  service.deleteRoom.mockReset().mockResolvedValue({});
});
function request(body: unknown = {}, origin = 'https://elo.test') {
  return new Request('https://elo.test/api/rooms', {
    method: 'POST',
    headers: {
      origin,
      'content-type': 'application/json',
      'cf-connecting-ip': '192.0.2.1',
    },
    body: JSON.stringify(body),
  });
}
async function makeRoom() {
  return createRoom({ name: 'Turma', hostKey: env.ELO_HOST_KEY }, request());
}
describe('access control and media grants', () => {
  it('fails closed until server settings exist', () => {
    expect(configured()).toBe(true);
    env.LIVEKIT_API_SECRET = '';
    expect(configured()).toBe(false);
  });
  it('requires the host key and never creates media rooms for unauthorized clients', async () => {
    await expect(
      createRoom({ name: 'Turma', hostKey: 'wrong' }, request()),
    ).rejects.toMatchObject({ status: 403 });
    expect(service.createRoom).not.toHaveBeenCalled();
  });
  it('stores only hashes of invite and host secrets; caps participants on the media server', async () => {
    const room = await makeRoom();
    const row = sqlite.prepare('SELECT * FROM rooms').get()!;
    expect(row.invite_hash).toBe(await hash(room.invite));
    expect(row.admin_hash).toBe(await hash(room.admin));
    expect(JSON.stringify(row)).not.toContain(room.invite);
    expect(service.createRoom).toHaveBeenCalledWith(
      expect.objectContaining({ maxParticipants: 12 }),
    );
  });
  it('never lets an invite authorize another room or host actions', async () => {
    const first = await makeRoom(),
      second = await makeRoom();
    await expect(
      authorize({ id: second.id, invite: first.invite }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      closeRoom({ id: first.id, admin: first.invite }, request()),
    ).rejects.toMatchObject({ status: 403 });
    expect(service.deleteRoom).not.toHaveBeenCalled();
  });
  it('issues a short-lived JWT scoped to voice and screen only, with a fresh participant identity', async () => {
    const room = await makeRoom();
    const a = await joinRoom({ ...room, name: 'Amigo' }, request()),
      b = await joinRoom({ ...room, name: 'Amigo' }, request());
    const verifier = new TokenVerifier(
      String(env.LIVEKIT_API_KEY),
      String(env.LIVEKIT_API_SECRET),
    );
    const claims = await verifier.verify(a.token),
      other = await verifier.verify(b.token);
    expect(claims.video).toMatchObject({
      room: room.id,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: ['microphone', 'screen_share', 'screen_share_audio'],
    });
    expect(claims.video?.roomAdmin).toBeUndefined();
    expect(claims.sub).not.toBe(other.sub);
    expect(Number(claims.exp) - Number(claims.nbf)).toBeLessThanOrEqual(60);
    expect(a).not.toHaveProperty('key');
  });
  it('rejects expired and revoked invitations', async () => {
    const room = await makeRoom();
    sqlite
      .prepare('UPDATE rooms SET expires_at=? WHERE id=?')
      .run(Date.now() - 1, room.id);
    await expect(
      joinRoom({ ...room, name: 'Amigo' }, request()),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('closing disconnects the media room and revokes future tokens', async () => {
    const room = await makeRoom();
    await closeRoom({ id: room.id, admin: room.admin }, request());
    expect(service.deleteRoom).toHaveBeenCalledWith(room.id);
    await expect(
      joinRoom({ ...room, name: 'Amigo' }, request()),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('keeps invites revoked if the media provider fails and allows the host to retry', async () => {
    const room = await makeRoom();
    service.deleteRoom.mockRejectedValueOnce(new Error('provider offline'));
    await expect(
      closeRoom({ id: room.id, admin: room.admin }, request()),
    ).rejects.toThrow();
    await expect(authorize(room)).rejects.toMatchObject({ status: 403 });
    await expect(
      closeRoom({ id: room.id, admin: room.admin }, request()),
    ).resolves.toEqual({ closed: true });
  });
  it('enforces durable rate limits', async () => {
    for (let i = 0; i < 3; i++) await rateLimit(request(), 'test', 3, 60);
    await expect(rateLimit(request(), 'test', 3, 60)).rejects.toMatchObject({
      status: 429,
    });
  });
});
describe('request and invitation boundary', () => {
  it('rejects cross-origin requests even with a valid body', async () => {
    await expect(
      readBody(request({}, 'https://attacker.test')),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('limits streamed bodies without trusting Content-Length', async () => {
    await expect(
      readBody(request({ name: 'x'.repeat(5000) })),
    ).rejects.toMatchObject({ status: 413 });
  });
  it('rejects wrong content types and invalid shapes', async () => {
    const req = request({});
    req.headers.set('content-type', 'text/plain');
    await expect(readBody(req)).rejects.toMatchObject({ status: 415 });
    await expect(readBody(request([]))).rejects.toMatchObject({ status: 400 });
  });
  it('validates display names and strips control characters', () => {
    expect(shortText(' João\n ', 32)).toBe('João');
    expect(() => shortText(' '.repeat(5), 32)).toThrow();
    expect(() => shortText('a'.repeat(33), 32)).toThrow();
  });
  it('never leaks internal provider errors', async () => {
    const response = apiError(new Error('secret_key=private'));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('keeps the media key in the URL fragment and excludes host credentials', () => {
    const value = {
      id: crypto.randomUUID(),
      invite: randomSecret(),
      key: randomSecret(),
      admin: randomSecret(),
    };
    const fragment = inviteFragment(value);
    const url = new URL('https://elo.test/' + fragment);
    expect(url.search).toBe('');
    expect(fragment).not.toContain(value.admin);
    expect(parseInvite(fragment)).toEqual({
      id: value.id,
      invite: value.invite,
      key: value.key,
    });
    expect(parseInvite('#r=short&c=123&k=456')).toBeNull();
  });
});
