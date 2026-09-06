import { closeRoom } from '@/lib/server';
import { apiError, readBody } from '@/lib/security';
export async function POST(request: Request) {
  try {
    return Response.json(await closeRoom(await readBody(request), request), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
