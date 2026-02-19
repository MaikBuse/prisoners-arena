import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { TournamentAccount } from './solana';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'prisoners-arena.db');

let db: Database.Database | null = null;

export const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS tournaments (
    program_id TEXT NOT NULL,
    tournament_id INTEGER NOT NULL,
    state TEXT NOT NULL,
    stake TEXT NOT NULL,
    house_fee_bps INTEGER NOT NULL,
    matches_per_player INTEGER NOT NULL,
    registration_duration TEXT NOT NULL,
    pool TEXT NOT NULL,
    participant_count INTEGER NOT NULL,
    registration_ends TEXT NOT NULL,
    matches_completed INTEGER NOT NULL,
    matches_total INTEGER NOT NULL,
    randomness_seed TEXT NOT NULL,
    min_winning_score INTEGER NOT NULL,
    winner_count INTEGER NOT NULL,
    winner_pool TEXT NOT NULL,
    claims_processed INTEGER NOT NULL,
    payout_started_at TEXT NOT NULL,
    entries_remaining INTEGER NOT NULL,
    round_tier INTEGER NOT NULL,
    reveal_ends TEXT NOT NULL,
    reveal_duration TEXT NOT NULL,
    reveals_completed INTEGER NOT NULL,
    forfeits INTEGER NOT NULL,
    address TEXT NOT NULL,
    bump INTEGER NOT NULL,
    operator_costs TEXT NOT NULL DEFAULT '0',
    account_closed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (program_id, tournament_id)
  );

  CREATE TABLE IF NOT EXISTS tournament_players (
    program_id TEXT NOT NULL,
    tournament_id INTEGER NOT NULL,
    player_index INTEGER NOT NULL,
    player TEXT NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    strategy INTEGER NOT NULL DEFAULT 0,
    strategy_params TEXT NOT NULL DEFAULT '[]',
    matches_played INTEGER NOT NULL DEFAULT 0,
    paid_out INTEGER NOT NULL DEFAULT 0,
    revealed INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (program_id, tournament_id, player_index)
  );
`;

/** Cached entry fields stored in tournament_players. */
export interface CachedEntryData {
  playerIndex: number;
  matchesPlayed: number;
  paidOut: boolean;
  revealed: boolean;
}

/** Tournament data with an additional `accountClosed` flag from the cache. */
export interface CachedTournament extends TournamentAccount {
  accountClosed: boolean;
}

/** @internal — test-only: override the cached DB instance. */
export function _resetDb(newDb?: Database.Database): void {
  db = newDb ?? null;
}

/** Add columns that didn't exist in earlier schema versions. */
function migrateDb(db: Database.Database): void {
  const migrations = [
    'ALTER TABLE tournaments ADD COLUMN operator_costs TEXT NOT NULL DEFAULT \'0\'',
    'ALTER TABLE tournaments ADD COLUMN account_closed INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE tournament_players ADD COLUMN matches_played INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE tournament_players ADD COLUMN paid_out INTEGER NOT NULL DEFAULT 0',
    'ALTER TABLE tournament_players ADD COLUMN revealed INTEGER NOT NULL DEFAULT 1',
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }
}

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  const VALID_JOURNAL_MODES = ['WAL', 'DELETE', 'TRUNCATE', 'PERSIST', 'MEMORY', 'OFF'];
  const journalMode = process.env.SQLITE_JOURNAL_MODE || 'WAL';
  if (!VALID_JOURNAL_MODES.includes(journalMode.toUpperCase())) {
    throw new Error(`Invalid SQLITE_JOURNAL_MODE: ${journalMode}`);
  }
  db.pragma(`journal_mode = ${journalMode}`);
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  db.exec(SCHEMA_SQL);
  migrateDb(db);

  return db;
}

export function upsertTournament(
  programId: string,
  t: TournamentAccount,
  accountClosed = false,
  entryData?: Map<string, CachedEntryData>,
): void {
  const db = getDb();

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO tournaments (
        program_id, tournament_id, state, stake, house_fee_bps, matches_per_player,
        registration_duration, pool, participant_count, registration_ends,
        matches_completed, matches_total, randomness_seed, min_winning_score,
        winner_count, winner_pool, claims_processed, payout_started_at,
        entries_remaining, round_tier, reveal_ends, reveal_duration,
        reveals_completed, forfeits, address, bump, operator_costs, account_closed,
        updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
      )
    `).run(
      programId, t.id, t.state, t.stake, t.houseFeeBps, t.matchesPerPlayer,
      t.registrationDuration, t.pool, t.participantCount, t.registrationEnds,
      t.matchesCompleted, t.matchesTotal, t.randomnessSeed, t.minWinningScore,
      t.winnerCount, t.winnerPool, t.claimsProcessed, t.payoutStartedAt,
      t.entriesRemaining, t.roundTier, t.revealEnds, t.revealDuration,
      t.revealsCompleted, t.forfeits, t.address, t.bump,
      t.operatorCosts ?? '0', accountClosed ? 1 : 0
    );

    // Delete old player rows for this tournament, then insert fresh
    db.prepare(
      'DELETE FROM tournament_players WHERE program_id = ? AND tournament_id = ?'
    ).run(programId, t.id);

    const insertPlayer = db.prepare(`
      INSERT INTO tournament_players (
        program_id, tournament_id, player_index, player, score, strategy,
        matches_played, paid_out, revealed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < t.players.length; i++) {
      const player = t.players[i];
      const cached = entryData?.get(player);
      insertPlayer.run(
        programId,
        t.id,
        i,
        player,
        t.scores[i] ?? 0,
        t.strategies[i] ?? 0,
        cached?.matchesPlayed ?? 0,
        cached?.paidOut ? 1 : 0,
        cached?.revealed !== undefined ? (cached.revealed ? 1 : 0) : 1,
      );
    }
  });

  txn();
}

export function getTournament(programId: string, id: number): CachedTournament | null {
  const db = getDb();

  const row = db.prepare(
    'SELECT * FROM tournaments WHERE program_id = ? AND tournament_id = ?'
  ).get(programId, id) as Record<string, unknown> | undefined;

  if (!row) return null;

  const playerRows = db.prepare(
    'SELECT * FROM tournament_players WHERE program_id = ? AND tournament_id = ? ORDER BY player_index ASC'
  ).all(programId, id) as Array<Record<string, unknown>>;

  return {
    id: row.tournament_id as number,
    state: row.state as TournamentAccount['state'],
    stake: row.stake as string,
    houseFeeBps: row.house_fee_bps as number,
    matchesPerPlayer: row.matches_per_player as number,
    registrationDuration: row.registration_duration as string,
    pool: row.pool as string,
    participantCount: row.participant_count as number,
    registrationEnds: row.registration_ends as string,
    matchesCompleted: row.matches_completed as number,
    matchesTotal: row.matches_total as number,
    randomnessSeed: row.randomness_seed as string,
    minWinningScore: row.min_winning_score as number,
    winnerCount: row.winner_count as number,
    winnerPool: row.winner_pool as string,
    claimsProcessed: row.claims_processed as number,
    payoutStartedAt: row.payout_started_at as string,
    entriesRemaining: row.entries_remaining as number,
    roundTier: row.round_tier as number,
    revealEnds: row.reveal_ends as string,
    revealDuration: row.reveal_duration as string,
    revealsCompleted: row.reveals_completed as number,
    forfeits: row.forfeits as number,
    players: playerRows.map(r => r.player as string),
    scores: playerRows.map(r => r.score as number),
    strategies: playerRows.map(r => r.strategy as number),
    bump: row.bump as number,
    operatorCosts: (row.operator_costs as string) || '0',
    address: row.address as string,
    accountClosed: (row.account_closed as number) === 1,
  };
}

export function getCachedEntryData(programId: string, tournamentId: number): Map<string, CachedEntryData> {
  const db = getDb();
  const rows = db.prepare(
    'SELECT player, player_index, matches_played, paid_out, revealed FROM tournament_players WHERE program_id = ? AND tournament_id = ? ORDER BY player_index ASC'
  ).all(programId, tournamentId) as Array<Record<string, unknown>>;

  const map = new Map<string, CachedEntryData>();
  for (const r of rows) {
    map.set(r.player as string, {
      playerIndex: r.player_index as number,
      matchesPlayed: r.matches_played as number,
      paidOut: (r.paid_out as number) === 1,
      revealed: (r.revealed as number) === 1,
    });
  }
  return map;
}

export function listTournamentIds(programId: string): number[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT tournament_id FROM tournaments WHERE program_id = ? ORDER BY tournament_id DESC'
  ).all(programId) as Array<{ tournament_id: number }>;
  return rows.map(r => r.tournament_id);
}

/**
 * Heal stale cached data for a closed tournament.
 *
 * When the operator closes entry and tournament accounts before the web cache
 * captures the final state, the cache may contain stale fields (e.g.
 * state="Running", winnerCount=0). This function infers the correct final
 * values and persists them so the computation happens only once.
 *
 * Mutates `tournament` in place and calls `upsertTournament()`.
 */
export function healClosedTournament(
  programId: string,
  tournament: CachedTournament,
): void {
  let healed = false;

  // Ensure state is Payout (the terminal on-chain state before closure)
  if (tournament.state !== 'Payout') {
    tournament.state = 'Payout';
    healed = true;
  }

  // All entries have been closed by the operator
  if (tournament.entriesRemaining !== 0) {
    tournament.entriesRemaining = 0;
    healed = true;
  }

  // Infer winnerCount if matches ran to completion but it was never set
  const activePlayerCount = tournament.participantCount - tournament.forfeits;
  if (
    tournament.matchesCompleted >= tournament.matchesTotal &&
    tournament.matchesTotal > 0 &&
    tournament.winnerCount === 0
  ) {
    // Mirrors on-chain logic: MIN_WINNER_RATIO = 4 → top 25% win (at least 1)
    tournament.winnerCount = Math.max(1, Math.floor(activePlayerCount / 4));
    healed = true;
  }

  // Compute minWinningScore from sorted scores
  if (tournament.winnerCount > 0 && tournament.scores.length > 0) {
    const sorted = [...tournament.scores].sort((a, b) => b - a);
    const idx = Math.min(tournament.winnerCount - 1, sorted.length - 1);
    const computed = sorted[idx];
    if (tournament.minWinningScore !== computed) {
      tournament.minWinningScore = computed;
      healed = true;
    }
  }

  // Compute winnerPool using BigInt: pool - houseFee - operatorCosts
  if (tournament.winnerCount > 0) {
    const pool = BigInt(tournament.pool);
    const houseFee = pool * BigInt(tournament.houseFeeBps) / 10000n;
    const operatorCosts = BigInt(tournament.operatorCosts || '0');
    const computed = (pool - houseFee - operatorCosts).toString();
    if (tournament.winnerPool !== computed) {
      tournament.winnerPool = computed;
      healed = true;
    }
  }

  // All entries closed means all payouts distributed
  if (tournament.claimsProcessed !== tournament.winnerCount) {
    tournament.claimsProcessed = tournament.winnerCount;
    healed = true;
  }

  // Mark account as closed
  if (!tournament.accountClosed) {
    tournament.accountClosed = true;
    healed = true;
  }

  if (healed) {
    upsertTournament(programId, tournament, true);
  }
}
