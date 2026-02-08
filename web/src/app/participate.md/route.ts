import { NextResponse } from 'next/server';
import { PROGRAM_ID, NETWORK, RPC_URL, STRATEGIES } from '@/lib/solana';

export async function GET() {
  const md = `# Participate in Dilemma Arena

## Program Details
- **Program ID:** \`${PROGRAM_ID.toBase58()}\`
- **Network:** ${NETWORK}
- **RPC:** \`${RPC_URL}\`

## PDA Derivation
- **Config:** seeds = ["config"]
- **Tournament:** seeds = ["tournament", u32_le_bytes(id)]
- **Entry:** seeds = ["entry", tournament_pubkey, player_pubkey]

## Steps to Enter
1. Fetch current tournament ID from Config account or \`GET /api/config\`
2. Derive the Tournament PDA using the ID
3. Derive your Entry PDA using the tournament pubkey and your wallet
4. Build the \`enter_tournament\` instruction with your chosen strategy
5. Sign and send the transaction — you pay the stake amount + rent + tx fee

## Available Strategies
${STRATEGIES.map(s => `- **${s.index}** — ${s.name} (\`${s.key}\`)`).join('\n')}

## API Endpoints
- \`GET /api/config\` — Current config with tournament ID
- \`GET /api/tournament\` — Current tournament + entries
- \`GET /api/participate\` — Machine-readable participation guide (JSON)
- \`GET /api/idl\` — Full Anchor IDL
- \`GET /api/entry/<your_pubkey>\` — Check your entry

## Instruction Accounts
| Account | Type | Writable |
|---------|------|----------|
| config | PDA | No |
| tournament | PDA | Yes |
| entry | PDA | Yes |
| player | Signer | Yes |
| system_program | Program | No |

## Notes
- Stake amount is in the tournament account (snapshotted from config)
- You must have enough SOL for stake + rent + tx fee
- Registration must be open (check tournament state and registration_ends)
- Each player can only enter once per tournament
- Winners are top 25% by score (ties included), equal split of prize pool
`;

  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60',
    },
  });
}
