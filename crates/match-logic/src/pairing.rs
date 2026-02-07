//! Deterministic pairing generation for tournament matches

use crate::random::SeededRng;

/// Generate all match pairings for a tournament
/// 
/// Each participant plays exactly K matches (deduplicated — each match counted once).
/// Total matches = n×K/2 where n = participant count.
/// 
/// # Arguments
/// * `participant_count` - Total number of participants (should be even for exact K matches)
/// * `matches_per_player` - Number of matches per player (K)
/// * `seed` - Tournament randomness seed
/// 
/// # Returns
/// Vector of (index_a, index_b) pairs, where index_a < index_b
pub fn generate_all_pairings(
    participant_count: u32,
    matches_per_player: u16,
    seed: &[u8; 32],
) -> Vec<(u32, u32)> {
    if participant_count < 2 {
        return Vec::new();
    }
    
    let n = participant_count as usize;
    let k = matches_per_player as usize;
    
    // For small tournaments where n-1 <= k, do round-robin
    if n <= k + 1 {
        return generate_round_robin(n, seed);
    }
    
    // Use circular pairing method:
    // - For offset d, each player i is paired with (i + d) mod n
    // - Each offset produces n unique pairs, giving each player 2 matches
    // - Offsets d and (n-d) produce identical pair sets
    // - So we use offsets from 1 to n/2 (distinct offsets only)
    // - For K matches per player, we need K/2 offsets
    
    let mut rng = SeededRng::new(seed, 0);
    
    // Generate available distinct offsets: 1 to n/2
    let max_offset = n / 2;
    let mut available_offsets: Vec<usize> = (1..=max_offset).collect();
    shuffle_usize(&mut available_offsets, &mut rng);
    
    // We need k/2 offsets for k matches per player
    // Each offset gives 2 matches per player (they appear twice in offset's pairs)
    let offsets_needed = (k + 1) / 2; // Round up
    let offsets_to_use = offsets_needed.min(available_offsets.len());
    
    let selected_offsets = &available_offsets[..offsets_to_use];
    
    // Generate matches from selected offsets
    let mut matches: Vec<(u32, u32)> = Vec::with_capacity(n * offsets_to_use);
    
    for &offset in selected_offsets {
        for i in 0..n {
            let j = (i + offset) % n;
            // Always add in canonical order (smaller, larger)
            let pair = if i < j { 
                (i as u32, j as u32) 
            } else { 
                (j as u32, i as u32) 
            };
            matches.push(pair);
        }
    }
    
    // Remove duplicates (shouldn't be any with distinct offsets, but be safe)
    matches.sort();
    matches.dedup();
    
    // Shuffle match order for unpredictable execution
    shuffle_pairs(&mut matches, &mut rng);
    
    matches
}

/// Generate round-robin pairings for small tournaments
fn generate_round_robin(n: usize, seed: &[u8; 32]) -> Vec<(u32, u32)> {
    let mut pairings = Vec::with_capacity(n * (n - 1) / 2);
    
    for i in 0..n {
        for j in (i + 1)..n {
            pairings.push((i as u32, j as u32));
        }
    }
    
    let mut rng = SeededRng::new(seed, 0);
    shuffle_pairs(&mut pairings, &mut rng);
    
    pairings
}

/// Get the pairing for a specific match index
pub fn get_pairing_for_match(
    participant_count: u32,
    matches_per_player: u16,
    seed: &[u8; 32],
    match_index: u32,
) -> Option<(u32, u32)> {
    let pairings = generate_all_pairings(participant_count, matches_per_player, seed);
    pairings.get(match_index as usize).copied()
}

/// Calculate total number of matches for a tournament
pub fn calculate_match_count(
    participant_count: u32,
    matches_per_player: u16,
    seed: &[u8; 32],
) -> u32 {
    generate_all_pairings(participant_count, matches_per_player, seed).len() as u32
}

/// Fisher-Yates shuffle for usize array
fn shuffle_usize(arr: &mut [usize], rng: &mut SeededRng) {
    let len = arr.len();
    if len <= 1 {
        return;
    }
    
    for i in (1..len).rev() {
        let j = rng.next_range((i + 1) as u32) as usize;
        arr.swap(i, j);
    }
}

/// Fisher-Yates shuffle for match pairs
fn shuffle_pairs(pairs: &mut [(u32, u32)], rng: &mut SeededRng) {
    let len = pairs.len();
    if len <= 1 {
        return;
    }
    
    for i in (1..len).rev() {
        let j = rng.next_range((i + 1) as u32) as usize;
        pairs.swap(i, j);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_tournament() {
        let seed = [42u8; 32];
        let pairings = generate_all_pairings(0, 5, &seed);
        assert!(pairings.is_empty());
        
        let pairings = generate_all_pairings(1, 5, &seed);
        assert!(pairings.is_empty());
    }
    
    #[test]
    fn test_two_players() {
        let seed = [42u8; 32];
        let pairings = generate_all_pairings(2, 5, &seed);
        
        // 2 players can only play each other once in round-robin
        assert_eq!(pairings.len(), 1);
        
        let mut sorted = pairings.clone();
        sorted.sort();
        assert_eq!(sorted[0], (0, 1));
    }
    
    #[test]
    fn test_small_tournament_round_robin() {
        let seed = [42u8; 32];
        // 4 players, K=5 means everyone plays everyone (round-robin)
        let pairings = generate_all_pairings(4, 5, &seed);
        
        // 4 players = 4*3/2 = 6 matches
        assert_eq!(pairings.len(), 6);
        
        // All pairs should exist
        let mut sorted = pairings.clone();
        sorted.sort();
        
        assert!(sorted.contains(&(0, 1)));
        assert!(sorted.contains(&(0, 2)));
        assert!(sorted.contains(&(0, 3)));
        assert!(sorted.contains(&(1, 2)));
        assert!(sorted.contains(&(1, 3)));
        assert!(sorted.contains(&(2, 3)));
    }
    
    #[test]
    fn test_pairing_determinism() {
        let seed = [42u8; 32];
        
        let pairings1 = generate_all_pairings(20, 6, &seed);
        let pairings2 = generate_all_pairings(20, 6, &seed);
        
        assert_eq!(pairings1, pairings2);
    }
    
    #[test]
    fn test_different_seeds_different_pairings() {
        let seed1 = [1u8; 32];
        let seed2 = [2u8; 32];
        
        let pairings1 = generate_all_pairings(20, 6, &seed1);
        let pairings2 = generate_all_pairings(20, 6, &seed2);
        
        // Order should be different
        assert_ne!(pairings1, pairings2);
    }
    
    #[test]
    fn test_no_self_pairings() {
        let seed = [42u8; 32];
        let pairings = generate_all_pairings(50, 10, &seed);
        
        for (a, b) in &pairings {
            assert_ne!(a, b, "Self-pairing found: {} vs {}", a, b);
        }
    }
    
    #[test]
    fn test_no_duplicate_pairings() {
        let seed = [42u8; 32];
        let pairings = generate_all_pairings(50, 10, &seed);
        
        let mut sorted = pairings.clone();
        sorted.sort();
        
        for i in 1..sorted.len() {
            assert_ne!(sorted[i], sorted[i-1], "Duplicate pairing found: {:?}", sorted[i]);
        }
    }
    
    #[test]
    fn test_index_ordering() {
        let seed = [42u8; 32];
        let pairings = generate_all_pairings(50, 10, &seed);
        
        for (a, b) in &pairings {
            assert!(a < b, "Pairing not ordered: {} >= {}", a, b);
        }
    }
    
    #[test]
    fn test_get_pairing_for_match() {
        let seed = [42u8; 32];
        let pairings = generate_all_pairings(10, 4, &seed);
        
        for (i, expected) in pairings.iter().enumerate() {
            let actual = get_pairing_for_match(10, 4, &seed, i as u32);
            assert_eq!(actual, Some(*expected));
        }
        
        // Out of bounds
        let out_of_bounds = get_pairing_for_match(10, 4, &seed, 1000);
        assert_eq!(out_of_bounds, None);
    }
    
    #[test]
    fn test_match_count_round_robin() {
        let seed = [42u8; 32];
        
        // Small tournament: round robin
        let count = calculate_match_count(4, 10, &seed);
        assert_eq!(count, 6); // 4*3/2 = 6 (round robin)
    }
    
    #[test]
    fn test_large_tournament_match_count() {
        let seed = [42u8; 32];
        let n = 100u32;
        let k = 14u16; // Even k for clean division
        let pairings = generate_all_pairings(n, k, &seed);
        
        // Expected: n*K/2 = 100*14/2 = 700
        let expected = (n as usize) * (k as usize) / 2;
        assert_eq!(pairings.len(), expected, "Got {} matches, expected {}", pairings.len(), expected);
        
        // All indices in valid range
        for (a, b) in &pairings {
            assert!(*a < n);
            assert!(*b < n);
        }
    }
    
    #[test]
    fn test_each_player_has_k_matches() {
        let seed = [42u8; 32];
        let n = 20u32;
        let k = 8u16; // Even k
        let pairings = generate_all_pairings(n, k, &seed);
        
        // Count matches per player
        let mut counts = vec![0u32; n as usize];
        for (a, b) in &pairings {
            counts[*a as usize] += 1;
            counts[*b as usize] += 1;
        }
        
        // Each player should have exactly K matches
        for (i, count) in counts.iter().enumerate() {
            assert_eq!(*count, k as u32, "Player {} has {} matches, expected {}", i, count, k);
        }
    }
    
    #[test]
    fn test_total_matches_formula() {
        let seed = [42u8; 32];
        
        // Test the n*K/2 formula for various sizes (use even K for clean math)
        for (n, k) in [(10, 4), (20, 10), (50, 14), (100, 14)].iter() {
            let pairings = generate_all_pairings(*n, *k, &seed);
            let expected = (*n as usize) * (*k as usize) / 2;
            assert_eq!(
                pairings.len(), 
                expected,
                "n={}, k={}: got {} matches, expected {}",
                n, k, pairings.len(), expected
            );
        }
    }
    
    #[test]
    fn test_odd_k_handled() {
        let seed = [42u8; 32];
        let n = 20u32;
        let k = 15u16; // Odd K - rounds up to use 8 offsets = 16 matches/player
        let pairings = generate_all_pairings(n, k, &seed);
        
        // Count matches per player
        let mut counts = vec![0u32; n as usize];
        for (a, b) in &pairings {
            counts[*a as usize] += 1;
            counts[*b as usize] += 1;
        }
        
        // Each player should have >= K matches (might be K or K+1 due to rounding)
        for (i, count) in counts.iter().enumerate() {
            assert!(*count >= k as u32, "Player {} has {} matches, expected >= {}", i, count, k);
        }
    }
}
