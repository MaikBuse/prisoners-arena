import { fetchConfig, fetchTournament, getProgramId } from '@/lib/solana';
import { upsertTournament, getTournament, healClosedTournament } from '@/lib/db';
import { apiSuccess, apiError, rateLimited } from '@/lib/api';
import { NextRequest } from 'next/server';
import { resolveNetwork } from '@/lib/config';
import { runWithNetwork } from '@/lib/network-context';

export async function GET(req: NextRequest) {
  const network = resolveNetwork(req);
  return runWithNetwork(network, async () => {
    const limited = rateLimited(req);
    if (limited) return limited;
    try {
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const config = await fetchConfig();
    if (!config) return apiSuccess({ tournaments: [], limit, offset });

    const programId = getProgramId().toBase58();
    const start = Math.max(0, config.currentTournamentId - offset);
    const end = Math.max(0, start - limit);

    const tournaments = [];
    for (let i = start; i >= end; i--) {
      let t = await fetchTournament(i);
      if (t) {
        try { upsertTournament(programId, t); } catch {}
      } else {
        const cached = (() => { try { return getTournament(programId, i); } catch { return null; } })();
        if (cached) {
          if (!cached.accountClosed && i < config.currentTournamentId) {
            try { healClosedTournament(programId, cached); } catch {}
          }
          t = cached;
        }
      }
      if (t) tournaments.push(t);
    }

    return apiSuccess({ tournaments, limit, offset });
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
  });
}
