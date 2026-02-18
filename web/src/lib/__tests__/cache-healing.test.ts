import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import type { TournamentAccount } from '@/lib/solana';
import {
  SCHEMA_SQL,
  _resetDb,
  upsertTournament,
  getTournament,
  getCachedEntryData,
  listTournamentIds,
} from '@/lib/db';
import type { CachedEntryData } from '@/lib/db';
import { displayState } from '@/lib/tournament-utils';
import { buildScoreboard } from '@/lib/api';

// ── each test gets a fresh :memory: database ────────────────────────────

let memDb: Database.Database;

beforeEach(() => {
  memDb = new Database(':memory:');
  memDb.pragma('journal_mode = WAL');
  memDb.pragma('foreign_keys = ON');
  memDb.exec(SCHEMA_SQL);
  _resetDb(memDb);
});

afterEach(() => {
  _resetDb();
});

// ── helpers ───────────────────────────────────────────────────────────────

const PROGRAM_ID = 'TestProgram111111111111111111111111111111111';

function makeTournament(overrides: Partial<TournamentAccount> = {}): TournamentAccount {
  return {
    id: 1,
    state: 'Payout',
    stake: '100000000',
    houseFeeBps: 500,
    matchesPerPlayer: 10,
    registrationDuration: '86400',
    pool: '400000000',
    participantCount: 4,
    registrationEnds: '1700000000',
    matchesCompleted: 24,
    matchesTotal: 24,
    randomnessSeed: 'abc123',
    minWinningScore: 50,
    winnerCount: 1,
    winnerPool: '380000000',
    claimsProcessed: 0,
    payoutStartedAt: '1700100000',
    entriesRemaining: 4,
    roundTier: 0,
    revealEnds: '1700050000',
    revealDuration: '3600',
    revealsCompleted: 4,
    forfeits: 0,
    players: ['Alice111', 'Bob22222', 'Carol333', 'Dave4444'],
    scores: [80, 60, 40, 20],
    strategies: [0, 1, 2, 3],
    strategyParams: [
      [10, 0, 0, 0, 128],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ],
    bump: 255,
    operatorCosts: '0',
    address: 'TournAddr1111111111111111111111111111111111',
    ...overrides,
  };
}

// ── A. SQLite roundtrip ──────────────────────────────────────────────────

describe('SQLite roundtrip', () => {
  it('upsert → get returns equivalent data', () => {
    const t = makeTournament();
    upsertTournament(PROGRAM_ID, t);
    const got = getTournament(PROGRAM_ID, t.id);

    expect(got).not.toBeNull();
    expect(got!.id).toBe(t.id);
    expect(got!.state).toBe(t.state);
    expect(got!.stake).toBe(t.stake);
    expect(got!.houseFeeBps).toBe(t.houseFeeBps);
    expect(got!.pool).toBe(t.pool);
    expect(got!.participantCount).toBe(t.participantCount);
    expect(got!.winnerCount).toBe(t.winnerCount);
    expect(got!.claimsProcessed).toBe(t.claimsProcessed);
    expect(got!.entriesRemaining).toBe(t.entriesRemaining);
    expect(got!.players).toEqual(t.players);
    expect(got!.scores).toEqual(t.scores);
    expect(got!.strategies).toEqual(t.strategies);
    expect(got!.strategyParams).toEqual(t.strategyParams);
    expect(got!.accountClosed).toBe(false);
  });

  it('upsert overwrites previous data for same (programId, tournamentId)', () => {
    const t1 = makeTournament({ claimsProcessed: 0 });
    upsertTournament(PROGRAM_ID, t1);

    const t2 = makeTournament({ claimsProcessed: 1 });
    upsertTournament(PROGRAM_ID, t2);

    const got = getTournament(PROGRAM_ID, t2.id);
    expect(got!.claimsProcessed).toBe(1);
  });

  it('getTournament returns null for missing ID', () => {
    expect(getTournament(PROGRAM_ID, 999)).toBeNull();
  });

  it('listTournamentIds returns IDs descending', () => {
    upsertTournament(PROGRAM_ID, makeTournament({ id: 1 }));
    upsertTournament(PROGRAM_ID, makeTournament({ id: 3 }));
    upsertTournament(PROGRAM_ID, makeTournament({ id: 2 }));

    expect(listTournamentIds(PROGRAM_ID)).toEqual([3, 2, 1]);
  });

  it('persists operatorCosts', () => {
    const t = makeTournament({ operatorCosts: '5000000' });
    upsertTournament(PROGRAM_ID, t);
    const got = getTournament(PROGRAM_ID, t.id);
    expect(got!.operatorCosts).toBe('5000000');
  });
});

// ── B. displayState() ───────────────────────────────────────────────────

describe('displayState()', () => {
  it('returns "Completed" when accountClosed is true', () => {
    const t = makeTournament({ state: 'Payout', winnerCount: 2, claimsProcessed: 0 });
    expect(displayState({ ...t, accountClosed: true })).toBe('Completed');
  });

  it('returns "Completed" when state=Payout, winnerCount>0, claimsProcessed>=winnerCount', () => {
    const t = makeTournament({ state: 'Payout', winnerCount: 2, claimsProcessed: 2 });
    expect(displayState(t)).toBe('Completed');
  });

  it('returns "Payout" when claimsProcessed < winnerCount and not accountClosed', () => {
    const t = makeTournament({ state: 'Payout', winnerCount: 2, claimsProcessed: 0 });
    expect(displayState(t)).toBe('Payout');
  });

  it('returns "Payout" when winnerCount=0 (no winners — nothing to claim, but not closed)', () => {
    const t = makeTournament({ state: 'Payout', winnerCount: 0, claimsProcessed: 0 });
    expect(displayState(t)).toBe('Payout');
  });

  it('returns "Completed" when winnerCount=0 and accountClosed', () => {
    const t = makeTournament({ state: 'Payout', winnerCount: 0, claimsProcessed: 0 });
    expect(displayState({ ...t, accountClosed: true })).toBe('Completed');
  });

  it('returns raw state for non-Payout states', () => {
    expect(displayState(makeTournament({ state: 'Registration' }))).toBe('Registration');
    expect(displayState(makeTournament({ state: 'Reveal' }))).toBe('Reveal');
    expect(displayState(makeTournament({ state: 'Running' }))).toBe('Running');
  });
});

// ── C. accountClosed flag with SQLite persistence ────────────────────────

describe('accountClosed flag with SQLite persistence', () => {
  it('upsert with accountClosed=true persists and reads back', () => {
    const t = makeTournament({ id: 1, winnerCount: 1, claimsProcessed: 0, entriesRemaining: 4 });
    upsertTournament(PROGRAM_ID, t, true);

    const got = getTournament(PROGRAM_ID, 1)!;
    expect(got.accountClosed).toBe(true);
    expect(displayState(got)).toBe('Completed');
  });

  it('does NOT mark accountClosed when id === currentTournamentId', () => {
    const currentTournamentId = 5;
    const t = makeTournament({ id: 5, winnerCount: 2, claimsProcessed: 0 });
    upsertTournament(PROGRAM_ID, t, false);

    // Guard: only mark closed when id < currentTournamentId
    const shouldClose = t.id < currentTournamentId;
    expect(shouldClose).toBe(false);

    const got = getTournament(PROGRAM_ID, 5)!;
    expect(got.accountClosed).toBe(false);
    expect(displayState(got)).toBe('Payout');
  });

  it('marks accountClosed when id < currentTournamentId', () => {
    const currentTournamentId = 5;
    const t = makeTournament({ id: 3, winnerCount: 2, claimsProcessed: 0 });
    upsertTournament(PROGRAM_ID, t, false);

    const shouldClose = t.id < currentTournamentId;
    expect(shouldClose).toBe(true);

    // Re-upsert with accountClosed=true
    upsertTournament(PROGRAM_ID, t, true);

    const got = getTournament(PROGRAM_ID, 3)!;
    expect(got.accountClosed).toBe(true);
    expect(displayState(got)).toBe('Completed');
  });

  it('winnerCount=0 closed tournament shows "Completed" via accountClosed', () => {
    const t = makeTournament({ id: 2, winnerCount: 0, claimsProcessed: 0, entriesRemaining: 3 });
    upsertTournament(PROGRAM_ID, t, true);

    const got = getTournament(PROGRAM_ID, 2)!;
    expect(got.accountClosed).toBe(true);
    expect(displayState(got)).toBe('Completed');
  });
});

// ── D. Entry data persistence ────────────────────────────────────────────

describe('entry data persistence', () => {
  it('upsert with entryDataMap → getCachedEntryData returns correct values', () => {
    const t = makeTournament();
    const entryDataMap = new Map<string, CachedEntryData>([
      ['Alice111', { playerIndex: 0, matchesPlayed: 10, paidOut: true, revealed: true }],
      ['Bob22222', { playerIndex: 1, matchesPlayed: 10, paidOut: false, revealed: true }],
      ['Carol333', { playerIndex: 2, matchesPlayed: 8, paidOut: false, revealed: false }],
      ['Dave4444', { playerIndex: 3, matchesPlayed: 10, paidOut: false, revealed: true }],
    ]);

    upsertTournament(PROGRAM_ID, t, false, entryDataMap);

    const cached = getCachedEntryData(PROGRAM_ID, t.id);
    expect(cached.size).toBe(4);

    const alice = cached.get('Alice111')!;
    expect(alice.matchesPlayed).toBe(10);
    expect(alice.paidOut).toBe(true);
    expect(alice.revealed).toBe(true);

    const carol = cached.get('Carol333')!;
    expect(carol.matchesPlayed).toBe(8);
    expect(carol.paidOut).toBe(false);
    expect(carol.revealed).toBe(false);
  });

  it('getCachedEntryData returns empty map for non-existent tournament', () => {
    const cached = getCachedEntryData(PROGRAM_ID, 999);
    expect(cached.size).toBe(0);
  });

  it('buildScoreboard uses cached entry data when entries are empty', () => {
    const t = makeTournament({ state: 'Payout', matchesPerPlayer: 10, minWinningScore: 50 });
    const entryDataMap = new Map<string, CachedEntryData>([
      ['Alice111', { playerIndex: 0, matchesPlayed: 10, paidOut: true, revealed: true }],
      ['Bob22222', { playerIndex: 1, matchesPlayed: 10, paidOut: false, revealed: true }],
      ['Carol333', { playerIndex: 2, matchesPlayed: 8, paidOut: false, revealed: false }],
      ['Dave4444', { playerIndex: 3, matchesPlayed: 10, paidOut: false, revealed: true }],
    ]);

    // No live entries — scoreboard should fall back to cached data
    const scoreboard = buildScoreboard(t, [], entryDataMap);

    expect(scoreboard).toHaveLength(4);
    // Sorted by score descending: Alice(80), Bob(60), Carol(40), Dave(20)
    const alice = scoreboard.find(s => s.player === 'Alice111')!;
    expect(alice.matchesPlayed).toBe(10);
    expect(alice.paidOut).toBe(true);
    expect(alice.revealed).toBe(true);
    expect(alice.entryExists).toBe(false);

    const carol = scoreboard.find(s => s.player === 'Carol333')!;
    expect(carol.matchesPlayed).toBe(8);
    expect(carol.paidOut).toBe(false);
    expect(carol.revealed).toBe(false);
  });

  it('buildScoreboard prefers live entry over cached data', () => {
    const t = makeTournament({ state: 'Payout', matchesPerPlayer: 10 });
    const cachedData = new Map<string, CachedEntryData>([
      ['Alice111', { playerIndex: 0, matchesPlayed: 5, paidOut: false, revealed: true }],
    ]);

    // Live entry with different data
    const entries = [{
      tournament: t.address,
      player: 'Alice111',
      index: 0,
      commitment: '',
      strategy: 0,
      strategyName: 'TitForTat',
      strategyParams: { forgiveness: 10, retaliationDelay: 0, noiseTolerance: 0, initialMoves: 0, cooperateBias: 128 },
      revealed: true,
      score: 80,
      matchesPlayed: 10,
      paidOut: true,
      createdAt: '1700000000',
      bump: 255,
      address: 'EntryAddr1111111111111111111111111111111111',
    }];

    const scoreboard = buildScoreboard(t, entries, cachedData);
    const alice = scoreboard.find(s => s.player === 'Alice111')!;
    // Live entry takes precedence
    expect(alice.matchesPlayed).toBe(10);
    expect(alice.paidOut).toBe(true);
    expect(alice.entryExists).toBe(true);
  });

  it('full roundtrip: upsert with entryData → getCachedEntryData → buildScoreboard', () => {
    const t = makeTournament({ state: 'Payout', matchesPerPlayer: 10, minWinningScore: 50 });
    const entryDataMap = new Map<string, CachedEntryData>([
      ['Alice111', { playerIndex: 0, matchesPlayed: 10, paidOut: true, revealed: true }],
      ['Bob22222', { playerIndex: 1, matchesPlayed: 10, paidOut: false, revealed: true }],
    ]);

    // Persist to DB
    upsertTournament(PROGRAM_ID, t, true, entryDataMap);

    // Read back from DB
    const cached = getCachedEntryData(PROGRAM_ID, t.id);
    expect(cached.size).toBe(4); // all 4 players, but only Alice and Bob have entry data

    // Build scoreboard with cached data (simulating chain miss)
    const scoreboard = buildScoreboard(t, [], cached);
    const alice = scoreboard.find(s => s.player === 'Alice111')!;
    expect(alice.matchesPlayed).toBe(10);
    expect(alice.paidOut).toBe(true);

    const bob = scoreboard.find(s => s.player === 'Bob22222')!;
    expect(bob.matchesPlayed).toBe(10);
    expect(bob.paidOut).toBe(false);

    // Carol and Dave had no entry data — they get defaults (0, false, true)
    const carol = scoreboard.find(s => s.player === 'Carol333')!;
    expect(carol.matchesPlayed).toBe(0);
    expect(carol.paidOut).toBe(false);
  });
});
