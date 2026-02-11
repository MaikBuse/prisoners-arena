import { STRATEGIES } from '@/lib/solana';
import type { StrategyParams } from '@/lib/api';

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
};

export function StrategyBadge({ strategy }: { strategy: number }) {
  const s = STRATEGIES[strategy];
  if (!s) return <span className="text-neutral-500">Unknown</span>;
  const style = BADGE_STYLES[s.color] || BADGE_STYLES.gray;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${style}`}>
      {s.name}
    </span>
  );
}

/** Compact inline pills showing only non-default param values */
export function ParamPills({ params }: { params: StrategyParams | null }) {
  if (!params) return null;

  const pills: { label: string; value: string; color: string }[] = [];

  if (params.cooperateBias !== 50)
    pills.push({ label: '🎯', value: `${params.cooperateBias}%`, color: 'bg-blue-100 text-blue-700' });
  if (params.forgiveness > 0)
    pills.push({ label: '♡', value: `${params.forgiveness}%`, color: 'bg-green-100 text-green-700' });
  if (params.retaliationDelay > 0)
    pills.push({ label: '⏱', value: `${params.retaliationDelay}`, color: 'bg-amber-100 text-amber-700' });
  if (params.noiseTolerance > 0)
    pills.push({ label: '🛡', value: `${params.noiseTolerance}`, color: 'bg-purple-100 text-purple-700' });
  if (params.initialMoves > 0)
    pills.push({ label: '▶', value: `${params.initialMoves}`, color: 'bg-orange-100 text-orange-700' });

  if (pills.length === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 ml-1.5">
      {pills.map(p => (
        <span key={p.label} className={`inline-flex items-center rounded-full px-1.5 py-0 text-[10px] font-medium ${p.color}`}>
          {p.label}{p.value}
        </span>
      ))}
    </span>
  );
}

/** Full params detail panel for expandable rows */
export function ParamsDetail({ params }: { params: StrategyParams }) {
  const rows: { label: string; icon: string; value: number; unit: string; description: string; isDefault: boolean }[] = [
    { label: 'Cooperate Bias', icon: '🎯', value: params.cooperateBias, unit: '%', description: 'Base cooperation probability for Random strategy', isDefault: params.cooperateBias === 50 },
    { label: 'Forgiveness', icon: '♡', value: params.forgiveness, unit: '%', description: 'Chance to cooperate after opponent defects', isDefault: params.forgiveness === 0 },
    { label: 'Retaliation Delay', icon: '⏱', value: params.retaliationDelay, unit: ' rounds', description: 'Rounds to wait before retaliating', isDefault: params.retaliationDelay === 0 },
    { label: 'Noise Tolerance', icon: '🛡', value: params.noiseTolerance, unit: '', description: 'Consecutive defections before triggering', isDefault: params.noiseTolerance === 0 },
    { label: 'Initial Moves', icon: '▶', value: params.initialMoves, unit: '', description: 'Bitmask of opening moves', isDefault: params.initialMoves === 0 },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {rows.map(r => (
        <div key={r.label} className={`rounded-lg px-3 py-2 border ${r.isDefault ? 'bg-neutral-50 border-neutral-200 opacity-50' : 'bg-white border-[var(--card-border)]'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--muted)]">{r.icon} {r.label}</span>
            <span className={`text-sm font-mono font-bold ${r.isDefault ? 'text-neutral-400' : ''}`}>
              {r.value}{r.unit}
            </span>
          </div>
          <div className="text-[10px] text-neutral-400 mt-0.5">{r.description}</div>
        </div>
      ))}
    </div>
  );
}
