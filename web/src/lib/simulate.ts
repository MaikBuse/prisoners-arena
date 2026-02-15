import type { ParamValues } from './strategyConfig';
import { DEFAULT_PARAMS } from './strategyConfig';
import { STRATEGIES } from './solana';

// xorshift64* RNG
export class SeededRng {
  private state: bigint;

  constructor(seed: Uint8Array, matchIndex: number) {
    // Hash seed + matchIndex into a u64 state
    let h = BigInt(matchIndex) + 1n;
    for (let i = 0; i < Math.min(seed.length, 32); i++) {
      h = ((h << 5n) + h + BigInt(seed[i])) & 0xFFFFFFFFFFFFFFFFn;
    }
    // Ensure non-zero
    this.state = h === 0n ? 1n : h;
  }

  private constructor2(state: bigint) {
    this.state = state === 0n ? 1n : state;
  }

  forRound(round: number): SeededRng {
    const rng = new SeededRng(new Uint8Array(0), 0);
    let s = this.state ^ (BigInt(round) + 1n);
    if (s === 0n) s = 1n;
    rng.state = s;
    // Warm up
    rng.nextU64();
    return rng;
  }

  nextU64(): bigint {
    let s = this.state;
    s ^= (s >> 12n) & 0xFFFFFFFFFFFFFFFFn;
    s ^= (s << 25n) & 0xFFFFFFFFFFFFFFFFn;
    s ^= (s >> 27n) & 0xFFFFFFFFFFFFFFFFn;
    this.state = s;
    return (s * 0x2545F4914F6CDD1Dn) & 0xFFFFFFFFFFFFFFFFn;
  }

  nextU32(): number {
    return Number((this.nextU64() >> 32n) & 0xFFFFFFFFn);
  }

  nextPercent(): number {
    return this.nextU32() % 100;
  }

  nextRange(max: number): number {
    if (max === 0) return 0;
    return this.nextU32() % max;
  }
}

type Move = 'C' | 'D';

export function payoff(a: Move, b: Move): [number, number] {
  if (a === 'C' && b === 'C') return [3, 3];
  if (a === 'C' && b === 'D') return [0, 5];
  if (a === 'D' && b === 'C') return [5, 0];
  return [1, 1]; // D, D
}

export function executeStrategy(
  strategy: number,
  params: ParamValues,
  opponentHistory: Move[],
  myHistory: Move[],
  round: number,
  rng: SeededRng,
): Move {
  // Check initial_moves bitmask for rounds 0-7
  if (round < 8 && params.initial_moves !== 0) {
    if ((params.initial_moves >> round) & 1) {
      return 'D';
    }
  }

  let baseMove: Move;

  switch (strategy) {
    case 0: { // TitForTat
      if (round === 0) {
        baseMove = 'C';
      } else if (opponentHistory[round - 1] === 'C') {
        baseMove = 'C';
      } else {
        // Opponent's last move was Defect — check retaliation delay
        if (params.retaliation_delay > 0) {
          let lastDefectPos = -1;
          for (let i = opponentHistory.length - 1; i >= 0; i--) {
            if (opponentHistory[i] === 'D') { lastDefectPos = i; break; }
          }
          if (lastDefectPos >= 0) {
            const roundsSince = opponentHistory.length - 1 - lastDefectPos;
            if (roundsSince < params.retaliation_delay) {
              baseMove = 'C';
              break;
            }
          }
        }
        baseMove = 'D';
      }
      break;
    }
    case 1: // AlwaysDefect
      baseMove = 'D';
      break;
    case 2: // AlwaysCooperate
      baseMove = 'C';
      break;
    case 3: { // GrimTrigger
      const totalDefections = opponentHistory.filter(m => m === 'D').length;
      baseMove = totalDefections > params.noise_tolerance ? 'D' : 'C';
      break;
    }
    case 4: { // Pavlov
      if (round === 0) {
        baseMove = 'C';
      } else {
        const lastMe = myHistory[round - 1];
        const lastOpp = opponentHistory[round - 1];
        const [score] = payoff(lastMe, lastOpp);
        baseMove = score >= 3 ? lastMe : (lastMe === 'C' ? 'D' : 'C');
      }
      break;
    }
    case 5: { // SuspiciousTfT
      if (round === 0) {
        baseMove = 'D';
      } else if (opponentHistory[round - 1] === 'C') {
        baseMove = 'C';
      } else {
        // Opponent's last move was Defect — check retaliation delay
        if (params.retaliation_delay > 0) {
          let lastDefectPos = -1;
          for (let i = opponentHistory.length - 1; i >= 0; i--) {
            if (opponentHistory[i] === 'D') { lastDefectPos = i; break; }
          }
          if (lastDefectPos >= 0) {
            const roundsSince = opponentHistory.length - 1 - lastDefectPos;
            if (roundsSince < params.retaliation_delay) {
              baseMove = 'C';
              break;
            }
          }
        }
        baseMove = 'D';
      }
      break;
    }
    case 6: { // Random
      baseMove = rng.nextPercent() < params.cooperate_bias ? 'C' : 'D';
      break;
    }
    case 7: { // TitForTwoTats
      if (round < 2) {
        baseMove = 'C';
      } else {
        baseMove = (opponentHistory[round - 1] === 'D' && opponentHistory[round - 2] === 'D') ? 'D' : 'C';
      }
      break;
    }
    case 8: { // Gradual
      const theirDefections = opponentHistory.filter(m => m === 'D').length;
      const myDefections = myHistory.filter(m => m === 'D').length;
      const threshold = theirDefections * (theirDefections + 1) / 2;
      baseMove = myDefections < threshold ? 'D' : 'C';
      break;
    }
    default:
      baseMove = 'C';
  }

  // Forgiveness override: if base is D and forgiveness > 0, chance to cooperate
  if (baseMove === 'D' && params.forgiveness > 0 && (strategy === 0 || strategy === 5)) {
    if (rng.nextPercent() < params.forgiveness) {
      return 'C';
    }
  }

  return baseMove;
}

export interface RoundResult {
  moveA: Move;
  moveB: Move;
  scoreA: number;
  scoreB: number;
  cumA: number;
  cumB: number;
}

export interface MatchResult {
  rounds: RoundResult[];
  totalA: number;
  totalB: number;
}

export function runMatch(
  strategyA: number,
  paramsA: ParamValues,
  strategyB: number,
  paramsB: ParamValues,
  numRounds: number = 10,
  seed?: Uint8Array,
): MatchResult {
  const s = seed || new Uint8Array(32);
  const rng = new SeededRng(s, strategyA * 9 + strategyB);
  const historyA: Move[] = [];
  const historyB: Move[] = [];
  const rounds: RoundResult[] = [];
  let cumA = 0, cumB = 0;

  for (let r = 0; r < numRounds; r++) {
    const rngA = rng.forRound(r * 2);
    const rngB = rng.forRound(r * 2 + 1);
    const moveA = executeStrategy(strategyA, paramsA, historyB, historyA, r, rngA);
    const moveB = executeStrategy(strategyB, paramsB, historyA, historyB, r, rngB);
    const [sA, sB] = payoff(moveA, moveB);
    cumA += sA;
    cumB += sB;
    rounds.push({ moveA, moveB, scoreA: sA, scoreB: sB, cumA, cumB });
    historyA.push(moveA);
    historyB.push(moveB);
  }

  return { rounds, totalA: cumA, totalB: cumB };
}

export interface VsAllResult {
  opponent: number;
  opponentName: string;
  result: MatchResult;
}

export function simulateVsAll(
  strategyIndex: number,
  params: ParamValues,
  rounds: number = 10,
  seed?: Uint8Array,
): VsAllResult[] {
  return STRATEGIES.map((s) => ({
    opponent: s.index,
    opponentName: s.name,
    result: runMatch(strategyIndex, params, s.index, { ...DEFAULT_PARAMS }, rounds, seed),
  }));
}

export function isStochastic(strategy: number, params: ParamValues): boolean {
  return strategy === 6 || params.forgiveness > 0;
}

export interface AggregateVsAllResult {
  opponent: number;
  opponentName: string;
  avgScore: number;
  stddev: number;
  sampleResult: MatchResult;
}

export function simulateVsAllAggregated(
  strategyIndex: number,
  params: ParamValues,
  rounds: number = 10,
  iterations: number = 100,
): AggregateVsAllResult[] {
  const allResults: number[][] = STRATEGIES.map(() => []);
  let sampleResults: MatchResult[] = [];

  for (let i = 0; i < iterations; i++) {
    const seed = new Uint8Array(32);
    // Simple varying seed
    seed[0] = i & 0xFF;
    seed[1] = (i >> 8) & 0xFF;
    seed[2] = (i >> 16) & 0xFF;
    seed[3] = 42;
    const results = simulateVsAll(strategyIndex, params, rounds, seed);
    results.forEach((r, idx) => {
      allResults[idx].push(r.result.totalA);
    });
    if (i === 0) sampleResults = results.map(r => r.result);
  }

  return STRATEGIES.map((s, idx) => {
    const scores = allResults[idx];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((a, b) => a + (b - avg) ** 2, 0) / scores.length;
    return {
      opponent: s.index,
      opponentName: s.name,
      avgScore: avg,
      stddev: Math.sqrt(variance),
      sampleResult: sampleResults[idx],
    };
  });
}
