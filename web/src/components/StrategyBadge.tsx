import { STRATEGIES } from '@/lib/solana';

const BADGE_STYLES: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  green: 'bg-green-50 text-green-700 border-green-200',
  purple: 'bg-purple-50 text-purple-700 border-purple-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-200',
  gray: 'bg-gray-100 text-gray-600 border-gray-200',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  pink: 'bg-pink-50 text-pink-700 border-pink-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export function StrategyBadge({ strategy }: { strategy: number }) {
  const s = STRATEGIES[strategy];
  if (!s) return <span className="text-neutral-500">Unknown</span>;
  const style = BADGE_STYLES[s.color] || BADGE_STYLES.gray;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border whitespace-nowrap ${style}`}>
      {s.name}
    </span>
  );
}
