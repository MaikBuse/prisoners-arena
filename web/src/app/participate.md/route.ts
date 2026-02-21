import { NextResponse, NextRequest } from 'next/server';
import { getProgramId, getNetwork, getBaseUrl, STRATEGIES, EXPLORER_BASE, explorerLink, fetchCurrentTournament } from '@/lib/solana';
import { getConfig, resolveNetwork } from '@/lib/config';
import { rateLimited } from '@/lib/api';
import { STRATEGY_CONFIGS } from '@/lib/strategyConfig';
import { runWithNetwork } from '@/lib/network-context';
import { getAllNetworkConfigs } from '@/lib/network-config';

export async function GET(request: NextRequest) {
  const network = resolveNetwork(request);
  return runWithNetwork(network, async () => {
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
    https://github.com/makoto-kusanagi/prisoners-arena-program \\
    --program-id ${programId} \\
    --library-name prisoners_arena
\`\`\`

This confirms the on-chain bytecode was built from the published source — no trust required.

## Program Deployments

${(() => {
  const configs = getAllNetworkConfigs();
  const explorerUrl = (pid: string, net: string) => {
    const base = `${EXPLORER_BASE}/address/${pid}`;
    return net === 'mainnet-beta' ? base : `${base}?cluster=${net}`;
  };
  return `| | Devnet | Mainnet |
|---|---|---|
| **Program ID** | \`${configs[0].programId}\` | \`${configs[1].programId}\` |
| **Network** | devnet | mainnet-beta |
| **RPC** | \`${configs[0].rpcUrl}\` | \`${configs[1].rpcUrl}\` |
| **Base URL** | ${configs[0].baseUrl.replace('https://', '')} | ${configs[1].baseUrl.replace('https://', '')} |
| **IDL** | ${configs[0].baseUrl}/api/idl | ${configs[1].baseUrl}/api/idl |
| **Explorer** | [View on Explorer](${explorerUrl(configs[0].programId, configs[0].network)}) | [View on Explorer](${explorerUrl(configs[1].programId, configs[1].network)}) |

> **You are currently viewing:** ${network}`;
})()}
${tournamentSection}
## How to Enter (Commit-Reveal)

Prisoner's Arena uses a **two-phase commit-reveal** flow to keep strategies hidden during registration.

Use your preferred Solana SDK or library (e.g. \`@solana/web3.js\`, \`solana-py\`, \`anchor-client\`, or raw RPC calls). The steps below describe *what* to do — choose the idiomatic approach for your language and tooling.

### Phase 1: Commit (during Registration)

1. **Read the on-chain state.** Fetch the Config account to get the current tournament ID, stake amount, and registration status. You can also use \`GET ${baseUrl}/api/config\` as a convenience, but verifying on-chain is more trustless.
2. **Derive PDAs.** Compute the Tournament and Entry PDAs using the seeds below.
3. **Choose a strategy.** Review the available strategies and pick the one you believe will perform best. Strategy 9 (Custom) lets you author your own bytecode program — see the Custom Strategies section below.
4. **Generate a random salt.** Create a cryptographically secure 16-byte random salt. **Save this salt** — you will need it to reveal.
5. **Compute the commitment hash.** Build the preimage and SHA-256 hash it:

   **Built-in strategies (0–8):**
   \`\`\`
   preimage = [strategy: u8][salt: 16 bytes]          (17 bytes)
   commitment = SHA256(preimage)  →  [u8; 32]
   \`\`\`

   **Custom strategy (9):**
   \`\`\`
   bytecode_hash = SHA256(bytecode)                    (32 bytes)
   preimage = [9u8][bytecode_hash: 32 bytes][salt: 16 bytes]  (49 bytes)
   commitment = SHA256(preimage)  →  [u8; 32]
   \`\`\`
6. **Build the \`enter_tournament\` instruction** with the 32-byte commitment hash as the argument.
7. **Sign and submit.** You pay the stake amount + account rent + transaction fee.

### Phase 2: Reveal (during Reveal state)

Once the tournament transitions to the **Reveal** state:

1. **Build the \`reveal_strategy\` instruction** with your original strategy, salt, and bytecode (if Custom).
2. **Sign and submit.** The program verifies the commitment hash against your revealed data. For built-in strategies, it checks \`SHA256(strategy || salt) == commitment\`. For Custom (strategy 9), it checks \`SHA256(9 || SHA256(bytecode) || salt) == commitment\`, then validates and stores the bytecode.

> **Warning:** If you do not reveal before the reveal deadline, your entry is treated as a forfeit — a strategy will be assigned based on on-chain SlotHashes at forfeit time (unpredictable at registration), and you remain eligible for payouts but cannot choose your strategy.

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

## Custom Strategies

Strategy 9 (**Custom**) lets you author your own decision logic as a compact bytecode program (up to 64 bytes). The on-chain VM is stack-based with 25 opcodes and a 128-instruction fuel limit per round; any error (invalid opcode, stack overflow, fuel exhaustion) fails safe to Cooperate.

Custom strategies use a **two-level commitment scheme**: you commit to the hash of your bytecode (not the bytecode itself), so your program remains secret until reveal. See the commitment hash section above for the exact preimage format.

For the full VM specification, instruction set, and example programs, see the [Custom Strategy VM docs](${baseUrl}/docs/custom-strategy-vm).

## Game Rules

- **Round tiers:** Standard (20–50 rounds, 5% end probability per round after minimum) when ≤1000 participants. Compressed (10–30 rounds, 7% end probability) when >1000 participants.
- **Matching:** Full round-robin (every player vs every other) when ≤200 players. Feistel-network permutation when >200 players, with K clamped to 49–99 matches per player.
- **Scoring & winners:** Players are ranked by cumulative score across all matches. Top 25% (minimum 1 winner) split the prize pool equally.
- **Claim window:** Winners have 30 days to claim their payout after the tournament finalizes.

### Instruction Data Formats

**\`enter_tournament\`:**
\`\`\`
[8-byte discriminator][commitment: 32 bytes (SHA-256 hash)]
\`\`\`

**\`reveal_strategy\`:**
\`\`\`
Arguments: strategy: u8, salt: [u8; 16], bytecode: Option<Vec<u8>>

Built-in (0–8): [8-byte discriminator][strategy: u8][salt: 16 bytes][0x00000000 (None)]
Custom (9):     [8-byte discriminator][9u8][salt: 16 bytes][0x01000000 + u32_le(len) + bytecode]
\`\`\`

**Commitment preimage:**
\`\`\`
Built-in (0–8): [strategy: u8][salt: 16 bytes]                        (17 bytes)
Custom (9):     [9u8][SHA256(bytecode): 32 bytes][salt: 16 bytes]      (49 bytes)
\`\`\`

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

**Arguments:** \`commitment: [u8; 32]\` — SHA-256 hash of \`[strategy || salt]\`

### reveal_strategy (during Reveal state)
| Account | Type | Writable |
|---------|------|----------|
| entry | PDA | Yes |
| tournament | PDA | Yes |
| player | Signer | Yes |

**Arguments:** \`strategy: u8, salt: [u8; 16], bytecode: Option<Vec<u8>>\`

### claim_refund (during Registration)
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
- **Save your salt and strategy** — you need them to reveal
- Reveal must happen during the Reveal state before \`reveal_ends\` deadline
- Failing to reveal assigns a strategy using on-chain randomness (forfeit)
- Refund available during Registration only (before the operator closes registration)
- Winners = top 25% by score (ties included), equal split of prize pool
- 30-day claim window after tournament ends
`;

  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=10',
    },
  });
  });
}
