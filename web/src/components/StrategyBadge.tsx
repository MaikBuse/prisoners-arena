import { STRATEGIES } from '@/lib/solana';

const BADGE_STYLES: Record<string, string> = {
  blue: 'bg-strat-blue/15 text-strat-blue border-strat-blue/30',
  red: 'bg-strat-red/15 text-strat-red border-strat-red/30',
  green: 'bg-strat-green/15 text-strat-green border-strat-green/30',
  purple: 'bg-strat-purple/15 text-strat-purple border-strat-purple/30',
  amber: 'bg-strat-amber/15 text-strat-amber border-strat-amber/30',
  orange: 'bg-strat-orange/15 text-strat-orange border-strat-orange/30',
  gray: 'bg-strat-gray/15 text-strat-gray border-strat-gray/30',
  cyan: 'bg-strat-cyan/15 text-strat-cyan border-strat-cyan/30',
  pink: 'bg-strat-pink/15 text-strat-pink border-strat-pink/30',
  indigo: 'bg-strat-indigo/15 text-strat-indigo border-strat-indigo/30',
};

export function StrategyBadge({ strategy }: { strategy: number }) {
  const s = STRATEGIES[strategy];
  if (!s) return <span className="text-muted">Unknown</span>;
  const style = BADGE_STYLES[s.color] || BADGE_STYLES.gray;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border whitespace-nowrap ${style}`}>
      {s.name}
    </span>
  );
}
