import { Connection, PublicKey } from '@solana/web3.js';
import { getConfig } from './config';

// Lazy-initialized singletons
let _programId: PublicKey | null = null;
let _connection: Connection | null = null;

export function getProgramId(): PublicKey {
  if (!_programId) {
    _programId = new PublicKey(getConfig().programId);
  }
  return _programId;
}

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(getConfig().rpcUrl, 'confirmed');
  }
  return _connection;
}

export function getNetwork(): string {
  return getConfig().network;
}

export function getBaseUrl(): string {
  return getConfig().baseUrl;
}

export const EXPLORER_BASE = 'https://explorer.solana.com';

// Discriminators
const DISCRIMINATORS = {
  Config: Buffer.from([155, 12, 170, 224, 30, 250, 204, 130]),
  Tournament: Buffer.from([175, 139, 119, 242, 115, 194, 57, 92]),
  Entry: Buffer.from([63, 18, 152, 113, 215, 246, 221, 250]),
};

// Strategy enum
export const STRATEGIES = [
  { index: 0, name: 'Tit for Tat', key: 'TitForTat', color: 'blue' },
  { index: 1, name: 'Always Defect', key: 'AlwaysDefect', color: 'red' },
  { index: 2, name: 'Always Cooperate', key: 'AlwaysCooperate', color: 'green' },
  { index: 3, name: 'Grim Trigger', key: 'GrimTrigger', color: 'purple' },
  { index: 4, name: 'Pavlov', key: 'Pavlov', color: 'amber' },
  { index: 5, name: 'Suspicious TfT', key: 'SuspiciousTitForTat', color: 'orange' },
  { index: 6, name: 'Random', key: 'Random', color: 'gray' },
  { index: 7, name: 'Tit for Two Tats', key: 'TitForTwoTats', color: 'cyan' },
  { index: 8, name: 'Gradual', key: 'Gradual', color: 'pink' },
  { index: 9, name: 'Custom', key: 'Custom', color: 'indigo' },
] as const;

export type StrategyIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const STRATEGY_BAR_COLORS: Record<string, string> = {
  blue: 'bg-strat-blue',
  red: 'bg-strat-red',
  green: 'bg-strat-green',
  purple: 'bg-strat-purple',
  amber: 'bg-strat-amber',
  orange: 'bg-strat-orange',
  gray: 'bg-strat-gray',
  cyan: 'bg-strat-cyan',
  pink: 'bg-strat-pink',
  indigo: 'bg-strat-indigo',
};

// Explorer link — omit cluster param for mainnet-beta
export function explorerLink(address: string, type: 'address' | 'tx' = 'address'): string {
  const base = `${EXPLORER_BASE}/${type}/${address}`;
  const network = getNetwork();
  if (network === 'mainnet-beta') return base;
  return `${base}?cluster=${network}`;
}

// Cache
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_CURRENT = 10_000;

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < ttl) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, ts: Date.now() });
}

// Buffer helpers
function readU8(buf: Buffer, offset: number): number {
  return buf[offset];
}

function readU16LE(buf: Buffer, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function readU32LE(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

function readI64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}

function readU64LE(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

function readPubkey(buf: Buffer, offset: number): string {
  return new PublicKey(buf.subarray(offset, offset + 32)).toBase58();
}

function readBool(buf: Buffer, offset: number): boolean {
  return buf[offset] !== 0;
}

// PDA derivation
export function deriveConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('config')],
    getProgramId()
  );
}

export function deriveTournamentPDA(id: number): [PublicKey, number] {
  const idBuf = Buffer.alloc(4);
  idBuf.writeUInt32LE(id);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('tournament'), idBuf],
    getProgramId()
  );
}

export function deriveEntryPDA(tournamentPubkey: PublicKey, playerPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('entry'), tournamentPubkey.toBuffer(), playerPubkey.toBuffer()],
    getProgramId()
  );
}

// Deserialization
export interface ConfigAccount {
  admin: string;
  operator: string;
  houseFeeBps: number;
  stake: string;
  minParticipants: number;
  maxParticipants: number;
  registrationDuration: string;
  matchesPerPlayer: number;
  accumulatedFees: string;
  currentTournamentId: number;
  revealDuration: string;  // v1.7
  bump: number;
  operatorTxFee: string;   // v1.8
  address: string;
}

export function deserializeConfig(data: Buffer, address: string): ConfigAccount {
  let offset = 8;
  const admin = readPubkey(data, offset); offset += 32;
  const operator = readPubkey(data, offset); offset += 32;
  const houseFeeBps = readU16LE(data, offset); offset += 2;
  const stake = readU64LE(data, offset).toString(); offset += 8;
  const minParticipants = readU16LE(data, offset); offset += 2;
  const maxParticipants = readU16LE(data, offset); offset += 2;
  const registrationDuration = readI64LE(data, offset).toString(); offset += 8;
  const matchesPerPlayer = readU16LE(data, offset); offset += 2;
  const accumulatedFees = readU64LE(data, offset).toString(); offset += 8;
  const currentTournamentId = readU32LE(data, offset); offset += 4;
  const revealDuration = readI64LE(data, offset).toString(); offset += 8;  // v1.7
  const bump = readU8(data, offset); offset += 1;
  // v1.8: operator_tx_fee (reads from padding on old accounts → 0)
  const operatorTxFee = (offset + 8 <= data.length) ? readU64LE(data, offset).toString() : '0'; offset += 8;
  return { admin, operator, houseFeeBps, stake, minParticipants, maxParticipants, registrationDuration, matchesPerPlayer, accumulatedFees, currentTournamentId, revealDuration, bump, operatorTxFee, address };
}

export type TournamentState = 'Registration' | 'Reveal' | 'Running' | 'Payout';

export interface TournamentAccount {
  id: number;
  state: TournamentState;
  stake: string;
  houseFeeBps: number;
  matchesPerPlayer: number;
  registrationDuration: string;
  pool: string;
  participantCount: number;
  registrationEnds: string;
  matchesCompleted: number;
  matchesTotal: number;
  randomnessSeed: string;
  minWinningScore: number;
  winnerCount: number;
  winnerPool: string;
  claimsProcessed: number;
  payoutStartedAt: string;
  entriesRemaining: number;
  roundTier: number;
  revealEnds: string;           // v1.7
  revealDuration: string;       // v1.7
  revealsCompleted: number;     // v1.7
  forfeits: number;             // v1.7
  players: string[];
  scores: number[];
  strategies: number[];
  bump: number;
  operatorCosts: string;   // v1.8
  address: string;
  bytecodes?: (number[] | null)[];  // v1.9: custom strategy bytecodes (from Entry accounts, null = builtin)
}

const STATE_MAP: TournamentState[] = ['Registration', 'Reveal', 'Running', 'Payout'];

export function deserializeTournament(data: Buffer, address: string): TournamentAccount {
  let offset = 8;
  const id = readU32LE(data, offset); offset += 4;
  const stateVal = readU8(data, offset); offset += 1;
  const state = STATE_MAP[stateVal] || 'Registration';
  const stake = readU64LE(data, offset).toString(); offset += 8;
  const houseFeeBps = readU16LE(data, offset); offset += 2;
  const matchesPerPlayer = readU16LE(data, offset); offset += 2;
  const registrationDuration = readI64LE(data, offset).toString(); offset += 8;
  const pool = readU64LE(data, offset).toString(); offset += 8;
  const participantCount = readU32LE(data, offset); offset += 4;
  const registrationEnds = readI64LE(data, offset).toString(); offset += 8;
  const matchesCompleted = readU32LE(data, offset); offset += 4;
  const matchesTotal = readU32LE(data, offset); offset += 4;
  const randomnessSeed = Buffer.from(data.subarray(offset, offset + 32)).toString('hex'); offset += 32;
  const minWinningScore = readU32LE(data, offset); offset += 4;
  const winnerCount = readU32LE(data, offset); offset += 4;
  const winnerPool = readU64LE(data, offset).toString(); offset += 8;
  const claimsProcessed = readU32LE(data, offset); offset += 4;
  const payoutStartedAt = readI64LE(data, offset).toString(); offset += 8;
  const entriesRemaining = readU32LE(data, offset); offset += 4;
  const roundTier = readU8(data, offset); offset += 1;
  // v1.7 fields
  const revealEnds = readI64LE(data, offset).toString(); offset += 8;
  const revealDuration = readI64LE(data, offset).toString(); offset += 8;
  const revealsCompleted = readU32LE(data, offset); offset += 4;
  const forfeits = readU32LE(data, offset); offset += 4;

  const playersLen = readU32LE(data, offset); offset += 4;
  const players: string[] = [];
  for (let i = 0; i < playersLen; i++) {
    players.push(readPubkey(data, offset)); offset += 32;
  }

  const scoresLen = readU32LE(data, offset); offset += 4;
  const scores: number[] = [];
  for (let i = 0; i < scoresLen; i++) {
    scores.push(readU32LE(data, offset)); offset += 4;
  }

  const strategiesLen = readU32LE(data, offset); offset += 4;
  const strategies: number[] = [];
  for (let i = 0; i < strategiesLen; i++) {
    strategies.push(readU8(data, offset)); offset += 1;
  }

  const bump = readU8(data, offset); offset += 1;
  // v1.8: operator_costs (reads from padding on old accounts → 0)
  const operatorCosts = (offset + 8 <= data.length) ? readU64LE(data, offset).toString() : '0';

  return { id, state, stake, houseFeeBps, matchesPerPlayer, registrationDuration, pool, participantCount, registrationEnds, matchesCompleted, matchesTotal, randomnessSeed, minWinningScore, winnerCount, winnerPool, claimsProcessed, payoutStartedAt, entriesRemaining, roundTier, revealEnds, revealDuration, revealsCompleted, forfeits, players, scores, strategies, bump, operatorCosts, address };
}

export interface EntryAccount {
  tournament: string;
  player: string;
  index: number;
  commitment: string;    // v1.7 — hex-encoded SHA256
  strategy: number;
  strategyName: string;
  revealed: boolean;     // v1.7
  score: number;
  matchesPlayed: number;
  paidOut: boolean;
  createdAt: string;
  bump: number;
  address: string;
  bytecodeLen: number;   // v1.9
  bytecode: number[];    // v1.9
}

export function deserializeEntry(data: Buffer, address: string): EntryAccount {
  let offset = 8;
  const tournament = readPubkey(data, offset); offset += 32;
  const player = readPubkey(data, offset); offset += 32;
  const index = readU32LE(data, offset); offset += 4;
  // v1.7: commitment hash
  const commitment = Buffer.from(data.subarray(offset, offset + 32)).toString('hex'); offset += 32;
  const strategy = readU8(data, offset); offset += 1;
  const strategyName = STRATEGIES[strategy]?.name || 'Unknown';
  // v1.7: revealed flag
  const revealed = readBool(data, offset); offset += 1;
  const score = readU32LE(data, offset); offset += 4;
  const matchesPlayed = readU16LE(data, offset); offset += 2;
  const paidOut = readBool(data, offset); offset += 1;
  const createdAt = readI64LE(data, offset).toString(); offset += 8;
  const bump = readU8(data, offset); offset += 1;
  // v1.9: bytecode fields (reads 0 from padding on old accounts)
  const bytecodeLen = offset < data.length ? readU8(data, offset) : 0; offset += 1;
  const bytecode: number[] = [];
  for (let i = 0; i < 64; i++) {
    bytecode.push(offset + i < data.length ? readU8(data, offset + i) : 0);
  }
  return { tournament, player, index, commitment, strategy, strategyName, revealed, score, matchesPlayed, paidOut, createdAt, bump, address, bytecodeLen, bytecode: bytecode.slice(0, bytecodeLen) };
}

// Fetch functions
export async function fetchConfig(): Promise<ConfigAccount | null> {
  const cached = getCached<ConfigAccount>('config', CACHE_TTL_CURRENT);
  if (cached) return cached;

  const [pda] = deriveConfigPDA();
  const info = await getConnection().getAccountInfo(pda);
  if (!info) return null;

  const config = deserializeConfig(Buffer.from(info.data), pda.toBase58());
  setCache('config', config);
  return config;
}

export async function fetchTournament(id: number): Promise<TournamentAccount | null> {
  const cacheKey = `tournament-${id}`;
  const cached = getCached<TournamentAccount>(cacheKey, CACHE_TTL_CURRENT);
  if (cached) return cached;

  const [pda] = deriveTournamentPDA(id);
  const info = await getConnection().getAccountInfo(pda);
  if (!info) return null;

  const tournament = deserializeTournament(Buffer.from(info.data), pda.toBase58());
  setCache(cacheKey, tournament);
  return tournament;
}

export async function fetchCurrentTournament(): Promise<TournamentAccount | null> {
  const config = await fetchConfig();
  if (!config) return null;
  return fetchTournament(config.currentTournamentId);
}

export async function getAllEntries(tournamentPubkey: string): Promise<EntryAccount[]> {
  const cacheKey = `entries-${tournamentPubkey}`;
  const cached = getCached<EntryAccount[]>(cacheKey, CACHE_TTL_CURRENT);
  if (cached) return cached;

  const tournamentPk = new PublicKey(tournamentPubkey);
  const accounts = await getConnection().getProgramAccounts(getProgramId(), {
    filters: [
      { memcmp: { offset: 0, bytes: Buffer.from(DISCRIMINATORS.Entry).toString('base64'), encoding: 'base64' } },
      { memcmp: { offset: 8, bytes: tournamentPk.toBase58() } },
    ],
  });

  const entries = accounts.map(({ pubkey, account }) =>
    deserializeEntry(Buffer.from(account.data), pubkey.toBase58())
  );
  entries.sort((a, b) => b.score - a.score);
  setCache(cacheKey, entries);
  return entries;
}

export async function fetchEntryByPlayer(playerPubkey: string): Promise<EntryAccount | null> {
  const config = await fetchConfig();
  if (!config) return null;

  const activeId = config.currentTournamentId;
  const [tournamentPda] = deriveTournamentPDA(activeId);
  const playerPk = new PublicKey(playerPubkey);
  const [entryPda] = deriveEntryPDA(tournamentPda, playerPk);
  const info = await getConnection().getAccountInfo(entryPda);
  if (!info) return null;

  return deserializeEntry(Buffer.from(info.data), entryPda.toBase58());
}

export async function fetchTournamentList(limit = 10, offset = 0): Promise<TournamentAccount[]> {
  const config = await fetchConfig();
  if (!config) return [];

  const tournaments: TournamentAccount[] = [];
  const start = Math.max(0, config.currentTournamentId - offset);
  const end = Math.max(0, start - limit);

  for (let i = start; i >= end; i--) {
    try {
      const t = await fetchTournament(i);
      if (t) tournaments.push(t);
    } catch {
      // Skip tournaments that fail to deserialize (e.g. closed/zeroed accounts)
    }
  }
  return tournaments;
}

export function formatLamports(lamports: string | bigint): string {
  const val = typeof lamports === 'string' ? BigInt(lamports) : lamports;
  const sol = Number(val) / 1e9;
  return sol.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

export function truncateAddress(addr: string, chars = 4): string {
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`;
}

export function getTierLabel(roundTier: number): string {
  switch (roundTier) {
    case 0: return 'Standard (20-50 rounds)';
    case 1: return 'Compressed (10-30 rounds)';
    default: return 'Unknown';
  }
}
