import { NextRequest } from 'next/server';
import { fetchCurrentTournament, fetchConfig, getAllEntries } from '@/lib/solana';
import { apiSuccess, apiError, rateLimited } from '@/lib/api';

export async function GET(request: NextRequest) {
  const limited = rateLimited(request);
  if (limited) return limited;
  try {
    const tournament = await fetchCurrentTournament();
    if (!tournament) return apiError('No tournament found', 'NOT_FOUND', 404);
    const [entries, config] = await Promise.all([
      getAllEntries(tournament.address),
      fetchConfig(),
    ]);
    return apiSuccess({ tournament, entries, config });
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
