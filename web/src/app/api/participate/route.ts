import { NextRequest } from 'next/server';
import { getProgramId, getNetwork, getBaseUrl, STRATEGIES, fetchCurrentTournament, explorerLink } from '@/lib/solana';
import { getConfig } from '@/lib/config';
import { apiSuccess, rateLimited } from '@/lib/api';
import { PARAM_META, STRATEGY_CONFIGS } from '@/lib/strategyConfig';

export async function GET(request: NextRequest) {
  const limited = rateLimited(request);
  if (limited) return limited;
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

  const programId = getProgramId().toBase58();
  return apiSuccess({
    program_id: programId,
    network: getNetwork(),
    rpc_url: getConfig().rpcUrl,
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
      short_description: STRATEGY_CONFIGS[s.index]?.shortDescription ?? '',
      long_description: STRATEGY_CONFIGS[s.index]?.description ?? '',
      relevantParams: STRATEGY_CONFIGS[s.index]?.relevantParams ?? [],
    })),
    parameter_definitions: PARAM_META.map(p => ({
      name: p.key,
      type: 'u8',
      min: p.min,
      max: p.max,
      default: p.defaultValue,
      description: p.description,
    })),
    commitment: {
      algorithm: 'SHA256',
      byte_layout: [
        { field: 'strategy', type: 'u8', offset: 0, description: 'Strategy enum index (0-8)' },
        { field: 'forgiveness', type: 'u8', offset: 1 },
        { field: 'retaliation_delay', type: 'u8', offset: 2 },
        { field: 'noise_tolerance', type: 'u8', offset: 3 },
        { field: 'initial_moves', type: 'u8', offset: 4 },
        { field: 'cooperate_bias', type: 'u8', offset: 5 },
        { field: 'salt', type: '[u8; 16]', offset: 6, description: 'Random salt (16 bytes)' },
      ],
      total_bytes: 22,
      notes: 'commitment = SHA256(strategy_u8 || params_5_bytes || salt_16_bytes). Param order must match exactly.',
    },
    payoff_matrix: {
      cooperate_cooperate: [3, 3],
      cooperate_defect: [0, 5],
      defect_cooperate: [5, 0],
      defect_defect: [1, 1],
    },
    game_rules: {
      round_config: {
        standard: { min_rounds: 20, max_rounds: 50, end_probability_percent: 5, notes: 'Used when participant_count <= 1000' },
        compressed: { min_rounds: 10, max_rounds: 30, end_probability_percent: 7, notes: 'Used when participant_count > 1000' },
      },
      winner_percentage: 25,
      winner_selection: 'Top 25% of players by score (minimum 1 winner). All winners split prize pool equally.',
      claim_window_seconds: 2_592_000,
      claim_window_days: 30,
    },
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
        data: { commitment: '[u8; 32] — SHA256(strategy_u8 || params_5_bytes || salt_16_bytes)' },
        notes: 'Player pays stake + rent for entry account + realloc rent delta. Strategy is hidden until reveal.',
      },
      reveal_strategy: {
        discriminator: [102, 15, 100, 245, 177, 6, 9, 198],
        accounts: [
          'entry (PDA, mut)',
          'tournament (PDA, mut)',
          'player (signer, mut)',
        ],
        data: {
          strategy: 'u8 (enum index)',
          params: '{ forgiveness: u8, retaliation_delay: u8, noise_tolerance: u8, initial_moves: u8, cooperate_bias: u8 }',
          salt: '[u8; 16]',
        },
        notes: 'Only during Reveal state, before reveal_ends. Program verifies SHA256(strategy || params || salt) == commitment.',
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
        notes: 'During Registration or Reveal state. Refunds stake + entry rent.',
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
    idl_url: `${getBaseUrl()}/api/idl`,
    source_url: 'https://github.com/MaikBuse/prisoners-arena',
    explorer_url: explorerLink(programId),
  }, 3600);
}
