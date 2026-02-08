import React from "react";
import { STRATEGIES } from "../types";

interface Props {
  value: string | null;
  onChange: (key: string) => void;
}

export function StrategyPicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-300">Choose Strategy</label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100"
      >
        <option value="" disabled>Select a strategy...</option>
        {STRATEGIES.map((s) => (
          <option key={s.key} value={s.key}>{s.label}</option>
        ))}
      </select>
      {value && (
        <p className="text-xs text-gray-500">
          {STRATEGIES.find((s) => s.key === value)?.desc}
        </p>
      )}
    </div>
  );
}
