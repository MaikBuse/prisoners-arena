'use client';
import { useState } from 'react';
import { CopyButton } from './CopyButton';
import { CLI_KEYS, DEFAULT_PARAMS, type ParamValues } from '@/lib/strategyConfig';

interface Props {
  strategy: number;
  params: ParamValues;
}

const TABS = ['CLI Command', 'Instruction Bytes', 'TypeScript'] as const;

export function ConfigOutput({ strategy, params }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('CLI Command');

  const cliKey = CLI_KEYS[strategy] || 'unknown';

  // Build CLI flags (only non-default)
  const flags: string[] = [];
  if (params.forgiveness !== DEFAULT_PARAMS.forgiveness) flags.push(`--forgiveness ${params.forgiveness}`);
  if (params.retaliation_delay !== DEFAULT_PARAMS.retaliation_delay) flags.push(`--retaliation-delay ${params.retaliation_delay}`);
  if (params.noise_tolerance !== DEFAULT_PARAMS.noise_tolerance) flags.push(`--noise-tolerance ${params.noise_tolerance}`);
  if (params.initial_moves !== DEFAULT_PARAMS.initial_moves) flags.push(`--initial-moves 0x${params.initial_moves.toString(16).padStart(2, '0')}`);
  if (params.cooperate_bias !== DEFAULT_PARAMS.cooperate_bias) flags.push(`--cooperate-bias ${params.cooperate_bias}`);

  const cli = `arena enter <WALLET_PATH> ${cliKey}${flags.length ? ' ' + flags.join(' ') : ''}`;

  const bytes = [strategy, params.forgiveness, params.retaliation_delay, params.noise_tolerance, params.initial_moves, params.cooperate_bias];
  const hex = bytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ');
  const bytesStr = `[${hex}]`;

  const tsSnippet = `Buffer.from([
  ${strategy},    // strategy: ${cliKey}
  ${params.forgiveness},    // forgiveness
  ${params.retaliation_delay},    // retaliation_delay
  ${params.noise_tolerance},    // noise_tolerance
  ${params.initial_moves},    // initial_moves
  ${params.cooperate_bias},   // cooperate_bias
])`;

  const content = tab === 'CLI Command' ? cli : tab === 'Instruction Bytes' ? bytesStr : tsSnippet;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer
              ${tab === t
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-medium'
                : 'border-[var(--card-border)] text-[var(--muted)] hover:border-emerald-300'
              }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="text-xs font-mono bg-neutral-50 border border-[var(--card-border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
          {content}
        </pre>
        <div className="absolute top-2 right-2">
          <CopyButton text={content} />
        </div>
      </div>
    </div>
  );
}
