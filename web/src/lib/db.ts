import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { TournamentAccount } from './solana';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'prisoners-arena.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
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
      PRIMARY KEY (program_id, tournament_id, player_index)
    );
  `);

  return db;
}

export function upsertTournament(programId: string, t: TournamentAccount): void {
  const db = getDb();

  const txn = db.transaction(() => {
    db.prepare(`
      INSERT OR REPLACE INTO tournaments (
        program_id, tournament_id, state, stake, house_fee_bps, matches_per_player,
        registration_duration, pool, participant_count, registration_ends,
        matches_completed, matches_total, randomness_seed, min_winning_score,
        winner_count, winner_pool, claims_processed, payout_started_at,
        entries_remaining, round_tier, reveal_ends, reveal_duration,
        reveals_completed, forfeits, address, bump, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
      )
    `).run(
      programId, t.id, t.state, t.stake, t.houseFeeBps, t.matchesPerPlayer,
      t.registrationDuration, t.pool, t.participantCount, t.registrationEnds,
      t.matchesCompleted, t.matchesTotal, t.randomnessSeed, t.minWinningScore,
      t.winnerCount, t.winnerPool, t.claimsProcessed, t.payoutStartedAt,
      t.entriesRemaining, t.roundTier, t.revealEnds, t.revealDuration,
      t.revealsCompleted, t.forfeits, t.address, t.bump
    );

    // Delete old player rows for this tournament, then insert fresh
    db.prepare(
      'DELETE FROM tournament_players WHERE program_id = ? AND tournament_id = ?'
    ).run(programId, t.id);

    const insertPlayer = db.prepare(`
      INSERT INTO tournament_players (program_id, tournament_id, player_index, player, score, strategy, strategy_params)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < t.players.length; i++) {
      insertPlayer.run(
        programId,
        t.id,
        i,
        t.players[i],
        t.scores[i] ?? 0,
        t.strategies[i] ?? 0,
        JSON.stringify(t.strategyParams[i] ?? [0, 0, 0, 0, 0])
      );
    }
  });

  txn();
}

export function getTournament(programId: string, id: number): TournamentAccount | null {
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
    strategyParams: playerRows.map(r => JSON.parse(r.strategy_params as string) as number[]),
    bump: row.bump as number,
    operatorCosts: (row.operator_costs as string) || '0',
    address: row.address as string,
  };
}

export function listTournamentIds(programId: string): number[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT tournament_id FROM tournaments WHERE program_id = ? ORDER BY tournament_id DESC'
  ).all(programId) as Array<{ tournament_id: number }>;
  return rows.map(r => r.tournament_id);
}
