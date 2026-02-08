import { fetchTournament, getAllEntries } from '@/lib/solana';
import { apiSuccess, apiError } from '@/lib/api';
import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) return apiError('Invalid tournament ID', 'INVALID_ID', 400);
    const tournament = await fetchTournament(idNum);
    if (!tournament) return apiError('Tournament not found', 'NOT_FOUND', 404);
    const entries = await getAllEntries(tournament.address);
    const cacheSeconds = tournament.state === 'Payout' ? 3600 : 10;
    return apiSuccess({ tournament, entries }, cacheSeconds);
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
