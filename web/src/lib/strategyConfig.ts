import type { StrategyIndex } from './solana';

export interface StrategyConfig {
  shortDescription: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
}

export const STRATEGY_CONFIGS: Record<number, StrategyConfig> = {
  0: { // TitForTat
    shortDescription: 'Copies opponent\'s last move. Starts by cooperating.',
    description: 'Starts by cooperating, then mirrors the opponent\'s last move. The classic reciprocal strategy.',
    strengths: ['Strong against cooperative strategies', 'Simple and forgiving', 'Promotes mutual cooperation'],
    weaknesses: ['Vulnerable to noise', 'Can get stuck in defection loops', 'Exploitable by alternating strategies'],
  },
  1: { // AlwaysDefect
    shortDescription: 'Never cooperates. Always defects.',
    description: 'Always defects regardless of what the opponent does. Maximizes short-term gain.',
    strengths: ['Cannot be exploited', 'Maximizes score vs cooperators', 'Simple and predictable'],
    weaknesses: ['Low mutual scores', 'Triggers retaliation', 'Poor in cooperative environments'],
  },
  2: { // AlwaysCooperate
    shortDescription: 'Never defects. Always cooperates.',
    description: 'Always cooperates regardless of what the opponent does. Vulnerable but promotes mutual benefit.',
    strengths: ['Maximizes mutual cooperation', 'Simple', 'Best partner for other cooperators'],
    weaknesses: ['Easily exploited', 'No defense against defectors', 'Lowest individual scores vs defectors'],
  },
  3: { // GrimTrigger
    shortDescription: 'Cooperates until betrayed, then always defects.',
    description: 'Cooperates until the opponent defects once, then defects forever. Unforgiving.',
    strengths: ['Strong deterrent', 'Maximizes cooperation with cooperators', 'Cannot be exploited repeatedly'],
    weaknesses: ['Single defection ends cooperation', 'Very vulnerable to noise', 'No recovery possible'],
  },
  4: { // Pavlov
    shortDescription: 'Repeats move if outcome was good, switches if bad.',
    description: 'Win-stay, lose-switch. Repeats the last move if it scored well, switches otherwise.',
    strengths: ['Adapts to opponent', 'Self-correcting', 'Good against many strategies'],
    weaknesses: ['Can be exploited by alternating patterns', 'Slow to adapt to consistent defectors'],
  },
  5: { // SuspiciousTfT
    shortDescription: 'Like Tit-for-Tat, but starts with defect.',
    description: 'Like Tit for Tat but starts with a defection. Tests the opponent first.',
    strengths: ['Tests opponent first', 'Hard to exploit early', 'Good against naive cooperators'],
    weaknesses: ['Can trigger mutual defection', 'Worse than TFT against cooperators', 'Slow to establish trust'],
  },
  6: { // Random
    shortDescription: 'Randomly cooperates or defects each round (50/50).',
    description: 'Randomly cooperates or defects each round with 50% probability.',
    strengths: ['Unpredictable', 'Cannot be counter-strategized', 'Good baseline comparison'],
    weaknesses: ['No adaptation', 'Average performance', 'Cannot build mutual cooperation'],
  },
  7: { // TitForTwoTats
    shortDescription: 'Only retaliates after two consecutive defections.',
    description: 'Like Tit for Tat but requires two consecutive defections before retaliating. More forgiving.',
    strengths: ['Very forgiving', 'Noise resistant', 'Promotes sustained cooperation'],
    weaknesses: ['Slow to retaliate', 'Exploitable by alternating defection', 'Can lose to aggressive strategies'],
  },
  8: { // Gradual
    shortDescription: 'Retaliates with increasing severity, then forgives.',
    description: 'Punishes proportionally to the number of defections received, then returns to cooperation.',
    strengths: ['Proportional punishment', 'Returns to cooperation', 'Good long-term performance'],
    weaknesses: ['Complex behavior', 'Slow initial retaliation', 'Can be exploited early'],
  },
  9: { // Custom
    shortDescription: 'User-defined bytecode program. Any logic you can code.',
    description: 'Author your own strategy as a compact bytecode program (up to 64 bytes). Full control over decision logic each round.',
    strengths: ['Unlimited flexibility', 'Can implement any algorithm', 'Competitive edge through novel strategies'],
    weaknesses: ['Requires programming', 'Must fit within compute limits', 'No built-in guarantees'],
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
  9: 'custom',
};
