/**
 * WASM-powered match replay for tournament history.
 *
 * Lazy-loads the match-logic WASM module on first use and provides
 * typed helpers for replaying matches, computing pairings, and
 * deriving per-player stats. All inputs come from on-chain tournament
 * data (or the SQLite cache for closed tournaments).
 *
 * IMPORTANT: This uses the real Rust match engine compiled to WASM,
 * producing cryptographically identical results to on-chain execution.
 * Used by both tournament replay (PlayerDetailModal) and the Strategy
 * Lab preview (StrategyPreview).
 */

import type { TournamentAccount } from './solana';
import { STRATEGIES } from './solana';

// ── WASM types (mirroring Rust serde output) ────────────────────────

export interface WasmRoundResult {
  round: number;
  move_a: 'Cooperate' | 'Defect';
  move_b: 'Cooperate' | 'Defect';
  score_a: number;
  score_b: number;
  cumulative_a: number;
  cumulative_b: number;
}

export interface WasmMatchResult {
  rounds: WasmRoundResult[];
  total_score_a: number;
  total_score_b: number;
  round_count: number;
}

// ── Public types ────────────────────────────────────────────────────

export interface PlayerMatchInfo {
  matchIndex: number;
  playerIndex: number;
  playerAddress: string;
  playerStrategy: number;
  playerStrategyName: string;
  opponentIndex: number;
  opponentAddress: string;
  opponentStrategy: number;
  opponentStrategyName: string;
  isPlayerA: boolean; // whether the queried player is side A in the match
  playerScore: number;
  opponentScore: number;
  roundCount: number;
}

export interface MatchReplayResult {
  matchIndex: number;
  playerIndex: number;
  opponentIndex: number;
  isPlayerA: boolean;
  rounds: {
    round: number;
    playerMove: 'C' | 'D';
    opponentMove: 'C' | 'D';
    playerScore: number;
    opponentScore: number;
    cumulativePlayer: number;
    cumulativeOpponent: number;
  }[];
  totalPlayerScore: number;
  totalOpponentScore: number;
  roundCount: number;
}

export interface PlayerStats {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  totalScore: number;
  avgScore: number;
  cooperationRate: number; // 0-1
  totalRounds: number;
  coopMoves: number;
}

// ── WASM module loading ─────────────────────────────────────────────

type WasmModule = typeof import('../wasm/match_logic');

let wasmModule: WasmModule | null = null;
let wasmInitPromise: Promise<WasmModule> | null = null;

export async function getWasm(): Promise<WasmModule> {
  if (wasmModule) return wasmModule;
  if (wasmInitPromise) return wasmInitPromise;

  wasmInitPromise = (async () => {
    const mod = await import('../wasm/match_logic');
    await mod.default();
    wasmModule = mod;
    return mod;
  })();

  return wasmInitPromise;
}

// ── Helpers ─────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function makeStrategyJson(strategyIndex: number, bytecode?: number[] | null): string {
  if (strategyIndex === 9 && bytecode && bytecode.length > 0) {
    // Custom strategy: pass as PlayerStrategy::Custom
    return JSON.stringify({ Custom: bytecode });
  }
  if (strategyIndex === 9) {
    // Custom strategy without bytecode (e.g. restored from old cache) —
    // fall back to AlwaysCooperate so WASM doesn't crash
    console.warn('makeStrategyJson: Custom strategy (9) missing bytecode, falling back to AlwaysCooperate');
    return JSON.stringify({ base: 'AlwaysCooperate' });
  }
  const base = STRATEGIES[strategyIndex]?.key;
  if (!base) throw new Error(`Unknown strategy index: ${strategyIndex}`);
  return JSON.stringify({ base });
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Get all matches a specific player participated in.
 * Returns summary info for each match (no round-by-round yet).
 */
export async function getPlayerMatches(
  tournament: TournamentAccount,
  playerIndex: number,
): Promise<PlayerMatchInfo[]> {
  const wasm = await getWasm();
  const seed = hexToBytes(tournament.randomnessSeed);
  const k = wasm.get_effective_k(tournament.participantCount, tournament.matchesPerPlayer);
  const n = tournament.participantCount;

  // Get all pairings
  const pairings: [number, number][] = wasm.get_tournament_pairings(n, k, seed);

  // Filter to pairings involving our player
  const matches: PlayerMatchInfo[] = [];
  for (let matchIndex = 0; matchIndex < pairings.length; matchIndex++) {
    const [a, b] = pairings[matchIndex];
    if (a !== playerIndex && b !== playerIndex) continue;

    const isPlayerA = a === playerIndex;
    const opponentIndex = isPlayerA ? b : a;

    // Build strategy JSON for both sides
    const bytecodeA = tournament.bytecodes?.[a] ?? null;
    const bytecodeB = tournament.bytecodes?.[b] ?? null;
    const stratA = makeStrategyJson(tournament.strategies[a], bytecodeA);
    const stratB = makeStrategyJson(tournament.strategies[b], bytecodeB);

    // Replay to get scores (this is fast, <1ms per match)
    const result: WasmMatchResult = wasm.replay_match(stratA, stratB, seed, matchIndex, n);

    matches.push({
      matchIndex,
      playerIndex,
      playerAddress: tournament.players[playerIndex] ?? '',
      playerStrategy: tournament.strategies[playerIndex],
      playerStrategyName: STRATEGIES[tournament.strategies[playerIndex]]?.name ?? 'Unknown',
      opponentIndex,
      opponentAddress: tournament.players[opponentIndex] ?? '',
      opponentStrategy: tournament.strategies[opponentIndex],
      opponentStrategyName: STRATEGIES[tournament.strategies[opponentIndex]]?.name ?? 'Unknown',
      isPlayerA,
      playerScore: isPlayerA ? result.total_score_a : result.total_score_b,
      opponentScore: isPlayerA ? result.total_score_b : result.total_score_a,
      roundCount: result.round_count,
    });
  }

  return matches;
}

/**
 * Replay a single match with full round-by-round detail.
 * The result is oriented from the queried player's perspective.
 */
export async function replayMatch(
  tournament: TournamentAccount,
  matchIndex: number,
  playerIndex: number,
): Promise<MatchReplayResult> {
  const wasm = await getWasm();
  const seed = hexToBytes(tournament.randomnessSeed);
  const k = wasm.get_effective_k(tournament.participantCount, tournament.matchesPerPlayer);
  const n = tournament.participantCount;

  // Get the pairing for this match
  const pairing: [number, number] | null = wasm.get_match_pairing(n, k, seed, matchIndex);
  if (!pairing) throw new Error(`Match ${matchIndex} not found`);

  const [a, b] = pairing;
  const isPlayerA = a === playerIndex;
  const opponentIndex = isPlayerA ? b : a;

  // Build strategy JSON
  const bytecodeA = tournament.bytecodes?.[a] ?? null;
  const bytecodeB = tournament.bytecodes?.[b] ?? null;
  const stratA = makeStrategyJson(tournament.strategies[a], bytecodeA);
  const stratB = makeStrategyJson(tournament.strategies[b], bytecodeB);

  const result: WasmMatchResult = wasm.replay_match(stratA, stratB, seed, matchIndex, n);

  return {
    matchIndex,
    playerIndex,
    opponentIndex,
    isPlayerA,
    rounds: result.rounds.map(r => ({
      round: r.round,
      playerMove: (isPlayerA ? r.move_a : r.move_b) === 'Cooperate' ? 'C' as const : 'D' as const,
      opponentMove: (isPlayerA ? r.move_b : r.move_a) === 'Cooperate' ? 'C' as const : 'D' as const,
      playerScore: isPlayerA ? r.score_a : r.score_b,
      opponentScore: isPlayerA ? r.score_b : r.score_a,
      cumulativePlayer: isPlayerA ? r.cumulative_a : r.cumulative_b,
      cumulativeOpponent: isPlayerA ? r.cumulative_b : r.cumulative_a,
    })),
    totalPlayerScore: isPlayerA ? result.total_score_a : result.total_score_b,
    totalOpponentScore: isPlayerA ? result.total_score_b : result.total_score_a,
    roundCount: result.round_count,
  };
}

/**
 * Compute aggregate stats for a player across all their matches.
 * Replays each match once to get both scores and cooperation data.
 */
export async function getPlayerStats(
  tournament: TournamentAccount,
  playerIndex: number,
): Promise<PlayerStats> {
  const wasm = await getWasm();
  const seed = hexToBytes(tournament.randomnessSeed);
  const k = wasm.get_effective_k(tournament.participantCount, tournament.matchesPerPlayer);
  const n = tournament.participantCount;

  const pairings: [number, number][] = wasm.get_tournament_pairings(n, k, seed);

  let totalScore = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalRounds = 0;
  let coopMoves = 0;
  let totalMatches = 0;

  for (let matchIndex = 0; matchIndex < pairings.length; matchIndex++) {
    const [a, b] = pairings[matchIndex];
    if (a !== playerIndex && b !== playerIndex) continue;

    const isPlayerA = a === playerIndex;
    const bytecodeA = tournament.bytecodes?.[a] ?? null;
    const bytecodeB = tournament.bytecodes?.[b] ?? null;
    const stratA = makeStrategyJson(tournament.strategies[a], bytecodeA);
    const stratB = makeStrategyJson(tournament.strategies[b], bytecodeB);
    const result: WasmMatchResult = wasm.replay_match(stratA, stratB, seed, matchIndex, n);

    const pScore = isPlayerA ? result.total_score_a : result.total_score_b;
    const oScore = isPlayerA ? result.total_score_b : result.total_score_a;
    totalScore += pScore;
    if (pScore > oScore) wins++;
    else if (pScore < oScore) losses++;
    else draws++;

    totalRounds += result.round_count;
    for (const r of result.rounds) {
      if ((isPlayerA ? r.move_a : r.move_b) === 'Cooperate') coopMoves++;
    }
    totalMatches++;
  }

  return {
    totalMatches,
    wins,
    losses,
    draws,
    totalScore,
    avgScore: totalMatches > 0 ? totalScore / totalMatches : 0,
    cooperationRate: totalRounds > 0 ? coopMoves / totalRounds : 0,
    totalRounds,
    coopMoves,
  };
}
