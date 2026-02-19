//! State deserialization — adapted from operator/src/state.rs (v1.7)

use anyhow::{bail, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TournamentState {
    Registration,
    Reveal,     // NEW v1.7
    Running,
    Payout,
}

impl std::fmt::Display for TournamentState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Registration => write!(f, "Registration"),
            Self::Reveal => write!(f, "Reveal"),
            Self::Running => write!(f, "Running"),
            Self::Payout => write!(f, "Payout"),
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Tournament {
    pub id: u32,
    pub state: TournamentState,
    pub stake: u64,
    pub house_fee_bps: u16,
    pub matches_per_player: u16,
    pub registration_duration: i64,
    pub pool: u64,
    pub participant_count: u32,
    pub registration_ends: i64,
    pub matches_completed: u32,
    pub matches_total: u32,
    pub randomness_seed: [u8; 32],
    pub min_winning_score: u32,
    pub winner_count: u32,
    pub winner_pool: u64,
    pub claims_processed: u32,
    pub payout_started_at: i64,
    pub entries_remaining: u32,
    pub round_tier: u8,
    pub reveal_ends: i64,           // NEW v1.7
    pub reveal_duration: i64,       // NEW v1.7
    pub reveals_completed: u32,     // NEW v1.7
    pub forfeits: u32,              // NEW v1.7
    // Note: players vec comes next in serialization, followed by bump, then operator_costs
    pub players: Vec<Pubkey>,
    pub scores: Vec<u32>,
    pub strategies: Vec<u8>,
    pub bump: u8,
    pub operator_costs: u64,        // NEW v1.8
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Config {
    pub admin: Pubkey,
    pub operator: Pubkey,
    pub house_fee_bps: u16,
    pub stake: u64,
    pub min_participants: u16,
    pub max_participants: u16,
    pub registration_duration: i64,
    pub matches_per_player: u16,
    pub accumulated_fees: u64,
    pub current_tournament_id: u32,
    pub reveal_duration: i64,       // NEW v1.7
    pub bump: u8,
    pub operator_tx_fee: u64,       // NEW v1.8
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct Entry {
    pub tournament: Pubkey,
    pub player: Pubkey,
    pub index: u32,
    pub commitment: [u8; 32],      // NEW v1.7
    pub strategy: u8,
    pub revealed: bool,            // NEW v1.7
    pub score: u32,
    pub matches_played: u16,
    pub paid_out: bool,
    pub created_at: i64,
    pub bump: u8,
    pub bytecode_len: u8,          // NEW v1.9
    pub bytecode: [u8; 64],        // NEW v1.9
}

impl Config {
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        let data = &data[8..];
        let mut o = 0;
        let admin = Pubkey::try_from(&data[o..o + 32])?; o += 32;
        let operator = Pubkey::try_from(&data[o..o + 32])?; o += 32;
        let house_fee_bps = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
        let stake = u64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let min_participants = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
        let max_participants = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
        let registration_duration = i64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let matches_per_player = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
        let accumulated_fees = u64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let current_tournament_id = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let reveal_duration = i64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let bump = data[o]; o += 1;
        // NEW v1.8: operator_tx_fee (reads from padding on old accounts → 0)
        let operator_tx_fee = if o + 8 <= data.len() {
            u64::from_le_bytes(data[o..o + 8].try_into()?)
        } else {
            0
        };
        Ok(Config { admin, operator, house_fee_bps, stake, min_participants, max_participants, registration_duration, matches_per_player, accumulated_fees, current_tournament_id, reveal_duration, bump, operator_tx_fee })
    }
}

impl Tournament {
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        let data = &data[8..];
        let mut o = 0;
        let id = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let state = match data[o] {
            0 => TournamentState::Registration,
            1 => TournamentState::Reveal,
            2 => TournamentState::Running,
            3 => TournamentState::Payout,
            s => bail!("Unknown state: {}", s),
        }; o += 1;
        let stake = u64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let house_fee_bps = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
        let matches_per_player = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
        let registration_duration = i64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let pool = u64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let participant_count = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let registration_ends = i64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let matches_completed = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let matches_total = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let mut randomness_seed = [0u8; 32]; randomness_seed.copy_from_slice(&data[o..o + 32]); o += 32;
        let min_winning_score = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let winner_count = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let winner_pool = u64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let claims_processed = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let payout_started_at = i64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let entries_remaining = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let round_tier = data[o]; o += 1;
        // NEW v1.7 fields
        let reveal_ends = i64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let reveal_duration = i64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let reveals_completed = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let forfeits = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        // Vecs
        let players_len = u32::from_le_bytes(data[o..o + 4].try_into()?) as usize; o += 4;
        let mut players = Vec::with_capacity(players_len);
        for _ in 0..players_len { players.push(Pubkey::try_from(&data[o..o + 32])?); o += 32; }
        let scores_len = u32::from_le_bytes(data[o..o + 4].try_into()?) as usize; o += 4;
        let mut scores = Vec::with_capacity(scores_len);
        for _ in 0..scores_len { scores.push(u32::from_le_bytes(data[o..o + 4].try_into()?)); o += 4; }
        let strategies_len = u32::from_le_bytes(data[o..o + 4].try_into()?) as usize; o += 4;
        let mut strategies = Vec::with_capacity(strategies_len);
        for _ in 0..strategies_len { strategies.push(data[o]); o += 1; }
        let bump = data[o]; o += 1;
        // NEW v1.8: operator_costs (reads from padding on old accounts → 0)
        let operator_costs = if o + 8 <= data.len() {
            u64::from_le_bytes(data[o..o + 8].try_into()?)
        } else {
            0
        };
        Ok(Tournament { id, state, stake, house_fee_bps, matches_per_player, registration_duration, pool, participant_count, registration_ends, matches_completed, matches_total, randomness_seed, min_winning_score, winner_count, winner_pool, claims_processed, payout_started_at, entries_remaining, round_tier, reveal_ends, reveal_duration, reveals_completed, forfeits, players, scores, strategies, bump, operator_costs })
    }
}

impl Entry {
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        let data = &data[8..];
        let mut o = 0;
        let tournament = Pubkey::try_from(&data[o..o + 32])?; o += 32;
        let player = Pubkey::try_from(&data[o..o + 32])?; o += 32;
        let index = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        // NEW v1.7: commitment
        let mut commitment = [0u8; 32]; commitment.copy_from_slice(&data[o..o + 32]); o += 32;
        let strategy = data[o]; o += 1;
        // NEW v1.7: revealed
        let revealed = data[o] != 0; o += 1;
        let score = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let matches_played = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
        let paid_out = data[o] != 0; o += 1;
        let created_at = i64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let bump = data[o]; o += 1;
        // NEW v1.9: bytecode_len + bytecode (reads from padding on old accounts → 0)
        let bytecode_len = if o < data.len() { data[o] } else { 0 };
        o += 1;
        let mut bytecode = [0u8; 64];
        if o + 64 <= data.len() {
            bytecode.copy_from_slice(&data[o..o + 64]);
        }
        Ok(Entry { tournament, player, index, commitment, strategy, revealed, score, matches_played, paid_out, created_at, bump, bytecode_len, bytecode })
    }
}

pub fn get_config_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"config"], program_id)
}

pub fn get_tournament_pda(program_id: &Pubkey, tournament_id: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"tournament", &tournament_id.to_le_bytes()], program_id)
}

pub fn get_entry_pda(program_id: &Pubkey, tournament: &Pubkey, player: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"entry", tournament.as_ref(), player.as_ref()], program_id)
}

pub fn fetch_config(client: &RpcClient, program_id: &Pubkey) -> Result<Config> {
    let (pda, _) = get_config_pda(program_id);
    let account = client.get_account(&pda)?;
    Config::deserialize(&account.data)
}

pub fn fetch_tournament(client: &RpcClient, program_id: &Pubkey, id: u32) -> Result<Tournament> {
    let (pda, _) = get_tournament_pda(program_id, id);
    let account = client.get_account(&pda)?;
    Tournament::deserialize(&account.data)
}

/// Returns the ID of the most relevant tournament:
/// - If current_tournament_id points to a Registration-phase tournament
///   (created automatically after finalization), returns id - 1.
/// - Otherwise returns current_tournament_id (the active tournament).
pub fn resolve_latest_tournament_id(client: &RpcClient, program_id: &Pubkey) -> Result<u32> {
    let config = fetch_config(client, program_id)?;
    let tid = config.current_tournament_id;
    let tournament = fetch_tournament(client, program_id, tid)?;
    if tournament.state == TournamentState::Registration && tid > 1 {
        Ok(tid - 1)
    } else {
        Ok(tid)
    }
}

pub fn fetch_current_tournament(client: &RpcClient, program_id: &Pubkey) -> Result<(Config, Tournament)> {
    let config = fetch_config(client, program_id)?;
    let tid = config.current_tournament_id;
    let tournament = fetch_tournament(client, program_id, tid)?;
    if tournament.state == TournamentState::Registration && tid > 1 {
        let prev = fetch_tournament(client, program_id, tid - 1)?;
        Ok((config, prev))
    } else {
        Ok((config, tournament))
    }
}
