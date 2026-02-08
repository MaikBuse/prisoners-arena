import { NextRequest } from 'next/server';
import { fetchCurrentTournament, getAllEntries } from '@/lib/solana';
import { apiSuccess, apiError, rateLimited } from '@/lib/api';

export async function GET(request: NextRequest) {
  const limited = rateLimited(request);
  if (limited) return limited;
  try {
    const tournament = await fetchCurrentTournament();
    if (!tournament) return apiError('No tournament found', 'NOT_FOUND', 404);
    const entries = await getAllEntries(tournament.address);
    return apiSuccess({ tournament, entries });
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
