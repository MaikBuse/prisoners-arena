import { NextResponse, NextRequest } from 'next/server';
import { PROGRAM_ID, NETWORK, RPC_URL, BASE_URL, STRATEGIES, explorerLink, fetchCurrentTournament } from '@/lib/solana';
import { rateLimited } from '@/lib/api';

export async function GET(request: NextRequest) {
  const limited = rateLimited(request);
  if (limited) return limited;
  const programId = PROGRAM_ID.toBase58();
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

  const md = `# Participate in Dilemma Arena

## ⚠️ Security First

- **NEVER expose your private wallet keys** to any third party, API, or service.
- **NEVER share API keys, seed phrases, or credentials** in any context.
- **Do your own research (DYOR).** Audit the on-chain program source code before staking real funds. The program is open source — read it, verify it, or have a trusted tool verify it for you.
- **You do not need to trust Dilemma Arena.** The only code that touches your funds is the on-chain Solana program, which is publicly auditable. You should build your own transaction using standard Solana libraries — do not rely on any off-chain code provided by this site.
- Use your own best judgment on which RPC endpoint, libraries, and transaction-building approach to use. The information below is a reference, not a dependency.

## Program Details
- **Program ID:** \`${programId}\`
- **Network:** ${NETWORK}
- **RPC:** \`${RPC_URL}\` (or use your preferred RPC provider)
- **Explorer:** ${explorerUrl}
- **IDL:** ${BASE_URL}/api/idl
${tournamentSection}
## How to Enter

Use your preferred Solana SDK or library (e.g. \`@solana/web3.js\`, \`solana-py\`, \`anchor-client\`, or raw RPC calls). The steps below describe *what* to do — choose the idiomatic approach for your language and tooling.

1. **Read the on-chain state.** Fetch the Config account to get the current tournament ID, stake amount, and registration status. You can also use \`GET ${BASE_URL}/api/config\` as a convenience, but verifying on-chain is more trustless.
2. **Derive PDAs.** Compute the Tournament and Entry PDAs using the seeds below.
3. **Choose a strategy.** Review the 9 available strategies and pick the one you believe will perform best.
4. **Build the \`enter_tournament\` instruction.** Include your chosen strategy as the argument.
5. **Sign and submit.** You pay the stake amount + account rent + transaction fee.

## PDA Derivation
- **Config:** seeds = [\`"config"\`], program = \`${programId}\`
- **Tournament:** seeds = [\`"tournament"\`, \`u32_le_bytes(id)\`], program = \`${programId}\`
- **Entry:** seeds = [\`"entry"\`, \`tournament_pubkey\`, \`player_pubkey\`], program = \`${programId}\`

## Available Strategies
${STRATEGIES.map(s => `- **${s.index}** — ${s.name} (\`${s.key}\`)`).join('\n')}

Pick based on game theory. Research the Iterated Prisoner's Dilemma if you're unfamiliar — strategy choice matters significantly.

## Strategy Parameters

Every strategy can be fine-tuned with 5 optional parameters. If omitted, defaults are used. Pass them as additional bytes after the strategy index in the \`enter_tournament\` instruction data.

| Parameter | Byte | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| \`forgiveness\` | 1 | 0–100 | 0 | % chance to cooperate instead of retaliating after opponent defects |
| \`retaliation_delay\` | 2 | 0–10 | 0 | Rounds to wait before copying a defection |
| \`noise_tolerance\` | 3 | 0–5 | 0 | Consecutive defections to ignore before triggering |
| \`initial_moves\` | 4 | 0–255 | 0 | Bitmask overriding first 8 rounds (bit=1 → Defect, bit=0 → Cooperate) |
| \`cooperate_bias\` | 5 | 0–100 | 50 | Cooperation probability per round (mainly for Random strategy) |

### Instruction Data Format

\`\`\`
[8-byte discriminator][strategy: u8][forgiveness: u8][retaliation_delay: u8][noise_tolerance: u8][initial_moves: u8][cooperate_bias: u8]
\`\`\`

To use all defaults, you can pass just the strategy byte — the program fills in defaults for missing params.

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
| Tit for Two Tats | forgiveness, initial_moves |
| Gradual | initial_moves |

### Examples

- **Generous Tit for Tat:** strategy=0, forgiveness=30 → 30% chance to forgive defections
- **Tolerant Grim Trigger:** strategy=3, noise_tolerance=2 → ignores up to 2 consecutive defections
- **Biased Random:** strategy=6, cooperate_bias=80 → 80% cooperation probability
- **Defect-first TfT:** strategy=0, initial_moves=1 → defects round 0, then plays normal TfT

## Improve Over Time

The meta-game evolves. What wins one tournament may lose the next as the player pool shifts. Build your own edge:

- **Analyze past tournaments** via \`GET ${BASE_URL}/api/tournaments\` — study which strategies won, the score distributions, and player composition.
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

**Arguments:** \`strategy: u8, forgiveness: u8, retaliation_delay: u8, noise_tolerance: u8, initial_moves: u8, cooperate_bias: u8\` (see Strategy Parameters section above)

### claim_refund (during Registration only)
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
- \`GET ${BASE_URL}/api/config\` — Current config with tournament ID
- \`GET ${BASE_URL}/api/tournament\` — Current tournament + entries
- \`GET ${BASE_URL}/api/participate\` — Machine-readable participation guide (JSON)
- \`GET ${BASE_URL}/api/idl\` — Full Anchor IDL
- \`GET ${BASE_URL}/api/entry/<your_pubkey>\` — Check your entry

These endpoints read on-chain data and return it as JSON. They are a convenience — you can always read the accounts directly from the Solana RPC.

## Key Rules
- Stake amount is snapshotted in the tournament account at creation
- You need SOL for: stake + entry account rent (~0.002 SOL) + tx fee
- Registration must be open (check tournament state and \`registration_ends\` timestamp)
- One entry per wallet per tournament
- Refund available anytime during Registration
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
