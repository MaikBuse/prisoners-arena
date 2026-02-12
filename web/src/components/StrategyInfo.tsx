'use client';
import { useState } from 'react';
import { STRATEGY_CONFIGS } from '@/lib/strategyConfig';
import { STRATEGIES } from '@/lib/solana';

interface Props {
  strategy: number;
}

export function StrategyInfo({ strategy }: Props) {
  const [open, setOpen] = useState(false);
  const config = STRATEGY_CONFIGS[strategy];
  const s = STRATEGIES[strategy];
  if (!config || !s) return null;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors cursor-pointer flex items-center gap-1"
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>About {s.name}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2 text-sm">
          <p className="text-[var(--muted)]">{config.description}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <p className="text-xs font-medium text-green-600 mb-1">✓ Strengths</p>
              <ul className="text-xs text-[var(--muted)] space-y-0.5">
                {config.strengths.map(s => <li key={s}>• {s}</li>)}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-red-600 mb-1">✗ Weaknesses</p>
              <ul className="text-xs text-[var(--muted)] space-y-0.5">
                {config.weaknesses.map(w => <li key={w}>• {w}</li>)}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
