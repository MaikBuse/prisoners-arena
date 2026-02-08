import { fetchCurrentTournament, getAllEntries } from '@/lib/solana';
import { apiSuccess, apiError } from '@/lib/api';

export async function GET() {
  try {
    const tournament = await fetchCurrentTournament();
    if (!tournament) return apiError('No tournament found', 'NOT_FOUND', 404);
    const entries = await getAllEntries(tournament.address);
    return apiSuccess({ tournament, entries });
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
