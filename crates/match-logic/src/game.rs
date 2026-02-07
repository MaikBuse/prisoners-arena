//! Match execution engine

use serde::{Deserialize, Serialize};
use crate::random::SeededRng;
use crate::strategy::{execute_strategy, Move, Strategy};
use crate::payoff;

/// Result of a single round
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RoundResult {
    pub round: u8,
    pub move_a: Move,
    pub move_b: Move,
    pub score_a: u8,
    pub score_b: u8,
    pub cumulative_a: u32,
    pub cumulative_b: u32,
}

/// Result of a complete match
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MatchResult {
    pub rounds: Vec<RoundResult>,
    pub total_score_a: u32,
    pub total_score_b: u32,
    pub round_count: u8,
}

/// Determine how many rounds this match will have
/// 
/// Uses geometric distribution: 10% chance to end each round after minimum
/// - Minimum: 5 rounds
/// - Maximum: 15 rounds  
/// - Expected: ~10 rounds
fn determine_round_count(rng: &mut SeededRng) -> u8 {
    const MIN_ROUNDS: u8 = 5;
    const MAX_ROUNDS: u8 = 15;
    const END_PROBABILITY: u8 = 10; // 10% chance to end each round
    
    let mut rounds = MIN_ROUNDS;
    
    while rounds < MAX_ROUNDS {
        if rng.next_percent() < END_PROBABILITY {
            break;
        }
        rounds += 1;
    }
    
    rounds
}

/// Run a complete match between two strategies
/// 
/// # Arguments
/// * `strategy_a` - First player's strategy
/// * `strategy_b` - Second player's strategy
/// * `seed` - Tournament randomness seed
/// * `match_index` - Index of this match in the tournament
/// 
/// # Returns
/// Complete match result with round-by-round details
pub fn run_match(
    strategy_a: &Strategy,
    strategy_b: &Strategy,
    seed: &[u8; 32],
    match_index: u32,
) -> MatchResult {
    let mut rng = SeededRng::new(seed, match_index);
    let round_count = determine_round_count(&mut rng);
    
    let mut history_a: Vec<Move> = Vec::with_capacity(round_count as usize);
    let mut history_b: Vec<Move> = Vec::with_capacity(round_count as usize);
    let mut rounds: Vec<RoundResult> = Vec::with_capacity(round_count as usize);
    let mut total_a = 0u32;
    let mut total_b = 0u32;
    
    for round in 0..round_count {
        // Create per-round RNG for each player (so they don't affect each other)
        let mut rng_a = rng.for_round(round * 2);
        let mut rng_b = rng.for_round(round * 2 + 1);
        
        // Execute strategies simultaneously
        let move_a = execute_strategy(strategy_a, &history_b, &history_a, round, &mut rng_a);
        let move_b = execute_strategy(strategy_b, &history_a, &history_b, round, &mut rng_b);
        
        // Calculate payoffs
        let (score_a, score_b) = payoff(move_a, move_b);
        total_a += score_a as u32;
        total_b += score_b as u32;
        
        rounds.push(RoundResult {
            round,
            move_a,
            move_b,
            score_a,
            score_b,
            cumulative_a: total_a,
            cumulative_b: total_b,
        });
        
        history_a.push(move_a);
        history_b.push(move_b);
    }
    
    MatchResult {
        rounds,
        total_score_a: total_a,
        total_score_b: total_b,
        round_count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::strategy::StrategyBase;

    #[test]
    fn test_round_count_in_range() {
        let seed = [42u8; 32];
        
        for match_index in 0..100 {
            let mut rng = SeededRng::new(&seed, match_index);
            let count = determine_round_count(&mut rng);
            assert!(count >= 5, "Round count {} below minimum", count);
            assert!(count <= 15, "Round count {} above maximum", count);
        }
    }
    
    #[test]
    fn test_round_count_distribution() {
        let seed = [42u8; 32];
        let mut total = 0u32;
        let samples = 1000;
        
        for match_index in 0..samples {
            let mut rng = SeededRng::new(&seed, match_index);
            total += determine_round_count(&mut rng) as u32;
        }
        
        let average = total as f64 / samples as f64;
        // Expected is around 10, allow some variance
        assert!(average > 8.0, "Average {} too low", average);
        assert!(average < 12.0, "Average {} too high", average);
    }
    
    #[test]
    fn test_match_determinism() {
        let seed = [42u8; 32];
        let strategy_a = Strategy::new(StrategyBase::TitForTat);
        let strategy_b = Strategy::new(StrategyBase::Random);
        
        let result1 = run_match(&strategy_a, &strategy_b, &seed, 0);
        let result2 = run_match(&strategy_a, &strategy_b, &seed, 0);
        
        assert_eq!(result1.round_count, result2.round_count);
        assert_eq!(result1.total_score_a, result2.total_score_a);
        assert_eq!(result1.total_score_b, result2.total_score_b);
        
        for (r1, r2) in result1.rounds.iter().zip(result2.rounds.iter()) {
            assert_eq!(r1.move_a, r2.move_a);
            assert_eq!(r1.move_b, r2.move_b);
        }
    }
    
    #[test]
    fn test_different_matches_differ() {
        let seed = [42u8; 32];
        let strategy_a = Strategy::new(StrategyBase::Random);
        let strategy_b = Strategy::new(StrategyBase::Random);
        
        let result1 = run_match(&strategy_a, &strategy_b, &seed, 0);
        let result2 = run_match(&strategy_a, &strategy_b, &seed, 1);
        
        // Different match indices should produce different results
        // (not guaranteed but extremely likely with Random strategies)
        let moves1: Vec<_> = result1.rounds.iter().map(|r| (r.move_a, r.move_b)).collect();
        let moves2: Vec<_> = result2.rounds.iter().map(|r| (r.move_a, r.move_b)).collect();
        
        assert_ne!(moves1, moves2, "Different matches should have different move sequences");
    }
    
    #[test]
    fn test_cooperate_vs_cooperate() {
        let seed = [42u8; 32];
        let strategy_a = Strategy::new(StrategyBase::AlwaysCooperate);
        let strategy_b = Strategy::new(StrategyBase::AlwaysCooperate);
        
        let result = run_match(&strategy_a, &strategy_b, &seed, 0);
        
        // Both always cooperate, should get 3 points each per round
        for round in &result.rounds {
            assert_eq!(round.move_a, Move::Cooperate);
            assert_eq!(round.move_b, Move::Cooperate);
            assert_eq!(round.score_a, 3);
            assert_eq!(round.score_b, 3);
        }
        
        assert_eq!(result.total_score_a, result.round_count as u32 * 3);
        assert_eq!(result.total_score_b, result.round_count as u32 * 3);
    }
    
    #[test]
    fn test_defect_vs_cooperate() {
        let seed = [42u8; 32];
        let strategy_a = Strategy::new(StrategyBase::AlwaysDefect);
        let strategy_b = Strategy::new(StrategyBase::AlwaysCooperate);
        
        let result = run_match(&strategy_a, &strategy_b, &seed, 0);
        
        // A always defects, B always cooperates
        for round in &result.rounds {
            assert_eq!(round.move_a, Move::Defect);
            assert_eq!(round.move_b, Move::Cooperate);
            assert_eq!(round.score_a, 5);
            assert_eq!(round.score_b, 0);
        }
        
        assert_eq!(result.total_score_a, result.round_count as u32 * 5);
        assert_eq!(result.total_score_b, 0);
    }
    
    #[test]
    fn test_tft_vs_tft() {
        let seed = [42u8; 32];
        let strategy_a = Strategy::new(StrategyBase::TitForTat);
        let strategy_b = Strategy::new(StrategyBase::TitForTat);
        
        let result = run_match(&strategy_a, &strategy_b, &seed, 0);
        
        // TFT vs TFT: both start cooperating and continue cooperating
        for round in &result.rounds {
            assert_eq!(round.move_a, Move::Cooperate);
            assert_eq!(round.move_b, Move::Cooperate);
        }
    }
    
    #[test]
    fn test_tft_vs_always_defect() {
        let seed = [42u8; 32];
        let strategy_a = Strategy::new(StrategyBase::TitForTat);
        let strategy_b = Strategy::new(StrategyBase::AlwaysDefect);
        
        let result = run_match(&strategy_a, &strategy_b, &seed, 0);
        
        // Round 0: TFT cooperates, AD defects
        assert_eq!(result.rounds[0].move_a, Move::Cooperate);
        assert_eq!(result.rounds[0].move_b, Move::Defect);
        
        // Round 1+: TFT retaliates, both defect
        for round in result.rounds.iter().skip(1) {
            assert_eq!(round.move_a, Move::Defect);
            assert_eq!(round.move_b, Move::Defect);
        }
    }
    
    #[test]
    fn test_cumulative_scores() {
        let seed = [42u8; 32];
        let strategy_a = Strategy::new(StrategyBase::AlwaysCooperate);
        let strategy_b = Strategy::new(StrategyBase::AlwaysCooperate);
        
        let result = run_match(&strategy_a, &strategy_b, &seed, 0);
        
        let mut expected_a = 0u32;
        let mut expected_b = 0u32;
        
        for round in &result.rounds {
            expected_a += round.score_a as u32;
            expected_b += round.score_b as u32;
            assert_eq!(round.cumulative_a, expected_a);
            assert_eq!(round.cumulative_b, expected_b);
        }
    }
}
