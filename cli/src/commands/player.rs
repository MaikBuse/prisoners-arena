use anyhow::{bail, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    signer::Signer,
    system_program,
};

use crate::config::ArenaConfig;
use crate::state;
use crate::tx::send_transaction;

mod disc {
    pub const ENTER_TOURNAMENT: [u8; 8] = [19, 21, 109, 109, 227, 108, 232, 25];
    pub const CLAIM_REFUND: [u8; 8] = [15, 16, 30, 161, 255, 228, 97, 60];
    pub const CLAIM_PAYOUT: [u8; 8] = [127, 240, 132, 62, 227, 198, 146, 133];
}

fn parse_strategy(name: &str) -> Result<u8> {
    match name.to_lowercase().replace('_', "-").as_str() {
        "tit-for-tat" | "titfortat" => Ok(0),
        "always-defect" | "alwaysdefect" => Ok(1),
        "always-cooperate" | "alwayscooperate" => Ok(2),
        "grim-trigger" | "grimtrigger" => Ok(3),
        "pavlov" => Ok(4),
        "suspicious-tit-for-tat" | "suspicioustitfortat" => Ok(5),
        "random" => Ok(6),
        "tit-for-two-tats" | "titfortwotats" => Ok(7),
        "gradual" => Ok(8),
        _ => bail!("Unknown strategy: {}. Options: tit-for-tat, always-defect, always-cooperate, grim-trigger, pavlov, suspicious-tit-for-tat, random, tit-for-two-tats, gradual", name),
    }
}

pub fn enter(cfg: &ArenaConfig, wallet: &str, strategy: &str, dry_run: bool) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let player = cfg.load_keypair(wallet)?;
    let strategy_id = parse_strategy(strategy)?;

    let config = state::fetch_config(&client, &program_id)?;
    let (config_pda, _) = state::get_config_pda(&program_id);
    let (tournament_pda, _) = state::get_tournament_pda(&program_id, config.current_tournament_id);
    let (entry_pda, _) = state::get_entry_pda(&program_id, &tournament_pda, &player.pubkey());

    let mut data = disc::ENTER_TOURNAMENT.to_vec();
    data.push(strategy_id);

    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(player.pubkey(), true),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    let ix = Instruction { program_id, accounts, data };
    send_transaction(&client, &[ix], &player, dry_run)?;
    if !dry_run {
        println!("Entered tournament #{} with strategy {}", config.current_tournament_id, strategy);
    }
    Ok(())
}

pub fn refund(cfg: &ArenaConfig, wallet: &str, dry_run: bool) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let player = cfg.load_keypair(wallet)?;

    let config = state::fetch_config(&client, &program_id)?;
    let (config_pda, _) = state::get_config_pda(&program_id);
    let (tournament_pda, _) = state::get_tournament_pda(&program_id, config.current_tournament_id);
    let (entry_pda, _) = state::get_entry_pda(&program_id, &tournament_pda, &player.pubkey());

    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(player.pubkey(), true),
    ];

    let ix = Instruction { program_id, accounts, data: disc::CLAIM_REFUND.to_vec() };
    send_transaction(&client, &[ix], &player, dry_run)?;
    if !dry_run {
        println!("Refund claimed");
    }
    Ok(())
}

pub fn claim(cfg: &ArenaConfig, wallet: &str, tournament_id: Option<u32>, dry_run: bool) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let player = cfg.load_keypair(wallet)?;

    let tid = match tournament_id {
        Some(id) => id,
        None => state::fetch_config(&client, &program_id)?.current_tournament_id,
    };

    let (config_pda, _) = state::get_config_pda(&program_id);
    let (tournament_pda, _) = state::get_tournament_pda(&program_id, tid);
    let (entry_pda, _) = state::get_entry_pda(&program_id, &tournament_pda, &player.pubkey());

    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(player.pubkey(), true),
    ];

    let ix = Instruction { program_id, accounts, data: disc::CLAIM_PAYOUT.to_vec() };
    send_transaction(&client, &[ix], &player, dry_run)?;
    if !dry_run {
        println!("Payout claimed for tournament #{}", tid);
    }
    Ok(())
}
