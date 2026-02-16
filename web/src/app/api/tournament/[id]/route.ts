import { fetchTournament, fetchConfig, getAllEntries, getProgramId } from '@/lib/solana';
import { upsertTournament, getTournament } from '@/lib/db';
import { apiSuccess, apiError, rateLimited, buildScoreboard } from '@/lib/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimited(req);
  if (limited) return limited;
  try {
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) return apiError('Invalid tournament ID', 'INVALID_ID', 400);

    let tournament = await fetchTournament(idNum);

    if (tournament) {
      // Archive to SQLite
      try { upsertTournament(getProgramId().toBase58(), tournament); } catch {}
    } else {
      // Chain miss — try SQLite fallback
      const programId = getProgramId().toBase58();
      try { tournament = getTournament(programId, idNum); } catch {}
      if (tournament && tournament.state !== 'Payout') {
        const config = await fetchConfig();
        if (config && idNum < config.currentTournamentId) {
          tournament = { ...tournament, state: 'Payout' };
          try { upsertTournament(programId, tournament); } catch {}
        }
      }
    }

    if (!tournament) return apiError('Tournament not found', 'NOT_FOUND', 404);

    const entries = await getAllEntries(tournament.address);
    const scoreboard = buildScoreboard(tournament, entries);
    const cacheSeconds = tournament.state === 'Payout' ? 3600 : 10;
    return apiSuccess({ tournament, entries, scoreboard }, cacheSeconds);
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
