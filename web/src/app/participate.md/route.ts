import { NextResponse } from 'next/server';
import { PROGRAM_ID, NETWORK, RPC_URL, BASE_URL, STRATEGIES, explorerLink, fetchCurrentTournament } from '@/lib/solana';

export async function GET() {
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

## Instruction Accounts

### enter_tournament
| Account | Type | Writable |
|---------|------|----------|
| config | PDA | No |
| tournament | PDA | Yes |
| entry | PDA (init) | Yes |
| player | Signer | Yes |
| system_program | Program | No |

**Argument:** \`strategy: u8\` (enum index from the list above)

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
