import { NextRequest } from 'next/server';
import { fetchCurrentTournament, fetchConfig, getAllEntries, getProgramId, getChainTimestamp } from '@/lib/solana';
import { apiSuccess, apiError, rateLimited, buildScoreboard } from '@/lib/api';
import { upsertTournament } from '@/lib/db';
import { resolveNetwork } from '@/lib/config';
import { runWithNetwork } from '@/lib/network-context';

export async function GET(request: NextRequest) {
  const network = resolveNetwork(request);
  return runWithNetwork(network, async () => {
    const limited = rateLimited(request);
    if (limited) return limited;
    try {
      const tournament = await fetchCurrentTournament();
      if (!tournament) return apiError('No tournament found', 'NOT_FOUND', 404);
      try { upsertTournament(getProgramId().toBase58(), tournament); } catch {}
      const [entries, config, chainTimestamp] = await Promise.all([
        getAllEntries(tournament.address),
        fetchConfig(),
        getChainTimestamp(),
      ]);
      const scoreboard = buildScoreboard(tournament, entries);
      return apiSuccess({ tournament, entries, scoreboard, config, chainTimestamp });
    } catch (e) {
      return apiError((e as Error).message, 'FETCH_ERROR', 500);
    }
  });
}
