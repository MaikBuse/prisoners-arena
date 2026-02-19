'use client';
import { useEffect, useState, useRef } from 'react';
import { STRATEGIES, STRATEGY_BAR_COLORS } from '@/lib/solana';
import { getWasm, makeStrategyJson } from '@/lib/matchReplay';
import type { WasmMatchResult } from '@/lib/matchReplay';
import { bytecodeIsStochastic } from '@/lib/bytecodeAssembler';

interface Props {
  strategy: number;
  bytecode?: number[] | null;
}

const MAX_DISPLAY_ROUNDS = 20;

// Built-in opponent indices (0-8) — skip Custom (9) as there's no meaningful default bytecode
const OPPONENT_INDICES = STRATEGIES.filter(s => s.index !== 9).map(s => s.index);

interface MatchSummary {
  opponent: number;
  opponentName: string;
  avgScore: number;
  stddev: number;
  sampleRounds: { moveA: 'C' | 'D'; moveB: 'C' | 'D' }[];
  sampleScoreA: number;
  sampleScoreB: number;
  roundCount: number;
}

function MoveBoxes({ rounds, isA }: { rounds: { moveA: 'C' | 'D'; moveB: 'C' | 'D' }[]; isA: boolean }) {
  const display = rounds.slice(0, MAX_DISPLAY_ROUNDS);
  const overflow = rounds.length > MAX_DISPLAY_ROUNDS;
  return (
    <div className="flex gap-0.5 mt-1 items-center">
      {display.map((r, i) => {
        const move = isA ? r.moveA : r.moveB;
        return (
          <div
            key={i}
            className={`w-4 h-4 rounded text-[8px] font-bold flex items-center justify-center
              ${move === 'C' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
          >
            {move}
          </div>
        );
      })}
      {overflow && (
        <span className="text-[9px] text-[var(--muted)]">+{rounds.length - MAX_DISPLAY_ROUNDS}</span>
      )}
    </div>
  );
}

function mapRounds(result: WasmMatchResult): { moveA: 'C' | 'D'; moveB: 'C' | 'D' }[] {
  return result.rounds.map(r => ({
    moveA: r.move_a === 'Cooperate' ? 'C' as const : 'D' as const,
    moveB: r.move_b === 'Cooperate' ? 'C' as const : 'D' as const,
  }));
}

async function runSimulation(
  strategy: number,
  bytecode: number[] | null | undefined,
  stochastic: boolean,
): Promise<MatchSummary[]> {
  const wasm = await getWasm();
  const stratJson = makeStrategyJson(strategy, bytecode);

  if (stochastic) {
    const ITERATIONS = 20;
    // Collect scores per opponent across iterations
    const scoresByOpponent: Map<number, number[]> = new Map();
    const sampleResults: Map<number, WasmMatchResult> = new Map();

    for (let iter = 0; iter < ITERATIONS; iter++) {
      const seed = new Uint8Array(32);
      seed[0] = iter & 0xff;
      seed[1] = (iter >> 8) & 0xff;
      seed[2] = 42;

      for (let i = 0; i < OPPONENT_INDICES.length; i++) {
        const oppIdx = OPPONENT_INDICES[i];
        const oppJson = makeStrategyJson(oppIdx);
        const result: WasmMatchResult = wasm.replay_match(stratJson, oppJson, seed, i, 10);

        if (!scoresByOpponent.has(oppIdx)) scoresByOpponent.set(oppIdx, []);
        scoresByOpponent.get(oppIdx)!.push(result.total_score_a);

        if (iter === 0) sampleResults.set(oppIdx, result);
      }
    }

    return OPPONENT_INDICES.map(oppIdx => {
      const scores = scoresByOpponent.get(oppIdx)!;
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((a, b) => a + (b - avg) ** 2, 0) / scores.length;
      const sample = sampleResults.get(oppIdx)!;
      return {
        opponent: oppIdx,
        opponentName: STRATEGIES[oppIdx].name,
        avgScore: avg,
        stddev: Math.sqrt(variance),
        sampleRounds: mapRounds(sample),
        sampleScoreA: sample.total_score_a,
        sampleScoreB: sample.total_score_b,
        roundCount: sample.round_count,
      };
    });
  }

  // Deterministic: single run
  const seed = new Uint8Array(32);
  return OPPONENT_INDICES.map((oppIdx, i) => {
    const oppJson = makeStrategyJson(oppIdx);
    const result: WasmMatchResult = wasm.replay_match(stratJson, oppJson, seed, i, 10);
    return {
      opponent: oppIdx,
      opponentName: STRATEGIES[oppIdx].name,
      avgScore: result.total_score_a,
      stddev: 0,
      sampleRounds: mapRounds(result),
      sampleScoreA: result.total_score_a,
      sampleScoreB: result.total_score_b,
      roundCount: result.round_count,
    };
  });
}

export function StrategyPreview({ strategy, bytecode }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [results, setResults] = useState<MatchSummary[] | null>(null);
  const [loading, setLoading] = useState(true);
  const runIdRef = useRef(0);

  const isCustom = strategy === 9;
  const stochastic = strategy === 6 || (isCustom && bytecode != null && bytecodeIsStochastic(bytecode));

  useEffect(() => {
    // Custom with no bytecode: show placeholder
    if (isCustom && !bytecode) {
      setResults(null);
      setLoading(false);
      return;
    }

    const runId = ++runIdRef.current;
    setLoading(true);

    runSimulation(strategy, bytecode, stochastic).then(res => {
      if (runId === runIdRef.current) {
        setResults(res);
        setLoading(false);
      }
    }).catch(() => {
      if (runId === runIdRef.current) {
        setResults(null);
        setLoading(false);
      }
    });
  }, [strategy, bytecode, isCustom, stochastic]);

  if (isCustom && !bytecode) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Preview vs All Strategies</h3>
        <p className="text-sm text-[var(--muted)] py-8 text-center">
          Write a valid bytecode program above to preview performance
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Preview vs All Strategies</h3>
        <div className="flex items-center justify-center py-8 gap-2 text-sm text-[var(--muted)]">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading match engine...
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Preview vs All Strategies</h3>
        <p className="text-sm text-[var(--muted)] py-8 text-center">
          Failed to load simulation results
        </p>
      </div>
    );
  }

  // Max possible score depends on round count (varies per match, use first result's round count * 5)
  const maxScore = (results[0]?.roundCount ?? 50) * 5;
  const totalAvg = results.reduce((a, r) => a + r.avgScore, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Preview vs All Strategies</h3>
        <span className="text-sm font-mono font-bold text-[var(--accent)]">
          Total: {stochastic ? totalAvg.toFixed(1) : totalAvg}
        </span>
      </div>
      {stochastic && (
        <p className="text-[10px] text-[var(--muted)]">Average over 20 simulations with varying seeds</p>
      )}
      <div className="space-y-1">
        {results.map(r => {
          const s = STRATEGIES[r.opponent];
          const barWidth = Math.min(100, (r.avgScore / maxScore) * 100);
          const isExpanded = expanded === r.opponent;
          return (
            <div key={r.opponent}>
              <button
                onClick={() => setExpanded(isExpanded ? null : r.opponent)}
                className="w-full flex items-center gap-2 py-1 hover:bg-neutral-50 rounded px-1 transition-colors cursor-pointer"
              >
                <span className="text-xs w-28 text-left truncate">{r.opponentName}</span>
                <div className="flex-1 h-4 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${STRATEGY_BAR_COLORS[s.color]}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <span className="text-xs font-mono w-14 text-right">
                  {stochastic
                    ? `${r.avgScore.toFixed(1)}±${r.stddev.toFixed(1)}`
                    : r.avgScore}
                </span>
                <span className="text-[10px] text-neutral-400">{isExpanded ? '▲' : '▼'}</span>
              </button>
              {isExpanded && (
                <div className="ml-1 pl-2 border-l-2 border-neutral-200 pb-1">
                  <div className="text-[10px] text-[var(--muted)] mb-0.5">
                    Your moves ({r.roundCount} rounds):
                  </div>
                  <MoveBoxes rounds={r.sampleRounds} isA={true} />
                  <div className="text-[10px] text-[var(--muted)] mt-1 mb-0.5">Opponent moves:</div>
                  <MoveBoxes rounds={r.sampleRounds} isA={false} />
                  <div className="text-[10px] text-neutral-400 mt-1">
                    Score: {r.sampleScoreA} – {r.sampleScoreB}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
