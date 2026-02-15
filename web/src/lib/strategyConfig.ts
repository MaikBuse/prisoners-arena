import type { StrategyIndex } from './solana';

export interface ParamMeta {
  key: string;
  label: string;
  icon: string;
  description: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;
}

export const PARAM_META: ParamMeta[] = [
  { key: 'forgiveness', label: 'Forgiveness', icon: '♡', description: 'Chance to cooperate instead of retaliating after a defection', min: 0, max: 100, step: 1, unit: '%', defaultValue: 0 },
  { key: 'retaliation_delay', label: 'Retaliation Delay', icon: '⏱', description: 'Rounds to wait before copying a defection', min: 0, max: 10, step: 1, unit: ' rounds', defaultValue: 0 },
  { key: 'noise_tolerance', label: 'Noise Tolerance', icon: '🛡', description: 'Total defections to tolerate before triggering permanent retaliation', min: 0, max: 5, step: 1, unit: '', defaultValue: 0 },
  { key: 'initial_moves', label: 'Initial Moves', icon: '▶', description: 'Override first 8 rounds (1 = defect, 0 = use strategy)', min: 0, max: 255, step: 1, unit: ' (8-bit mask)', defaultValue: 0 },
  { key: 'cooperate_bias', label: 'Cooperate Bias', icon: '🎯', description: 'Base cooperation probability (default 50%)', min: 0, max: 100, step: 1, unit: '%', defaultValue: 50 },
];

export interface StrategyConfig {
  shortDescription: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  relevantParams: string[];
  presets: { name: string; params: Partial<Record<string, number>> }[];
}

export const DEFAULT_PARAMS = {
  forgiveness: 0,
  retaliation_delay: 0,
  noise_tolerance: 0,
  initial_moves: 0,
  cooperate_bias: 50,
};

export type ParamValues = typeof DEFAULT_PARAMS;

export const STRATEGY_CONFIGS: Record<number, StrategyConfig> = {
  0: { // TitForTat
    shortDescription: 'Copies opponent\'s last move. Starts by cooperating.',
    description: 'Starts by cooperating, then mirrors the opponent\'s last move. The classic reciprocal strategy.',
    strengths: ['Strong against cooperative strategies', 'Simple and forgiving', 'Promotes mutual cooperation'],
    weaknesses: ['Vulnerable to noise', 'Can get stuck in defection loops', 'Exploitable by alternating strategies'],
    relevantParams: ['forgiveness', 'retaliation_delay', 'initial_moves'],
    presets: [
      { name: 'Classic', params: {} },
      { name: 'Generous TFT', params: { forgiveness: 30 } },
      { name: 'Forgiving TFT', params: { forgiveness: 10 } },
    ],
  },
  1: { // AlwaysDefect
    shortDescription: 'Never cooperates. Always defects.',
    description: 'Always defects regardless of what the opponent does. Maximizes short-term gain.',
    strengths: ['Cannot be exploited', 'Maximizes score vs cooperators', 'Simple and predictable'],
    weaknesses: ['Low mutual scores', 'Triggers retaliation', 'Poor in cooperative environments'],
    relevantParams: ['initial_moves'],
    presets: [{ name: 'Classic', params: {} }],
  },
  2: { // AlwaysCooperate
    shortDescription: 'Never defects. Always cooperates.',
    description: 'Always cooperates regardless of what the opponent does. Vulnerable but promotes mutual benefit.',
    strengths: ['Maximizes mutual cooperation', 'Simple', 'Best partner for other cooperators'],
    weaknesses: ['Easily exploited', 'No defense against defectors', 'Lowest individual scores vs defectors'],
    relevantParams: ['initial_moves'],
    presets: [{ name: 'Classic', params: {} }],
  },
  3: { // GrimTrigger
    shortDescription: 'Cooperates until betrayed, then always defects.',
    description: 'Cooperates until the opponent defects once, then defects forever. Unforgiving.',
    strengths: ['Strong deterrent', 'Maximizes cooperation with cooperators', 'Cannot be exploited repeatedly'],
    weaknesses: ['Single defection ends cooperation', 'Very vulnerable to noise', 'No recovery possible'],
    relevantParams: ['noise_tolerance', 'initial_moves'],
    presets: [
      { name: 'Classic', params: {} },
      { name: 'Tolerant Grim', params: { noise_tolerance: 2 } },
      { name: 'Patient Grim', params: { noise_tolerance: 4 } },
    ],
  },
  4: { // Pavlov
    shortDescription: 'Repeats move if outcome was good, switches if bad.',
    description: 'Win-stay, lose-switch. Repeats the last move if it scored well, switches otherwise.',
    strengths: ['Adapts to opponent', 'Self-correcting', 'Good against many strategies'],
    weaknesses: ['Can be exploited by alternating patterns', 'Slow to adapt to consistent defectors'],
    relevantParams: ['initial_moves'],
    presets: [{ name: 'Classic', params: {} }],
  },
  5: { // SuspiciousTfT
    shortDescription: 'Like Tit-for-Tat, but starts with defect.',
    description: 'Like Tit for Tat but starts with a defection. Tests the opponent first.',
    strengths: ['Tests opponent first', 'Hard to exploit early', 'Good against naive cooperators'],
    weaknesses: ['Can trigger mutual defection', 'Worse than TFT against cooperators', 'Slow to establish trust'],
    relevantParams: ['forgiveness', 'retaliation_delay', 'initial_moves'],
    presets: [
      { name: 'Classic', params: {} },
      { name: 'Generous Suspicious', params: { forgiveness: 20 } },
    ],
  },
  6: { // Random
    shortDescription: 'Randomly cooperates or defects each round.',
    description: 'Randomly cooperates or defects each round based on cooperate_bias (default 50%).',
    strengths: ['Unpredictable', 'Cannot be counter-strategized', 'Good baseline comparison'],
    weaknesses: ['No adaptation', 'Average performance', 'Cannot build mutual cooperation'],
    relevantParams: ['cooperate_bias', 'initial_moves'],
    presets: [
      { name: 'Fair Coin', params: { cooperate_bias: 50 } },
      { name: 'Mostly Cooperate', params: { cooperate_bias: 80 } },
      { name: 'Mostly Defect', params: { cooperate_bias: 20 } },
    ],
  },
  7: { // TitForTwoTats
    shortDescription: 'Only retaliates after two consecutive defections.',
    description: 'Like Tit for Tat but requires two consecutive defections before retaliating. More forgiving.',
    strengths: ['Very forgiving', 'Noise resistant', 'Promotes sustained cooperation'],
    weaknesses: ['Slow to retaliate', 'Exploitable by alternating defection', 'Can lose to aggressive strategies'],
    relevantParams: ['initial_moves'],
    presets: [{ name: 'Classic', params: {} }],
  },
  8: { // Gradual
    shortDescription: 'Retaliates with increasing severity, then forgives.',
    description: 'Punishes proportionally to the number of defections received, then returns to cooperation.',
    strengths: ['Proportional punishment', 'Returns to cooperation', 'Good long-term performance'],
    weaknesses: ['Complex behavior', 'Slow initial retaliation', 'Can be exploited early'],
    relevantParams: ['initial_moves'],
    presets: [{ name: 'Classic', params: {} }],
  },
};

export const CLI_KEYS: Record<number, string> = {
  0: 'tit-for-tat',
  1: 'always-defect',
  2: 'always-cooperate',
  3: 'grim-trigger',
  4: 'pavlov',
  5: 'suspicious-tft',
  6: 'random',
  7: 'tit-for-two-tats',
  8: 'gradual',
};
