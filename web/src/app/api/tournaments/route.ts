import { fetchConfig, fetchTournament, PROGRAM_ID } from '@/lib/solana';
import { upsertTournament, getTournament } from '@/lib/db';
import { apiSuccess, apiError, rateLimited } from '@/lib/api';
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const limited = rateLimited(req);
  if (limited) return limited;
  try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const config = await fetchConfig();
    if (!config) return apiSuccess({ tournaments: [], limit, offset });

    const programId = PROGRAM_ID.toBase58();
    const start = Math.max(0, config.currentTournamentId - offset);
    const end = Math.max(0, start - limit);

    const tournaments = [];
    for (let i = start; i >= end; i--) {
      let t = await fetchTournament(i);
      if (t) {
        try { upsertTournament(programId, t); } catch {}
      } else {
        try { t = getTournament(programId, i); } catch {}
      }
      if (t) tournaments.push(t);
    }

    // Include any archived tournaments with IDs below the range we just checked
    // (they'd be too old for the current page, so skip unless offset pushes us there)

    return apiSuccess({ tournaments, limit, offset });
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
}
