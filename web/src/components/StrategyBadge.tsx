import { STRATEGIES, STRATEGY_COLORS } from '@/lib/solana';

export function StrategyBadge({ strategy }: { strategy: number }) {
  const s = STRATEGIES[strategy];
  if (!s) return <span className="text-zinc-500">Unknown</span>;
  const colors = STRATEGY_COLORS[s.color];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${colors}`}>
      {s.name}
    </span>
  );
}
