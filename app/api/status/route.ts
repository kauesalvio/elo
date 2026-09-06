import { configured, hostAuthorized } from '@/lib/server';
export async function GET(request: Request) {
  return Response.json(
    { configured: configured(), hostAuthorized: await hostAuthorized(request) },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
