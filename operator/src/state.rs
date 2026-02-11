//! State fetching and deserialization
//!
//! Matches the on-chain account structures from the Dilemma Arena contract.

use anyhow::{bail, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;

/// Tournament lifecycle state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TournamentState {
    Registration,
    Running,
    Payout,
}

/// Tournament account data (mirrors on-chain structure)
#[derive(Debug, Clone)]
pub struct Tournament {
    pub id: u32,
    pub state: TournamentState,
    
    // Snapshotted from Config at creation
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
    pub players: Vec<Pubkey>,
    pub scores: Vec<u32>,
    pub strategies: Vec<u8>,
    pub strategy_params: Vec<[u8; 5]>,
    pub bump: u8,
}

/// Global config account data
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

/// Entry account data
#[derive(Debug, Clone)]
pub struct Entry {
    pub tournament: Pubkey,
    pub player: Pubkey,
    pub index: u32,
    pub strategy: u8, // Strategy enum as u8
    pub strategy_params: [u8; 5],
    pub score: u32,
    pub matches_played: u16,
    pub paid_out: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl Config {
    /// Config account layout (after 8-byte discriminator):
    /// admin: Pubkey (32)
    /// operator: Pubkey (32)
    /// house_fee_bps: u16 (2)
    /// stake: u64 (8)
    /// min_participants: u16 (2)
    /// max_participants: u16 (2)
    /// registration_duration: i64 (8)
    /// matches_per_player: u16 (2)
    /// accumulated_fees: u64 (8)
    /// current_tournament_id: u32 (4)
    /// bump: u8 (1)
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        if data.len() < 8 + 32 + 32 + 2 + 8 + 2 + 2 + 8 + 2 + 8 + 4 + 1 {
            bail!("Config account data too short");
        }
        
        let data = &data[8..]; // Skip discriminator
        let mut offset = 0;
        
        let admin = Pubkey::try_from(&data[offset..offset + 32])?;
        offset += 32;
        
        let operator = Pubkey::try_from(&data[offset..offset + 32])?;
        offset += 32;
        
        let house_fee_bps = u16::from_le_bytes(data[offset..offset + 2].try_into()?);
        offset += 2;
        
        let stake = u64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let min_participants = u16::from_le_bytes(data[offset..offset + 2].try_into()?);
        offset += 2;
        
        let max_participants = u16::from_le_bytes(data[offset..offset + 2].try_into()?);
        offset += 2;
        
        let registration_duration = i64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let matches_per_player = u16::from_le_bytes(data[offset..offset + 2].try_into()?);
        offset += 2;
        
        let accumulated_fees = u64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let current_tournament_id = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let bump = data[offset];
        
        Ok(Config {
            admin,
            operator,
            house_fee_bps,
            stake,
            min_participants,
            max_participants,
            registration_duration,
            matches_per_player,
            accumulated_fees,
            current_tournament_id,
            bump,
        })
    }
}

impl Tournament {
    /// Tournament account layout (after 8-byte discriminator):
    /// id: u32 (4)
    /// state: TournamentState (1)
    /// stake: u64 (8)
    /// house_fee_bps: u16 (2)
    /// matches_per_player: u16 (2)
    /// registration_duration: i64 (8)
    /// pool: u64 (8)
    /// participant_count: u32 (4)
    /// registration_ends: i64 (8)
    /// matches_completed: u32 (4)
    /// matches_total: u32 (4)
    /// randomness_seed: [u8; 32] (32)
    /// min_winning_score: u32 (4)
    /// winner_count: u32 (4)
    /// winner_pool: u64 (8)
    /// claims_processed: u32 (4)
    /// payout_started_at: i64 (8)
    /// entries_remaining: u32 (4)
    /// players: Vec<Pubkey> (4 + n*32)
    /// scores: Vec<u32> (4 + n*4)
    /// bump: u8 (1)
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        let data = &data[8..]; // Skip discriminator
        let mut offset = 0;
        
        let id = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let state = match data[offset] {
            0 => TournamentState::Registration,
            1 => TournamentState::Running,
            2 => TournamentState::Payout,
            s => bail!("Unknown tournament state: {}", s),
        };
        offset += 1;
        
        let stake = u64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let house_fee_bps = u16::from_le_bytes(data[offset..offset + 2].try_into()?);
        offset += 2;
        
        let matches_per_player = u16::from_le_bytes(data[offset..offset + 2].try_into()?);
        offset += 2;
        
        let registration_duration = i64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let pool = u64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let participant_count = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let registration_ends = i64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let matches_completed = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let matches_total = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let mut randomness_seed = [0u8; 32];
        randomness_seed.copy_from_slice(&data[offset..offset + 32]);
        offset += 32;
        
        let min_winning_score = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let winner_count = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let winner_pool = u64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let claims_processed = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let payout_started_at = i64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let entries_remaining = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let round_tier = data[offset];
        offset += 1;
        
        // Vec<Pubkey> players
        let players_len = u32::from_le_bytes(data[offset..offset + 4].try_into()?) as usize;
        offset += 4;
        
        let mut players = Vec::with_capacity(players_len);
        for _ in 0..players_len {
            players.push(Pubkey::try_from(&data[offset..offset + 32])?);
            offset += 32;
        }
        
        // Vec<u32> scores
        let scores_len = u32::from_le_bytes(data[offset..offset + 4].try_into()?) as usize;
        offset += 4;
        
        let mut scores = Vec::with_capacity(scores_len);
        for _ in 0..scores_len {
            scores.push(u32::from_le_bytes(data[offset..offset + 4].try_into()?));
            offset += 4;
        }
        
        // Vec<u8> strategies
        let strategies_len = u32::from_le_bytes(data[offset..offset + 4].try_into()?) as usize;
        offset += 4;
        
        let mut strategies = Vec::with_capacity(strategies_len);
        for _ in 0..strategies_len {
            strategies.push(data[offset]);
            offset += 1;
        }
        
        // Vec<StrategyParams> (5 bytes each)
        let params_len = u32::from_le_bytes(data[offset..offset + 4].try_into()?) as usize;
        offset += 4;
        let mut strategy_params = Vec::with_capacity(params_len);
        for _ in 0..params_len {
            let mut p = [0u8; 5];
            p.copy_from_slice(&data[offset..offset + 5]);
            offset += 5;
            strategy_params.push(p);
        }
        
        let bump = data[offset];
        
        Ok(Tournament {
            id,
            state,
            stake,
            house_fee_bps,
            matches_per_player,
            registration_duration,
            pool,
            participant_count,
            registration_ends,
            matches_completed,
            matches_total,
            randomness_seed,
            min_winning_score,
            winner_count,
            winner_pool,
            claims_processed,
            payout_started_at,
            entries_remaining,
            round_tier,
            players,
            scores,
            strategies,
            strategy_params,
            bump,
        })
    }
}

impl Entry {
    /// Entry account layout (after 8-byte discriminator):
    /// tournament: Pubkey (32)
    /// player: Pubkey (32)
    /// index: u32 (4)
    /// strategy: Strategy enum (1)
    /// score: u32 (4)
    /// matches_played: u16 (2)
    /// paid_out: bool (1)
    /// created_at: i64 (8)
    /// bump: u8 (1)
    pub fn deserialize(data: &[u8]) -> Result<Self> {
        let data = &data[8..]; // Skip discriminator
        let mut offset = 0;
        
        let tournament = Pubkey::try_from(&data[offset..offset + 32])?;
        offset += 32;
        
        let player = Pubkey::try_from(&data[offset..offset + 32])?;
        offset += 32;
        
        let index = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let strategy = data[offset];
        offset += 1;
        
        let mut strategy_params = [0u8; 5];
        strategy_params.copy_from_slice(&data[offset..offset + 5]);
        offset += 5;
        
        let score = u32::from_le_bytes(data[offset..offset + 4].try_into()?);
        offset += 4;
        
        let matches_played = u16::from_le_bytes(data[offset..offset + 2].try_into()?);
        offset += 2;
        
        let paid_out = data[offset] != 0;
        offset += 1;
        
        let created_at = i64::from_le_bytes(data[offset..offset + 8].try_into()?);
        offset += 8;
        
        let bump = data[offset];
        
        Ok(Entry {
            tournament,
            player,
            index,
            strategy,
            strategy_params,
            score,
            matches_played,
            paid_out,
            created_at,
            bump,
        })
    }
}

/// Get config PDA
pub fn get_config_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"config"], program_id)
}

/// Get tournament PDA
pub fn get_tournament_pda(program_id: &Pubkey, tournament_id: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"tournament", &tournament_id.to_le_bytes()],
        program_id,
    )
}

/// Get entry PDA
pub fn get_entry_pda(program_id: &Pubkey, tournament: &Pubkey, player: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"entry", tournament.as_ref(), player.as_ref()],
        program_id,
    )
}

/// Fetch config from chain
pub fn fetch_config(client: &RpcClient, program_id: &Pubkey) -> Result<Config> {
    let (config_pda, _) = get_config_pda(program_id);
    let account = client.get_account(&config_pda)?;
    Config::deserialize(&account.data)
}

/// Fetch current tournament from chain
pub fn fetch_current_tournament(client: &RpcClient, program_id: &Pubkey) -> Result<Tournament> {
    let config = fetch_config(client, program_id)?;
    let (tournament_pda, _) = get_tournament_pda(program_id, config.current_tournament_id);
    let account = client.get_account(&tournament_pda)?;
    Tournament::deserialize(&account.data)
}

/// Fetch entry from chain
pub fn fetch_entry(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Pubkey,
    player: &Pubkey,
) -> Result<Entry> {
    let (entry_pda, _) = get_entry_pda(program_id, tournament, player);
    let account = client.get_account(&entry_pda)?;
    Entry::deserialize(&account.data)
}
