'use client';
import { useState } from 'react';
import { CopyButton } from './CopyButton';
import { CLI_KEYS } from '@/lib/strategyConfig';

interface Props {
  strategy: number;
  bytecode?: number[] | null;
}

const TABS = ['Commitment', 'Reveal Data', 'TypeScript'] as const;

export function ConfigOutput({ strategy, bytecode }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('TypeScript');

  const cliKey = CLI_KEYS[strategy] || 'unknown';
  const isCustom = strategy === 9;
  const hasValidBytecode = isCustom && bytecode && bytecode.length > 0;

  // Custom with no valid bytecode: prompt
  if (isCustom && !hasValidBytecode) {
    return (
      <div className="space-y-2">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t}
              disabled
              className="px-2.5 py-1 text-xs rounded-md border border-card-border text-muted opacity-50 cursor-not-allowed"
            >
              {t}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted py-4 text-center">
          Write a valid bytecode program above to generate commitment
        </p>
      </div>
    );
  }

  let content: string;

  if (hasValidBytecode) {
    // Custom strategy: two-level SHA256 commitment
    const bytecodeHex = bytecode!.map(b => '0x' + b.toString(16).padStart(2, '0')).join(', ');

    const commitmentStr = `// Two-level commitment for Custom strategy:
// inner_hash = SHA256(bytecode)
// commitment = SHA256(0x09 || inner_hash || salt[16])
//
// Preimage structure: [strategy(1)] [inner_hash(32)] [salt(16)] = 49 bytes
// Pass commitment (32 bytes) to enter_tournament`;

    const revealStr = `// reveal_strategy instruction data:
strategy: 9  // custom
bytecode: [${bytecodeHex}]
salt: <your 16-byte salt>`;

    const tsSnippet = `import { createHash, randomBytes } from 'crypto';

// 1. Custom strategy bytecode
const bytecode = Buffer.from([${bytecodeHex}]);

// 2. Generate salt (save this!)
const salt = randomBytes(16);

// 3. Two-level commitment for enter_tournament
const innerHash = createHash('sha256').update(bytecode).digest();
const preimage = Buffer.concat([
  Buffer.from([9]),  // strategy = Custom
  innerHash,         // SHA256(bytecode)
  salt,              // 16-byte salt
]);
const commitment = createHash('sha256').update(preimage).digest();

// 4. Reveal data for reveal_strategy
const revealData = { strategy: 9, bytecode, salt };`;

    content = tab === 'Commitment' ? commitmentStr : tab === 'Reveal Data' ? revealStr : tsSnippet;
  } else {
    // Built-in strategy (0-8)
    const preimageHex = `0x${strategy.toString(16).padStart(2, '0')}`;

    const commitmentStr = `// Commitment preimage (1 byte strategy + 16-byte salt):
[${preimageHex}, ...salt(16 bytes)]

// commitment = SHA256(preimage) → 32 bytes
// Pass commitment to enter_tournament`;

    const revealStr = `// reveal_strategy instruction data:
strategy: ${strategy}  // ${cliKey}
salt: <your 16-byte salt>`;

    const tsSnippet = `import { createHash, randomBytes } from 'crypto';

// 1. Choose strategy
const strategy = ${strategy}; // ${cliKey}

// 2. Generate salt (save this!)
const salt = randomBytes(16);

// 3. Compute commitment for enter_tournament
const preimage = Buffer.from([strategy, ...salt]);
const commitment = createHash('sha256').update(preimage).digest();

// 4. Reveal data for reveal_strategy (same values)
const revealData = { strategy, salt };`;

    content = tab === 'Commitment' ? commitmentStr : tab === 'Reveal Data' ? revealStr : tsSnippet;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 text-xs rounded-md border transition-colors cursor-pointer
              ${tab === t
                ? 'bg-accent/15 border-accent/30 text-accent font-medium'
                : 'border-card-border text-muted hover:border-accent'
              }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="relative">
        <pre className="text-xs font-mono bg-surface border border-card-border rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
          {content}
        </pre>
        <div className="absolute top-2 right-2">
          <CopyButton text={content} />
        </div>
      </div>
    </div>
  );
}
