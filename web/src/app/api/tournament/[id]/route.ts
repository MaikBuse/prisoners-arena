import { fetchTournament, fetchConfig, getAllEntries, getProgramId, getChainTimestamp } from '@/lib/solana';
import { upsertTournament, getTournament, getCachedEntryData, healClosedTournament } from '@/lib/db';
import type { CachedEntryData } from '@/lib/db';
import { apiSuccess, apiError, rateLimited, buildScoreboard } from '@/lib/api';
import { NextRequest } from 'next/server';
import { resolveNetwork } from '@/lib/config';
import { runWithNetwork } from '@/lib/network-context';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const network = resolveNetwork(req);
  return runWithNetwork(network, async () => {
    const limited = rateLimited(req);
    if (limited) return limited;
    try {
    const { id } = await params;
    const idNum = parseInt(id, 10);
    if (isNaN(idNum)) return apiError('Invalid tournament ID', 'INVALID_ID', 400);

    const programId = getProgramId().toBase58();
    const tournament = await fetchTournament(idNum);

    if (tournament) {
      // Chain hit — build entry data map from live entries and cache everything
      const [entries, chainTimestamp] = await Promise.all([
        getAllEntries(tournament.address),
        getChainTimestamp(),
      ]);
      if (entries.length > 0) {
        const entryDataMap = new Map<string, CachedEntryData>();
        // Build bytecodes array indexed by player position in tournament
        const bytecodes: (number[] | null)[] = new Array(tournament.players.length).fill(null);
        for (const e of entries) {
          const bc = e.bytecode.length > 0 ? e.bytecode : undefined;
          entryDataMap.set(e.player, {
            playerIndex: e.index,
            matchesPlayed: e.matchesPlayed,
            paidOut: e.paidOut,
            revealed: e.revealed,
            bytecode: bc,
          });
          if (bc) {
            const idx = tournament.players.indexOf(e.player);
            if (idx >= 0) bytecodes[idx] = bc;
          }
        }
        if (bytecodes.some(b => b !== null)) tournament.bytecodes = bytecodes;
        try { upsertTournament(programId, tournament, false, entryDataMap); } catch {}
      } else {
        try { upsertTournament(programId, tournament); } catch {}
      }

      const scoreboard = buildScoreboard(tournament, entries);
      const cacheSeconds = tournament.state === 'Payout' ? 3600 : 10;
      return apiSuccess({ tournament, entries, scoreboard, chainTimestamp }, cacheSeconds);
    }

    // Chain miss — account closed by operator, try SQLite fallback
    const cached = (() => { try { return getTournament(programId, idNum); } catch { return null; } })();
    if (!cached) return apiError('Tournament not found', 'NOT_FOUND', 404);

    // Heal and mark as accountClosed if this is a past tournament
    if (!cached.accountClosed) {
      const config = await fetchConfig();
      if (config && idNum < config.currentTournamentId) {
        try { healClosedTournament(programId, cached); } catch {}
      }
    }

    // Use cached entry data for scoreboard fallback
    let cachedEntryData: Map<string, CachedEntryData> | undefined;
    try { cachedEntryData = getCachedEntryData(programId, idNum); } catch {}
    const scoreboard = buildScoreboard(cached, [], cachedEntryData);
    return apiSuccess({ tournament: cached, entries: [], scoreboard }, 3600);
  } catch (e) {
    return apiError((e as Error).message, 'FETCH_ERROR', 500);
  }
  });
}
