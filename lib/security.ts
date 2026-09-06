export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function randomSecret(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
}
export async function hash(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(buffer), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
}
export function secret(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value))
    throw new AppError(403, 'Convite inválido ou expirado. Peça um novo link.');
  return value;
}
export function roomId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9-]{36}$/.test(value))
    throw new AppError(403, 'Convite inválido ou expirado. Peça um novo link.');
  return value;
}
export function shortText(value: unknown, max: number): string {
  if (typeof value !== 'string')
    throw new AppError(400, 'Preencha seu nome e o nome da sala.');
  const clean = value.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  if (!clean || clean.length > max)
    throw new AppError(400, `Use entre 1 e ${max} caracteres.`);
  return clean;
}
export async function readBody(
  request: Request,
): Promise<Record<string, unknown>> {
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin)
    throw new AppError(403, 'Solicitação de origem não permitida.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new AppError(415, 'Formato não permitido.');
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, 'Solicitação vazia.');
  let length = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    length += part.value.byteLength;
    if (length > 4096) {
      await reader.cancel();
      throw new AppError(413, 'Solicitação muito grande.');
    }
    chunks.push(part.value);
  }
  const buffer = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const body: unknown = JSON.parse(new TextDecoder().decode(buffer));
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new AppError(400, 'Solicitação inválida.');
  }
}
export function apiError(error: unknown): Response {
  return Response.json(
    {
      error:
        error instanceof AppError
          ? error.message
          : 'Não foi possível concluir. Tente novamente em instantes.',
    },
    {
      status: error instanceof AppError ? error.status : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
