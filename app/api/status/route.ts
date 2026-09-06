import { configured } from '@/lib/server';
export function GET() {
  return Response.json(
    { configured: configured() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
