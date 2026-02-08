import { fetchTournamentList } from '@/lib/solana';
import { apiSuccess, apiError, rateLimited } from '@/lib/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const tournaments = await fetchTournamentList(limit, offset);
    return apiSuccess({ tournaments, limit, offset });
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
