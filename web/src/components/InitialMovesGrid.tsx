'use client';

interface Props {
  value: number;
  onChange: (value: number) => void;
}

export function InitialMovesGrid({ value, onChange }: Props) {
  const toggle = (bit: number) => {
    onChange(value ^ (1 << bit));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">▶ Initial Moves</label>
      <p className="text-xs text-[var(--muted)]">Override moves for rounds 0–7. Green = Cooperate, Red = Defect.</p>
      <div className="flex gap-1.5">
        {Array.from({ length: 8 }, (_, i) => {
          const isDefect = (value >> i) & 1;
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`w-9 h-9 rounded-md text-xs font-bold border-2 transition-all cursor-pointer
                ${isDefect
                  ? 'bg-red-100 border-red-400 text-red-700'
                  : 'bg-green-100 border-green-400 text-green-700'
                }`}
            >
              {isDefect ? 'D' : 'C'}
            </button>
          );
        })}
      </div>
      <p className="text-[10px] font-mono text-neutral-400">
        Hex: 0x{value.toString(16).padStart(2, '0').toUpperCase()}
      </p>
    </div>
  );
}
