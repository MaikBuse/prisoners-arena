use anyhow::Result;
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signer::Signer,
};
use solana_system_interface::program as system_program;
use std::str::FromStr;

use crate::config::ArenaConfig;
use crate::state;
use crate::tx::send_transaction;

mod disc {
    pub const INITIALIZE_CONFIG: [u8; 8] = [208, 127, 21, 1, 194, 190, 196, 70];
    pub const UPDATE_CONFIG: [u8; 8] = [29, 158, 252, 191, 10, 83, 219, 99];
    pub const WITHDRAW_FEES: [u8; 8] = [198, 212, 171, 109, 144, 215, 174, 89];
}

pub fn init(cfg: &ArenaConfig, dry_run: bool) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let admin = cfg.load_keypair("admin")?;
    let operator_pubkey = Pubkey::from_str(&{
        // Read operator keypair to get pubkey
        let op_kp = cfg.load_keypair("operator")?;
        op_kp.pubkey().to_string()
    })?;

    let (config_pda, _) = state::get_config_pda(&program_id);
    let (tournament_pda, _) = state::get_tournament_pda(&program_id, 0);

    let mut data = disc::INITIALIZE_CONFIG.to_vec();
    data.extend_from_slice(operator_pubkey.as_ref()); // operator: Pubkey
    data.extend_from_slice(&cfg.defaults.stake.to_le_bytes()); // stake: u64
    data.extend_from_slice(&cfg.defaults.min_participants.to_le_bytes()); // min_participants: u16
    data.extend_from_slice(&cfg.defaults.max_participants.to_le_bytes()); // max_participants: u16
    data.extend_from_slice(&cfg.defaults.registration_duration.to_le_bytes()); // registration_duration: i64
    data.extend_from_slice(&cfg.defaults.matches_per_player.to_le_bytes()); // matches_per_player: u16
    data.extend_from_slice(&cfg.defaults.reveal_duration.to_le_bytes()); // reveal_duration: i64

    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(admin.pubkey(), true),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    let ix = Instruction { program_id, accounts, data };
    send_transaction(&client, &[ix], &admin, dry_run)?;
    if !dry_run {
        println!("Config and Tournament #0 initialized");
    }
    Ok(())
}

pub fn config_show(cfg: &ArenaConfig) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let config = state::fetch_config(&client, &program_id)?;

    println!("=== On-Chain Config ===");
    println!("  Admin:                 {}", config.admin);
    println!("  Operator:              {}", config.operator);
    println!("  Stake:                 {} lamports ({:.4} SOL)", config.stake, config.stake as f64 / 1e9);
    println!("  House Fee:             {} bps", config.house_fee_bps);
    println!("  Min Participants:      {}", config.min_participants);
    println!("  Max Participants:      {}", config.max_participants);
    println!("  Registration Duration: {}s", config.registration_duration);
    println!("  Matches Per Player:    {}", config.matches_per_player);
    println!("  Reveal Duration:       {}s", config.reveal_duration);
    println!("  Accumulated Fees:      {} lamports ({:.4} SOL)", config.accumulated_fees, config.accumulated_fees as f64 / 1e9);
    println!("  Current Tournament ID: {}", config.current_tournament_id);
    Ok(())
}

pub fn config_update(
    cfg: &ArenaConfig,
    stake: Option<u64>,
    min_participants: Option<u16>,
    max_participants: Option<u16>,
    registration_duration: Option<i64>,
    matches_per_player: Option<u16>,
    house_fee_bps: Option<u16>,
    operator: Option<String>,
    reveal_duration: Option<i64>,
    dry_run: bool,
) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let admin = cfg.load_keypair("admin")?;

    let (config_pda, _) = state::get_config_pda(&program_id);

    let mut data = disc::UPDATE_CONFIG.to_vec();

    // Anchor Option encoding: 0x00 = None, 0x01 + value = Some
    // Fields: operator, stake, min_participants, max_participants, registration_duration, matches_per_player, house_fee_bps
    fn push_option_pubkey(data: &mut Vec<u8>, val: &Option<Pubkey>) {
        match val {
            None => data.push(0),
            Some(v) => { data.push(1); data.extend_from_slice(v.as_ref()); }
        }
    }
    fn push_option_u64(data: &mut Vec<u8>, val: &Option<u64>) {
        match val {
            None => data.push(0),
            Some(v) => { data.push(1); data.extend_from_slice(&v.to_le_bytes()); }
        }
    }
    fn push_option_u16(data: &mut Vec<u8>, val: &Option<u16>) {
        match val {
            None => data.push(0),
            Some(v) => { data.push(1); data.extend_from_slice(&v.to_le_bytes()); }
        }
    }
    fn push_option_i64(data: &mut Vec<u8>, val: &Option<i64>) {
        match val {
            None => data.push(0),
            Some(v) => { data.push(1); data.extend_from_slice(&v.to_le_bytes()); }
        }
    }

    let operator_pk = operator.map(|s| Pubkey::from_str(&s)).transpose()?;
    // Order must match contract: operator, house_fee_bps, stake, min_participants, max_participants, registration_duration, matches_per_player, reveal_duration
    push_option_pubkey(&mut data, &operator_pk);
    push_option_u16(&mut data, &house_fee_bps);
    push_option_u64(&mut data, &stake);
    push_option_u16(&mut data, &min_participants);
    push_option_u16(&mut data, &max_participants);
    push_option_i64(&mut data, &registration_duration);
    push_option_u16(&mut data, &matches_per_player);
    push_option_i64(&mut data, &reveal_duration);

    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new_readonly(admin.pubkey(), true),
    ];

    let ix = Instruction { program_id, accounts, data };
    send_transaction(&client, &[ix], &admin, dry_run)?;
    if !dry_run {
        println!("Config updated");
    }
    Ok(())
}

pub fn withdraw_fees(cfg: &ArenaConfig, dry_run: bool) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let admin = cfg.load_keypair("admin")?;

    let (config_pda, _) = state::get_config_pda(&program_id);

    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(admin.pubkey(), true),
    ];

    let ix = Instruction {
        program_id,
        accounts,
        data: disc::WITHDRAW_FEES.to_vec(),
    };

    send_transaction(&client, &[ix], &admin, dry_run)?;
    if !dry_run {
        println!("Fees withdrawn to admin wallet");
    }
    Ok(())
}
