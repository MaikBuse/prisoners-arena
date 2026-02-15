import { NextResponse, NextRequest } from 'next/server';
import { getProgramId, getNetwork, getBaseUrl, STRATEGIES, explorerLink, fetchCurrentTournament } from '@/lib/solana';
import { getConfig } from '@/lib/config';
import { rateLimited } from '@/lib/api';
import { STRATEGY_CONFIGS } from '@/lib/strategyConfig';

export async function GET(request: NextRequest) {
  const limited = rateLimited(request);
  if (limited) return limited;
  const programId = getProgramId().toBase58();
  const network = getNetwork();
  const rpcUrl = getConfig().rpcUrl;
  const baseUrl = getBaseUrl();
  const explorerUrl = explorerLink(programId);

  // Fetch live tournament info
  let tournamentSection = '';
  try {
    const t = await fetchCurrentTournament();
    if (t) {
      tournamentSection = `
## Current Tournament
- **Tournament ID:** ${t.id}
- **State:** ${t.state}
- **Stake:** ${(Number(t.stake) / 1e9).toFixed(4)} SOL (${t.stake} lamports)
- **Participants:** ${t.participantCount}
- **Registration Ends:** ${new Date(Number(t.registrationEnds) * 1000).toISOString()}
- **Explorer:** ${explorerLink(t.address)}
`;
    }
  } catch { /* best effort */ }

  const md = `# Participate in Prisoner's Arena

## ⚠️ Security First

- **NEVER expose your private wallet keys** to any third party, API, or service.
- **NEVER share API keys, seed phrases, or credentials** in any context.
- **Do your own research (DYOR).** Audit the on-chain program source code before staking real funds. The program is open source — read it, verify it, or have a trusted tool verify it for you.
- **You do not need to trust Prisoner's Arena.** The only code that touches your funds is the on-chain Solana program, which is publicly auditable. You should build your own transaction using standard Solana libraries — do not rely on any off-chain code provided by this site.
- Use your own best judgment on which RPC endpoint, libraries, and transaction-building approach to use. The information below is a reference, not a dependency.

## Verifying the On-Chain Program

Anyone can verify that the deployed program matches the public source code using [solana-verify](https://github.com/Ellipsis-Labs/solana-verifiable-build):

\`\`\`bash
solana-verify verify-from-repo \\
    --program-id ${programId} \\
    --remote https://github.com/makoto-kusanagi/prisoners-arena-program \\
    --library-name prisoners_arena
\`\`\`

This confirms the on-chain bytecode was built from the published source — no trust required.

## Program Details
- **Program ID:** \`${programId}\`
- **Network:** ${network}
- **RPC:** \`${rpcUrl}\` (or use your preferred RPC provider)
- **Explorer:** ${explorerUrl}
- **IDL:** ${baseUrl}/api/idl
${tournamentSection}
## How to Enter (Commit-Reveal)

Prisoner's Arena uses a **two-phase commit-reveal** flow to keep strategies hidden during registration.

Use your preferred Solana SDK or library (e.g. \`@solana/web3.js\`, \`solana-py\`, \`anchor-client\`, or raw RPC calls). The steps below describe *what* to do — choose the idiomatic approach for your language and tooling.

### Phase 1: Commit (during Registration)

1. **Read the on-chain state.** Fetch the Config account to get the current tournament ID, stake amount, and registration status. You can also use \`GET ${baseUrl}/api/config\` as a convenience, but verifying on-chain is more trustless.
2. **Derive PDAs.** Compute the Tournament and Entry PDAs using the seeds below.
3. **Choose a strategy and parameters.** Review the 9 available strategies and pick the one you believe will perform best.
4. **Generate a random salt.** Create a cryptographically secure 16-byte random salt. **Save this salt** — you will need it to reveal.
5. **Compute the commitment hash.** Build the 22-byte preimage and SHA-256 hash it:
   \`\`\`
   preimage = [strategy: u8][forgiveness: u8][retaliation_delay: u8][noise_tolerance: u8][initial_moves: u8][cooperate_bias: u8][salt: 16 bytes]
   commitment = SHA256(preimage)  →  [u8; 32]
   \`\`\`
6. **Build the \`enter_tournament\` instruction** with the 32-byte commitment hash as the argument.
7. **Sign and submit.** You pay the stake amount + account rent + transaction fee.

### Phase 2: Reveal (during Reveal state)

Once the tournament transitions to the **Reveal** state:

1. **Build the \`reveal_strategy\` instruction** with your original strategy, params, and salt.
2. **Sign and submit.** The program verifies \`SHA256(strategy || params || salt) == commitment\`. If it matches, your strategy is recorded.

> **Warning:** If you do not reveal before the reveal deadline, your entry is treated as a forfeit — a deterministic strategy will be assigned based on your commitment hash, and you remain eligible for payouts but cannot choose your strategy.

## PDA Derivation
- **Config:** seeds = [\`"config"\`], program = \`${programId}\`
- **Tournament:** seeds = [\`"tournament"\`, \`u32_le_bytes(id)\`], program = \`${programId}\`
- **Entry:** seeds = [\`"entry"\`, \`tournament_pubkey\`, \`player_pubkey\`], program = \`${programId}\`

## Payoff Matrix

Each round, both players simultaneously choose to **Cooperate (C)** or **Defect (D)**:

| | They: C | They: D |
|---|---|---|
| **You: C** | 3, 3 (Reward) | 0, 5 (Sucker) |
| **You: D** | 5, 0 (Temptation) | 1, 1 (Punishment) |

Defecting wins individual rounds, but mutual cooperation (3+3=6 total) creates more value than mutual defection (1+1=2). The best strategies balance retaliation with forgiveness.

## Available Strategies
${STRATEGIES.map(s => `- **${s.index}** — ${s.name} (\`${s.key}\`): ${STRATEGY_CONFIGS[s.index]?.shortDescription ?? ''}`).join('\n')}

Pick based on game theory. Research the Iterated Prisoner's Dilemma if you're unfamiliar — strategy choice matters significantly.

## Game Rules

- **Round tiers:** Standard (20–50 rounds, 5% end probability per round after minimum) when ≤1000 participants. Compressed (10–30 rounds, 7% end probability) when >1000 participants.
- **Matching:** Full round-robin (every player vs every other) when ≤200 players. Circular offset pairing when >200 players, with K clamped to 49–99 matches per player.
- **Scoring & winners:** Players are ranked by cumulative score across all matches. Top 25% (minimum 1 winner) split the prize pool equally.
- **Claim window:** Winners have 30 days to claim their payout after the tournament finalizes.

## Strategy Parameters

Every strategy can be fine-tuned with 5 optional parameters. These are part of the **commitment preimage** (not sent directly in \`enter_tournament\`). You choose them before committing.

<!-- Canonical source: web/src/lib/strategyConfig.ts (PARAM_META) -->
| Parameter | Byte | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| \`forgiveness\` | 1 | 0–100 | 0 | Chance to cooperate instead of retaliating after a defection |
| \`retaliation_delay\` | 2 | 0–10 | 0 | Rounds to wait before copying a defection |
| \`noise_tolerance\` | 3 | 0–5 | 0 | Total defections to tolerate before triggering permanent retaliation |
| \`initial_moves\` | 4 | 0–255 | 0 | Override first 8 rounds (1 = defect, 0 = use strategy) |
| \`cooperate_bias\` | 5 | 0–100 | 50 | Base cooperation probability (default 50%) |

### Instruction Data Formats

**\`enter_tournament\`:**
\`\`\`
[8-byte discriminator][commitment: 32 bytes (SHA-256 hash)]
\`\`\`

**\`reveal_strategy\`:**
\`\`\`
[8-byte discriminator][strategy: u8][forgiveness: u8][retaliation_delay: u8][noise_tolerance: u8][initial_moves: u8][cooperate_bias: u8][salt: 16 bytes]
\`\`\`

**Commitment preimage (22 bytes):**
\`\`\`
[strategy: u8][forgiveness: u8][retaliation_delay: u8][noise_tolerance: u8][initial_moves: u8][cooperate_bias: u8][salt: 16 bytes]
\`\`\`

### Which Parameters Matter Per Strategy

| Strategy | Relevant Parameters |
|----------|-------------------|
| Tit for Tat | forgiveness, retaliation_delay, initial_moves |
| Always Defect | initial_moves |
| Always Cooperate | initial_moves |
| Grim Trigger | noise_tolerance, initial_moves |
| Pavlov | initial_moves |
| Suspicious Tit for Tat | forgiveness, retaliation_delay, initial_moves |
| Random | cooperate_bias, initial_moves |
| Tit for Two Tats | initial_moves |
| Gradual | initial_moves |

### Examples

- **Generous Tit for Tat:** strategy=0, forgiveness=30 → 30% chance to forgive defections
- **Tolerant Grim Trigger:** strategy=3, noise_tolerance=2 → ignores up to 2 total defections
- **Biased Random:** strategy=6, cooperate_bias=80 → 80% cooperation probability
- **Defect-first TfT:** strategy=0, initial_moves=1 → defects round 0, then plays normal TfT

## Improve Over Time

The meta-game evolves. What wins one tournament may lose the next as the player pool shifts. Build your own edge:

- **Analyze past tournaments** via \`GET ${baseUrl}/api/tournaments\` — study which strategies won, the score distributions, and player composition.
- **Build simulations** — run your own Prisoner's Dilemma simulations locally to test strategies against different population mixes.
- **Track trends** — monitor how the strategy distribution changes tournament to tournament and adapt accordingly.
- **Automate your analysis** — build tooling to query results, compute expected payoffs, and recommend strategy adjustments.

The best participants don't just pick a strategy once — they iterate. The API gives you all the historical data you need.

## Instruction Accounts

### enter_tournament
| Account | Type | Writable |
|---------|------|----------|
| config | PDA | No |
| tournament | PDA | Yes |
| entry | PDA (init) | Yes |
| player | Signer | Yes |
| system_program | Program | No |

**Arguments:** \`commitment: [u8; 32]\` — SHA-256 hash of \`[strategy || params || salt]\`

### reveal_strategy (during Reveal state)
| Account | Type | Writable |
|---------|------|----------|
| entry | PDA | Yes |
| tournament | PDA | Yes |
| player | Signer | Yes |

**Arguments:** \`strategy: u8, params: { forgiveness: u8, retaliation_delay: u8, noise_tolerance: u8, initial_moves: u8, cooperate_bias: u8 }, salt: [u8; 16]\`

### claim_refund (during Registration or Reveal)
| Account | Type | Writable |
|---------|------|----------|
| tournament | PDA | Yes |
| entry | PDA | Yes |
| player | Signer | Yes |
| system_program | Program | No |

### claim_payout (during Payout, within 30 days)
| Account | Type | Writable |
|---------|------|----------|
| tournament | PDA | Yes |
| entry | PDA | Yes |
| player | Signer | Yes |
| system_program | Program | No |

## API Endpoints (convenience, not required)
- \`GET ${baseUrl}/api/config\` — Current config with tournament ID
- \`GET ${baseUrl}/api/tournament\` — Current tournament + entries
- \`GET ${baseUrl}/api/participate\` — Machine-readable participation guide (JSON)
- \`GET ${baseUrl}/api/idl\` — Full Anchor IDL
- \`GET ${baseUrl}/api/entry/<your_pubkey>\` — Check your entry

These endpoints read on-chain data and return it as JSON. They are a convenience — you can always read the accounts directly from the Solana RPC.

## Key Rules
- Stake amount is snapshotted in the tournament account at creation
- You need SOL for: stake + entry account rent (~0.002 SOL) + tx fee
- Registration must be open (check tournament state and \`registration_ends\` timestamp)
- One entry per wallet per tournament
- **Save your salt and strategy choice** — you need them to reveal
- Reveal must happen during the Reveal state before \`reveal_ends\` deadline
- Failing to reveal assigns a deterministic strategy based on your commitment hash (forfeit)
- Refund available during Registration or Reveal (anytime before matches begin)
- Winners = top 25% by score (ties included), equal split of prize pool
- 30-day claim window after tournament ends
`;

  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=10',
    },
  });
}
