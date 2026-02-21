'use client';
import { STRATEGIES } from '@/lib/solana';

const SELECTED_RING: Record<string, string> = {
  blue: 'ring-strat-blue bg-strat-blue/10',
  red: 'ring-strat-red bg-strat-red/10',
  green: 'ring-strat-green bg-strat-green/10',
  purple: 'ring-strat-purple bg-strat-purple/10',
  amber: 'ring-strat-amber bg-strat-amber/10',
  orange: 'ring-strat-orange bg-strat-orange/10',
  gray: 'ring-strat-gray bg-strat-gray/10',
  cyan: 'ring-strat-cyan bg-strat-cyan/10',
  pink: 'ring-strat-pink bg-strat-pink/10',
  indigo: 'ring-strat-indigo bg-strat-indigo/10',
};

const COLOR_DOT: Record<string, string> = {
  blue: 'bg-strat-blue', red: 'bg-strat-red', green: 'bg-strat-green',
  purple: 'bg-strat-purple', amber: 'bg-strat-amber', orange: 'bg-strat-orange',
  gray: 'bg-strat-gray', cyan: 'bg-strat-cyan', pink: 'bg-strat-pink',
  indigo: 'bg-strat-indigo',
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
                : 'border-card-border bg-card hover:border-accent'
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
