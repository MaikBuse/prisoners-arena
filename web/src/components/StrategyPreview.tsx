'use client';
import { useMemo, useState } from 'react';
import { STRATEGIES, STRATEGY_BAR_COLORS } from '@/lib/solana';
import { isStochastic, simulateVsAll, simulateVsAllAggregated, type MatchResult } from '@/lib/simulate';
import type { ParamValues } from '@/lib/strategyConfig';

interface Props {
  strategy: number;
  params: ParamValues;
}

function MoveBoxes({ result, isA }: { result: MatchResult; isA: boolean }) {
  return (
    <div className="flex gap-0.5 mt-1">
      {result.rounds.map((r, i) => {
        const move = isA ? r.moveA : r.moveB;
        return (
          <div
            key={i}
            className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center
              ${move === 'C' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
          >
            {move}
          </div>
        );
      })}
    </div>
  );
}

export function StrategyPreview({ strategy, params }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const stochastic = isStochastic(strategy, params);

  const results = useMemo(() => {
    if (stochastic) {
      return simulateVsAllAggregated(strategy, params, 10, 100);
    }
    const raw = simulateVsAll(strategy, params, 10);
    return raw.map(r => ({
      opponent: r.opponent,
      opponentName: r.opponentName,
      avgScore: r.result.totalA,
      stddev: 0,
      sampleResult: r.result,
    }));
  }, [strategy, params, stochastic]);

  const maxScore = 50; // 10 rounds * max 5
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
        <p className="text-[10px] text-[var(--muted)]">Average over 100 simulations (10 rounds each)</p>
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
                  <div className="text-[10px] text-[var(--muted)] mb-0.5">Your moves:</div>
                  <MoveBoxes result={r.sampleResult} isA={true} />
                  <div className="text-[10px] text-[var(--muted)] mt-1 mb-0.5">Opponent moves:</div>
                  <MoveBoxes result={r.sampleResult} isA={false} />
                  <div className="text-[10px] text-neutral-400 mt-1">
                    Score: {r.sampleResult.totalA} – {r.sampleResult.totalB}
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
