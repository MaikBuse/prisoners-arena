import { NextResponse, NextRequest } from 'next/server';
import { getNetwork, STRATEGIES } from './solana';
import type { TournamentAccount, EntryAccount } from './solana';
import type { CachedEntryData } from './db';
import { checkRateLimit } from './rate-limit';

/**
 * Rate limit check. Returns a 429 response if exceeded, or null if allowed.
 * Call at the top of each API route handler.
 */
export function rateLimited(request: NextRequest): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
  const { allowed, remaining, retryAfterMs } = checkRateLimit(ip);

  if (!allowed) {
    const res = NextResponse.json({
      ok: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMITED',
      network: getNetwork(),
      timestamp: new Date().toISOString(),
    }, { status: 429 });
    res.headers.set('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
    res.headers.set('X-RateLimit-Limit', '60');
    res.headers.set('X-RateLimit-Remaining', '0');
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  }

  // Store remaining for use in response headers (set via apiSuccess/apiError)
  (globalThis as Record<string, unknown>).__rateLimitRemaining = remaining;
  return null;
}

export function apiSuccess(data: unknown, cacheSeconds = 10) {
  const res = NextResponse.json({
    ok: true,
    data,
    network: getNetwork(),
    timestamp: new Date().toISOString(),
  });
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  res.headers.set('Cache-Control', `public, s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`);
  return res;
}

export function apiError(error: string, code: string, status = 400) {
  const res = NextResponse.json({
    ok: false,
    error,
    code,
    network: getNetwork(),
    timestamp: new Date().toISOString(),
  }, { status });
  res.headers.set('Access-Control-Allow-Origin', '*');
  return res;
}

/** Default pubkey (all zeros) — indicates refunded slot */
const DEFAULT_PUBKEY = '11111111111111111111111111111111';

export interface ScoreboardEntry {
  player: string;
  score: number;
  strategy: number;
  strategyName: string;
  matchesPlayed: number;
  paidOut: boolean;
  revealed: boolean;
  /** true if the entry account still exists on-chain */
  entryExists: boolean;
}

/**
 * Build a complete scoreboard by merging tournament vecs (players/scores)
 * with entry account data and cached entry data. Three-tier fallback:
 *   1. Live entry account (on-chain)
 *   2. Cached entry data (SQLite)
 *   3. Inferred values (heuristic)
 */
export function buildScoreboard(
  tournament: TournamentAccount,
  entries: EntryAccount[],
  cachedEntryData?: Map<string, CachedEntryData>,
): ScoreboardEntry[] {
  // Index entries by player pubkey for fast lookup
  const entryMap = new Map<string, EntryAccount>();
  for (const e of entries) {
    entryMap.set(e.player, e);
  }

  const scoreboard: ScoreboardEntry[] = [];

  for (let i = 0; i < tournament.players.length; i++) {
    const player = tournament.players[i];
    if (player === DEFAULT_PUBKEY) continue; // refunded slot

    const score = tournament.scores[i] ?? 0;
    const entry = entryMap.get(player);
    const cached = cachedEntryData?.get(player);

    // If entry is closed and all matches ran, infer matchesPlayed from matchesPerPlayer
    const inferredMatchesPlayed =
      (tournament.state === 'Payout' || tournament.matchesCompleted >= tournament.matchesTotal)
        ? tournament.matchesPerPlayer : 0;

    // Use tournament.strategies (persists after entry closure) as primary source
    const stratIdx = tournament.strategies?.[i];
    const validStrat = stratIdx !== undefined && stratIdx >= 0 && stratIdx <= 9;
    const strategy = validStrat ? stratIdx : (entry?.strategy ?? -1);
    const strategyName = validStrat ? (STRATEGIES[stratIdx]?.name ?? 'Unknown') : (entry ? (STRATEGIES[entry.strategy]?.name ?? 'Unknown') : 'Unknown');

    // Three-tier fallback: entry → cached → inferred
    const matchesPlayed = entry?.matchesPlayed ?? cached?.matchesPlayed ?? inferredMatchesPlayed;
    const paidOut = entry?.paidOut ?? cached?.paidOut ?? (tournament.state === 'Payout' && score >= tournament.minWinningScore);
    const revealed = entry?.revealed ?? cached?.revealed ?? true;

    scoreboard.push({
      player,
      score,
      strategy,
      strategyName,
      matchesPlayed,
      paidOut,
      revealed,
      entryExists: !!entry,
    });
  }

  // Sort by score descending
  scoreboard.sort((a, b) => b.score - a.score);
  return scoreboard;
}
