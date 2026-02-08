import { PROGRAM_ID, NETWORK, RPC_URL, BASE_URL, STRATEGIES, fetchCurrentTournament, explorerLink } from '@/lib/solana';
import { apiSuccess } from '@/lib/api';

export async function GET() {
  let currentTournament: { id: number; state: string; stake_lamports: string } | null = null;
  try {
    const t = await fetchCurrentTournament();
    if (t) {
      currentTournament = {
        id: t.id,
        state: t.state,
        stake_lamports: t.stake,
      };
    }
  } catch { /* best effort */ }

  return apiSuccess({
    program_id: PROGRAM_ID.toBase58(),
    network: NETWORK,
    rpc_url: RPC_URL,
    current_tournament: currentTournament,
    pda_seeds: {
      config: ['config'],
      tournament: ['tournament', '<u32_le_bytes(id)>'],
      entry: ['entry', '<tournament_pubkey>', '<player_pubkey>'],
    },
    strategies: STRATEGIES.map(s => ({
      value: s.index,
      name: s.key,
      description: s.name,
    })),
    instructions: {
      enter_tournament: {
        discriminator: [19, 21, 109, 109, 227, 108, 232, 25],
        accounts: [
          'config (PDA)',
          'tournament (PDA, mut)',
          'entry (PDA, init, mut)',
          'player (signer, mut)',
          'system_program',
        ],
        data: { strategy: 'u8 (enum index)' },
        notes: 'Player pays stake + rent for entry account + realloc rent delta',
      },
      claim_refund: {
        discriminator: [15, 16, 30, 161, 255, 228, 97, 60],
        accounts: [
          'tournament (PDA, mut)',
          'entry (PDA, mut)',
          'player (signer, mut)',
          'system_program',
        ],
        data: {},
        notes: 'Only during Registration state. Refunds stake + entry rent.',
      },
      claim_payout: {
        discriminator: [127, 240, 132, 62, 227, 198, 146, 133],
        accounts: [
          'tournament (PDA, mut)',
          'entry (PDA, mut)',
          'player (signer, mut)',
          'system_program',
        ],
        data: {},
        notes: 'Only during Payout state, within 30-day claim window. Score must be >= min_winning_score.',
      },
    },
    idl_url: `${BASE_URL}/api/idl`,
    source_url: 'https://github.com/dilemma-arena/dilemma-arena',
    explorer_url: explorerLink(PROGRAM_ID.toBase58()),
  }, 3600);
}
