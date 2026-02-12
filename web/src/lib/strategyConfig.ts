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
  { key: 'forgiveness', label: 'Forgiveness', icon: '♡', description: 'Chance to cooperate after opponent defects', min: 0, max: 100, step: 1, unit: '%', defaultValue: 0 },
  { key: 'retaliation_delay', label: 'Retaliation Delay', icon: '⏱', description: 'Rounds to wait before retaliating', min: 0, max: 10, step: 1, unit: ' rounds', defaultValue: 0 },
  { key: 'noise_tolerance', label: 'Noise Tolerance', icon: '🛡', description: 'Consecutive defections before triggering', min: 0, max: 5, step: 1, unit: '', defaultValue: 0 },
  { key: 'cooperate_bias', label: 'Cooperate Bias', icon: '🎯', description: 'Base cooperation probability for Random strategy', min: 0, max: 100, step: 1, unit: '%', defaultValue: 50 },
];

export interface StrategyConfig {
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
    description: 'Cooperates first, then copies opponent\'s last move. The classic reciprocal strategy.',
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
    description: 'Always defects regardless of opponent\'s actions. Maximizes exploitation potential.',
    strengths: ['Cannot be exploited', 'Maximizes score vs cooperators', 'Simple and predictable'],
    weaknesses: ['Low mutual scores', 'Triggers retaliation', 'Poor in cooperative environments'],
    relevantParams: ['initial_moves'],
    presets: [{ name: 'Classic', params: {} }],
  },
  2: { // AlwaysCooperate
    description: 'Always cooperates regardless of opponent\'s actions. Trusting and altruistic.',
    strengths: ['Maximizes mutual cooperation', 'Simple', 'Best partner for other cooperators'],
    weaknesses: ['Easily exploited', 'No defense against defectors', 'Lowest individual scores vs defectors'],
    relevantParams: ['initial_moves'],
    presets: [{ name: 'Classic', params: {} }],
  },
  3: { // GrimTrigger
    description: 'Cooperates until opponent defects, then defects forever. Unforgiving punishment.',
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
    description: 'Win-stay, lose-switch. Repeats last move if it scored well (≥3), switches otherwise.',
    strengths: ['Adapts to opponent', 'Self-correcting', 'Good against many strategies'],
    weaknesses: ['Can be exploited by alternating patterns', 'Slow to adapt to consistent defectors'],
    relevantParams: ['initial_moves'],
    presets: [{ name: 'Classic', params: {} }],
  },
  5: { // SuspiciousTfT
    description: 'Like Tit for Tat but starts by defecting. Tests opponent before cooperating.',
    strengths: ['Tests opponent first', 'Hard to exploit early', 'Good against naive cooperators'],
    weaknesses: ['Can trigger mutual defection', 'Worse than TFT against cooperators', 'Slow to establish trust'],
    relevantParams: ['forgiveness', 'retaliation_delay', 'initial_moves'],
    presets: [
      { name: 'Classic', params: {} },
      { name: 'Generous Suspicious', params: { forgiveness: 20 } },
    ],
  },
  6: { // Random
    description: 'Cooperates or defects randomly based on cooperate bias percentage.',
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
    description: 'Like Tit for Tat but requires two consecutive defections before retaliating. More forgiving.',
    strengths: ['Very forgiving', 'Noise resistant', 'Promotes sustained cooperation'],
    weaknesses: ['Slow to retaliate', 'Exploitable by alternating defection', 'Can lose to aggressive strategies'],
    relevantParams: ['forgiveness', 'initial_moves'],
    presets: [{ name: 'Classic', params: {} }],
  },
  8: { // Gradual
    description: 'Retaliates proportionally — defects more with each opponent defection, then returns to cooperation.',
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
