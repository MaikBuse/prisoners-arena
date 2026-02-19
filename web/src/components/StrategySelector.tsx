'use client';
import { STRATEGIES } from '@/lib/solana';

const SELECTED_RING: Record<string, string> = {
  blue: 'ring-blue-500 bg-blue-50',
  red: 'ring-red-500 bg-red-50',
  green: 'ring-green-500 bg-green-50',
  purple: 'ring-purple-500 bg-purple-50',
  amber: 'ring-amber-500 bg-amber-50',
  orange: 'ring-orange-500 bg-orange-50',
  gray: 'ring-gray-500 bg-gray-50',
  cyan: 'ring-cyan-500 bg-cyan-50',
  pink: 'ring-pink-500 bg-pink-50',
  indigo: 'ring-indigo-500 bg-indigo-50',
};

const COLOR_DOT: Record<string, string> = {
  blue: 'bg-blue-500', red: 'bg-red-500', green: 'bg-green-500',
  purple: 'bg-purple-500', amber: 'bg-amber-500', orange: 'bg-orange-500',
  gray: 'bg-gray-400', cyan: 'bg-cyan-500', pink: 'bg-pink-500',
  indigo: 'bg-indigo-500',
};

interface Props {
  selected: number;
  onSelect: (index: number) => void;
}

export function StrategySelector({ selected, onSelect }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {STRATEGIES.map((s) => {
        const isSelected = s.index === selected;
        return (
          <button
            key={s.index}
            onClick={() => onSelect(s.index)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all cursor-pointer
              ${isSelected
                ? `ring-2 ${SELECTED_RING[s.color]} border-transparent`
                : 'border-[var(--card-border)] bg-white hover:border-emerald-300'
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${COLOR_DOT[s.color]}`} />
            {s.name}
          </button>
        );
      })}
    </div>
  );
}
