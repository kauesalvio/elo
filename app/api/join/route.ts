import { joinRoom } from '@/lib/server';
import { apiError, readBody } from '@/lib/security';
export async function POST(request: Request) {
  try {
    return Response.json(await joinRoom(await readBody(request), request), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
