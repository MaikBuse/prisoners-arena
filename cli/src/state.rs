//! State deserialization — adapted from operator/src/state.rs

use anyhow::{bail, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TournamentState {
    Registration,
    Running,
    Payout,
}

impl std::fmt::Display for TournamentState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Registration => write!(f, "Registration"),
            Self::Running => write!(f, "Running"),
            Self::Payout => write!(f, "Payout"),
        }
    }
}

#[derive(Debug, Clone)]
pub struct Tournament {
    pub id: u32,
    pub state: TournamentState,
    pub stake: u64,
    pub house_fee_bps: u16,
    pub matches_per_player: u16,
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
    pub players: Vec<Pubkey>,
    pub scores: Vec<u32>,
    pub bump: u8,
}

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
    pub bump: u8,
}

#[derive(Debug, Clone)]
pub struct Entry {
    pub tournament: Pubkey,
    pub player: Pubkey,
    pub index: u32,
    pub strategy: u8,
    pub score: u32,
    pub matches_played: u16,
    pub paid_out: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl Config {
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        if data.len() < 109 {
            bail!("Config account data too short");
        }
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
        let bump = data[o];
        Ok(Config { admin, operator, house_fee_bps, stake, min_participants, max_participants, registration_duration, matches_per_player, accumulated_fees, current_tournament_id, bump })
    }
}

impl Tournament {
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        let data = &data[8..];
        let mut o = 0;
        let id = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let state = match data[o] { 0 => TournamentState::Registration, 1 => TournamentState::Running, 2 => TournamentState::Payout, s => bail!("Unknown state: {}", s) }; o += 1;
        let stake = u64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let house_fee_bps = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
        let matches_per_player = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
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
        let players_len = u32::from_le_bytes(data[o..o + 4].try_into()?) as usize; o += 4;
        let mut players = Vec::with_capacity(players_len);
        for _ in 0..players_len { players.push(Pubkey::try_from(&data[o..o + 32])?); o += 32; }
        let scores_len = u32::from_le_bytes(data[o..o + 4].try_into()?) as usize; o += 4;
        let mut scores = Vec::with_capacity(scores_len);
        for _ in 0..scores_len { scores.push(u32::from_le_bytes(data[o..o + 4].try_into()?)); o += 4; }
        let bump = data[o];
        Ok(Tournament { id, state, stake, house_fee_bps, matches_per_player, pool, participant_count, registration_ends, matches_completed, matches_total, randomness_seed, min_winning_score, winner_count, winner_pool, claims_processed, payout_started_at, players, scores, bump })
    }
}

impl Entry {
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        let data = &data[8..];
        let mut o = 0;
        let tournament = Pubkey::try_from(&data[o..o + 32])?; o += 32;
        let player = Pubkey::try_from(&data[o..o + 32])?; o += 32;
        let index = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let strategy = data[o]; o += 1;
        let score = u32::from_le_bytes(data[o..o + 4].try_into()?); o += 4;
        let matches_played = u16::from_le_bytes(data[o..o + 2].try_into()?); o += 2;
        let paid_out = data[o] != 0; o += 1;
        let created_at = i64::from_le_bytes(data[o..o + 8].try_into()?); o += 8;
        let bump = data[o];
        Ok(Entry { tournament, player, index, strategy, score, matches_played, paid_out, created_at, bump })
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

pub fn fetch_current_tournament(client: &RpcClient, program_id: &Pubkey) -> Result<(Config, Tournament)> {
    let config = fetch_config(client, program_id)?;
    let tournament = fetch_tournament(client, program_id, config.current_tournament_id)?;
    Ok((config, tournament))
}
