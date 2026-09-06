import { env } from 'cloudflare:workers';
import {
  AccessToken,
  RoomServiceClient,
  TrackSource,
} from 'livekit-server-sdk';
import {
  AppError,
  hash,
  randomSecret,
  roomId,
  secret,
  shortText,
} from './security';

type Config = {
  DB: D1Database;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  ELO_HOST_KEY?: string;
};
type RoomRow = {
  id: string;
  name: string;
  invite_hash: string;
  admin_hash: string;
  expires_at: number;
  revoked: number;
};
const config = () => env as unknown as Config;
export function configured() {
  const c = config();
  return !!(
    c.LIVEKIT_URL?.startsWith('wss://') &&
    c.LIVEKIT_API_KEY &&
    c.LIVEKIT_API_SECRET &&
    (c.ELO_HOST_KEY?.length ?? 0) >= 32
  );
}
function requireConfig() {
  if (!configured())
    throw new AppError(
      503,
      'O Elo ainda está sendo preparado. O responsável precisa conectar o serviço de chamadas.',
    );
  return config();
}
function db() {
  return config().DB;
}
function media() {
  const c = requireConfig();
  return new RoomServiceClient(
    c.LIVEKIT_URL!.replace(/^wss:/, 'https:'),
    c.LIVEKIT_API_KEY,
    c.LIVEKIT_API_SECRET,
  );
}

export async function rateLimit(
  request: Request,
  action: string,
  max: number,
  seconds: number,
) {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / seconds);
  const ip = request.headers.get('cf-connecting-ip') ?? 'local';
  const key = await hash(`${action}:${bucket}:${ip}`);
  const result = await db()
    .prepare(
      'INSERT INTO rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count',
    )
    .bind(key, now + seconds * 2)
    .first<{ count: number }>();
  if (!result || result.count > max)
    throw new AppError(
      429,
      'Muitas tentativas. Aguarde um pouco e tente novamente.',
    );
  await db()
    .prepare(
      'DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at < ? LIMIT 100)',
    )
    .bind(now)
    .run();
}
export async function createRoom(
  body: Record<string, unknown>,
  request: Request,
) {
  const c = requireConfig();
  await rateLimit(request, 'create', 10, 3600);
  if (
    typeof body.hostKey !== 'string' ||
    body.hostKey.length > 256 ||
    (await hash(body.hostKey)) !== (await hash(c.ELO_HOST_KEY!))
  )
    throw new AppError(
      403,
      'Chave do anfitrião inválida. Só o responsável pode criar salas.',
    );
  const name = shortText(body.name, 48);
  const id = crypto.randomUUID();
  const invite = randomSecret();
  const admin = randomSecret();
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  await media().createRoom({
    name: id,
    maxParticipants: 12,
    emptyTimeout: 300,
    departureTimeout: 120,
  });
  await db()
    .prepare(
      'INSERT INTO rooms (id,name,invite_hash,admin_hash,expires_at,revoked) VALUES (?,?,?,?,?,0)',
    )
    .bind(id, name, await hash(invite), await hash(admin), expiresAt)
    .run();
  await db()
    .prepare(
      'DELETE FROM rooms WHERE id IN (SELECT id FROM rooms WHERE expires_at < ? LIMIT 100)',
    )
    .bind(Date.now() - 86400000)
    .run();
  return { id, name, invite, admin, expiresAt };
}
export async function authorize(body: Record<string, unknown>, admin = false) {
  const id = roomId(body.id);
  const credential = secret(admin ? body.admin : body.invite);
  const row = await db()
    .prepare('SELECT * FROM rooms WHERE id=?')
    .bind(id)
    .first<RoomRow>();
  if (
    !row ||
    (!admin && (row.revoked || row.expires_at < Date.now())) ||
    (await hash(credential)) !== (admin ? row.admin_hash : row.invite_hash)
  )
    throw new AppError(403, 'Convite inválido ou expirado. Peça um novo link.');
  return row;
}
export async function joinRoom(
  body: Record<string, unknown>,
  request: Request,
) {
  const c = requireConfig();
  await rateLimit(request, 'join', 90, 60);
  const row = await authorize(body);
  const name = shortText(body.name, 32);
  // Recreate an empty room after LiveKit's idle cleanup, preserving the server-side limit.
  await media().createRoom({
    name: row.id,
    maxParticipants: 12,
    emptyTimeout: 300,
    departureTimeout: 120,
  });
  const token = new AccessToken(c.LIVEKIT_API_KEY, c.LIVEKIT_API_SECRET, {
    identity: crypto.randomUUID(),
    name,
    ttl: 60,
  });
  token.addGrant({
    room: row.id,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    canPublishSources: [
      TrackSource.MICROPHONE,
      TrackSource.SCREEN_SHARE,
      TrackSource.SCREEN_SHARE_AUDIO,
    ],
  });
  return {
    token: await token.toJwt(),
    url: c.LIVEKIT_URL,
    name: row.name,
    expiresAt: row.expires_at,
  };
}
export async function closeRoom(
  body: Record<string, unknown>,
  request: Request,
) {
  requireConfig();
  await rateLimit(request, 'close', 20, 60);
  const row = await authorize(body, true);
  await db()
    .prepare('UPDATE rooms SET revoked=1 WHERE id=?')
    .bind(row.id)
    .run();
  try {
    await media().deleteRoom(row.id);
  } catch (error) {
    if (
      !(
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 404
      )
    )
      throw error;
  }
  return { closed: true };
}
