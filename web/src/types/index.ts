// Strategy types (matching Rust enums)
export type StrategyBase =
  | 'TitForTat'
  | 'AlwaysDefect'
  | 'AlwaysCooperate'
  | 'GrimTrigger'
  | 'Pavlov'
  | 'SuspiciousTitForTat'
  | 'Random'
  | 'TitForTwoTats'
  | 'Gradual'

export interface StrategyParams {
  forgiveness: number // 0-100
  retaliation_delay: number // 0-10
  noise_tolerance: number // 0-5
  initial_moves: number // bitmask
  cooperate_bias: number // 0-100
}

export interface Strategy {
  base: StrategyBase
  params: StrategyParams
}

export type Move = 'Cooperate' | 'Defect'

export interface RoundResult {
  round: number
  move_a: Move
  move_b: Move
  score_a: number
  score_b: number
  cumulative_a: number
  cumulative_b: number
}

export interface MatchResult {
  rounds: RoundResult[]
  total_score_a: number
  total_score_b: number
  round_count: number
}

export type TournamentState =
  | 'Registration'
  | 'Running'
  | 'Payout'
  | 'Complete'
  | 'Cancelled'

export interface Tournament {
  id: number
  state: TournamentState
  pool: number // lamports
  participant_count: number
  registration_ends: number // unix timestamp
  matches_completed: number
  matches_total: number
  winner_count: number
}

export interface Entry {
  tournament: string // pubkey
  player: string // pubkey
  index: number
  stake: number // lamports
  strategy: Strategy
  score: number
  matches_played: number
  is_winner: boolean
  paid_out: boolean
}

// Strategy metadata for UI
export interface StrategyInfo {
  id: StrategyBase
  name: string
  description: string
  params: Array<{
    key: keyof StrategyParams
    label: string
    min: number
    max: number
    default: number
    applicable: boolean
  }>
}

export const STRATEGY_INFO: StrategyInfo[] = [
  {
    id: 'TitForTat',
    name: 'Tit for Tat',
    description: 'Copies opponent\'s last move. Starts by cooperating.',
    params: [
      { key: 'forgiveness', label: 'Forgiveness %', min: 0, max: 100, default: 0, applicable: true },
      { key: 'initial_moves', label: 'Initial Moves', min: 0, max: 255, default: 0, applicable: true },
      { key: 'retaliation_delay', label: 'Retaliation Delay', min: 0, max: 10, default: 0, applicable: false },
      { key: 'noise_tolerance', label: 'Noise Tolerance', min: 0, max: 5, default: 0, applicable: false },
      { key: 'cooperate_bias', label: 'Cooperate Bias', min: 0, max: 100, default: 50, applicable: false },
    ],
  },
  {
    id: 'AlwaysDefect',
    name: 'Always Defect',
    description: 'Never cooperates. Always defects.',
    params: [
      { key: 'forgiveness', label: 'Forgiveness %', min: 0, max: 100, default: 0, applicable: false },
      { key: 'initial_moves', label: 'Initial Moves', min: 0, max: 255, default: 0, applicable: false },
      { key: 'retaliation_delay', label: 'Retaliation Delay', min: 0, max: 10, default: 0, applicable: false },
      { key: 'noise_tolerance', label: 'Noise Tolerance', min: 0, max: 5, default: 0, applicable: false },
      { key: 'cooperate_bias', label: 'Cooperate Bias', min: 0, max: 100, default: 50, applicable: false },
    ],
  },
  {
    id: 'AlwaysCooperate',
    name: 'Always Cooperate',
    description: 'Never defects. Always cooperates.',
    params: [
      { key: 'forgiveness', label: 'Forgiveness %', min: 0, max: 100, default: 0, applicable: false },
      { key: 'initial_moves', label: 'Initial Moves', min: 0, max: 255, default: 0, applicable: false },
      { key: 'retaliation_delay', label: 'Retaliation Delay', min: 0, max: 10, default: 0, applicable: false },
      { key: 'noise_tolerance', label: 'Noise Tolerance', min: 0, max: 5, default: 0, applicable: false },
      { key: 'cooperate_bias', label: 'Cooperate Bias', min: 0, max: 100, default: 50, applicable: false },
    ],
  },
  {
    id: 'GrimTrigger',
    name: 'Grim Trigger',
    description: 'Cooperates until betrayed, then always defects.',
    params: [
      { key: 'noise_tolerance', label: 'Noise Tolerance', min: 0, max: 5, default: 0, applicable: true },
      { key: 'forgiveness', label: 'Forgiveness %', min: 0, max: 100, default: 0, applicable: false },
      { key: 'initial_moves', label: 'Initial Moves', min: 0, max: 255, default: 0, applicable: false },
      { key: 'retaliation_delay', label: 'Retaliation Delay', min: 0, max: 10, default: 0, applicable: false },
      { key: 'cooperate_bias', label: 'Cooperate Bias', min: 0, max: 100, default: 50, applicable: false },
    ],
  },
  {
    id: 'Pavlov',
    name: 'Pavlov',
    description: 'Repeats move if outcome was good, switches if bad.',
    params: [
      { key: 'forgiveness', label: 'Forgiveness %', min: 0, max: 100, default: 0, applicable: false },
      { key: 'initial_moves', label: 'Initial Moves', min: 0, max: 255, default: 0, applicable: false },
      { key: 'retaliation_delay', label: 'Retaliation Delay', min: 0, max: 10, default: 0, applicable: false },
      { key: 'noise_tolerance', label: 'Noise Tolerance', min: 0, max: 5, default: 0, applicable: false },
      { key: 'cooperate_bias', label: 'Cooperate Bias', min: 0, max: 100, default: 50, applicable: false },
    ],
  },
  {
    id: 'SuspiciousTitForTat',
    name: 'Suspicious Tit for Tat',
    description: 'Like Tit for Tat, but starts with defect.',
    params: [
      { key: 'forgiveness', label: 'Forgiveness %', min: 0, max: 100, default: 0, applicable: true },
      { key: 'initial_moves', label: 'Initial Moves', min: 0, max: 255, default: 0, applicable: false },
      { key: 'retaliation_delay', label: 'Retaliation Delay', min: 0, max: 10, default: 0, applicable: false },
      { key: 'noise_tolerance', label: 'Noise Tolerance', min: 0, max: 5, default: 0, applicable: false },
      { key: 'cooperate_bias', label: 'Cooperate Bias', min: 0, max: 100, default: 50, applicable: false },
    ],
  },
  {
    id: 'Random',
    name: 'Random',
    description: 'Randomly cooperates or defects each round.',
    params: [
      { key: 'cooperate_bias', label: 'Cooperate Bias %', min: 0, max: 100, default: 50, applicable: true },
      { key: 'forgiveness', label: 'Forgiveness %', min: 0, max: 100, default: 0, applicable: false },
      { key: 'initial_moves', label: 'Initial Moves', min: 0, max: 255, default: 0, applicable: false },
      { key: 'retaliation_delay', label: 'Retaliation Delay', min: 0, max: 10, default: 0, applicable: false },
      { key: 'noise_tolerance', label: 'Noise Tolerance', min: 0, max: 5, default: 0, applicable: false },
    ],
  },
  {
    id: 'TitForTwoTats',
    name: 'Tit for Two Tats',
    description: 'Only retaliates after two consecutive defections.',
    params: [
      { key: 'forgiveness', label: 'Forgiveness %', min: 0, max: 100, default: 0, applicable: false },
      { key: 'initial_moves', label: 'Initial Moves', min: 0, max: 255, default: 0, applicable: false },
      { key: 'retaliation_delay', label: 'Retaliation Delay', min: 0, max: 10, default: 0, applicable: false },
      { key: 'noise_tolerance', label: 'Noise Tolerance', min: 0, max: 5, default: 0, applicable: false },
      { key: 'cooperate_bias', label: 'Cooperate Bias', min: 0, max: 100, default: 50, applicable: false },
    ],
  },
  {
    id: 'Gradual',
    name: 'Gradual',
    description: 'Retaliates with increasing severity, then forgives.',
    params: [
      { key: 'forgiveness', label: 'Forgiveness %', min: 0, max: 100, default: 0, applicable: false },
      { key: 'initial_moves', label: 'Initial Moves', min: 0, max: 255, default: 0, applicable: false },
      { key: 'retaliation_delay', label: 'Retaliation Delay', min: 0, max: 10, default: 0, applicable: false },
      { key: 'noise_tolerance', label: 'Noise Tolerance', min: 0, max: 5, default: 0, applicable: false },
      { key: 'cooperate_bias', label: 'Cooperate Bias', min: 0, max: 100, default: 50, applicable: false },
    ],
  },
]
