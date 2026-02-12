'use client';
import { PARAM_META, STRATEGY_CONFIGS, DEFAULT_PARAMS, type ParamValues } from '@/lib/strategyConfig';

interface Props {
  strategy: number;
  params: ParamValues;
  onChange: (params: ParamValues) => void;
}

export function ParamPanel({ strategy, params, onChange }: Props) {
  const config = STRATEGY_CONFIGS[strategy];
  if (!config) return null;

  const relevant = PARAM_META.filter(p => config.relevantParams.includes(p.key));

  const setParam = (key: string, value: number) => {
    onChange({ ...params, [key]: value });
  };

  const applyPreset = (preset: (typeof config.presets)[number]) => {
    const newParams = { ...DEFAULT_PARAMS, initial_moves: params.initial_moves };
    for (const [k, v] of Object.entries(preset.params)) {
      (newParams as Record<string, number>)[k] = v as number;
    }
    onChange(newParams);
  };

  return (
    <div className="space-y-4">
      {relevant.length > 0 && (
        <div className="space-y-3">
          {relevant.map(meta => (
            <div key={meta.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  {meta.icon} {meta.label}
                </label>
                <span className="text-sm font-mono font-bold text-[var(--accent)]">
                  {(params as Record<string, number>)[meta.key]}{meta.unit}
                </span>
              </div>
              <p className="text-xs text-[var(--muted)]">{meta.description}</p>
              <input
                type="range"
                min={meta.min}
                max={meta.max}
                step={meta.step}
                value={(params as Record<string, number>)[meta.key]}
                onChange={e => setParam(meta.key, Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-emerald-500 bg-neutral-200"
              />
              <div className="flex justify-between text-[10px] text-neutral-400">
                <span>{meta.min}</span>
                <span>{meta.max}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {config.presets.length > 1 && (
        <div>
          <p className="text-xs text-[var(--muted)] mb-1.5">Presets</p>
          <div className="flex flex-wrap gap-1.5">
            {config.presets.map(preset => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="px-2.5 py-1 text-xs rounded-md border border-[var(--card-border)] hover:border-emerald-300 hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
