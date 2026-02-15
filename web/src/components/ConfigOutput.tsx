'use client';
import { useState } from 'react';
import { CopyButton } from './CopyButton';
import { CLI_KEYS, type ParamValues } from '@/lib/strategyConfig';

interface Props {
  strategy: number;
  params: ParamValues;
}

const TABS = ['Commitment', 'Reveal Data', 'TypeScript'] as const;

export function ConfigOutput({ strategy, params }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('TypeScript');

  const cliKey = CLI_KEYS[strategy] || 'unknown';

  const preimageBytes = [strategy, params.forgiveness, params.retaliation_delay, params.noise_tolerance, params.initial_moves, params.cooperate_bias];
  const preimageHex = preimageBytes.map(b => `0x${b.toString(16).padStart(2, '0')}`).join(', ');

  const commitmentStr = `// Commitment preimage (6 bytes + 16-byte salt):
[${preimageHex}, ...salt(16 bytes)]

// commitment = SHA256(preimage) → 32 bytes
// Pass commitment to enter_tournament`;

  const revealStr = `// reveal_strategy instruction data:
strategy: ${strategy}  // ${cliKey}
params: { forgiveness: ${params.forgiveness}, retaliation_delay: ${params.retaliation_delay}, noise_tolerance: ${params.noise_tolerance}, initial_moves: ${params.initial_moves}, cooperate_bias: ${params.cooperate_bias} }
salt: <your 16-byte salt>`;

  const tsSnippet = `import { createHash, randomBytes } from 'crypto';

// 1. Choose strategy & params
const strategy = ${strategy}; // ${cliKey}
const params = [${params.forgiveness}, ${params.retaliation_delay}, ${params.noise_tolerance}, ${params.initial_moves}, ${params.cooperate_bias}];
// [forgiveness, retaliation_delay, noise_tolerance, initial_moves, cooperate_bias]

// 2. Generate salt (save this!)
const salt = randomBytes(16);

// 3. Compute commitment for enter_tournament
const preimage = Buffer.from([strategy, ...params, ...salt]);
const commitment = createHash('sha256').update(preimage).digest();

// 4. Reveal data for reveal_strategy (same values)
const revealData = { strategy, params, salt };`;

  const content = tab === 'Commitment' ? commitmentStr : tab === 'Reveal Data' ? revealStr : tsSnippet;

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
