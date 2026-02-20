use anyhow::{bail, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    signer::Signer,
};
use solana_system_interface::program as system_program;
use sha2::{Sha256, Digest};

use crate::config::ArenaConfig;
use crate::state;
use crate::tx::send_transaction;

mod disc {
    pub const ENTER_TOURNAMENT: [u8; 8] = [19, 21, 109, 109, 227, 108, 232, 25];
    pub const REVEAL_STRATEGY: [u8; 8] = [102, 15, 100, 245, 177, 6, 9, 198];
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
        "custom" => Ok(9),
        _ => bail!("Unknown strategy: {}. Options: tit-for-tat, always-defect, always-cooperate, grim-trigger, pavlov, suspicious-tit-for-tat, random, tit-for-two-tats, gradual, custom", name),
    }
}

/// Compute SHA256 commitment hash.
/// Builtin (0–8): SHA256(strategy_u8 || salt) — 17 bytes
/// Custom  (9):   SHA256(9u8 || SHA256(bytecode) || salt) — 49 bytes
fn compute_commitment(strategy_id: u8, salt: &[u8; 16], bytecode: Option<&[u8]>) -> [u8; 32] {
    let mut hasher = Sha256::new();
    if strategy_id == 9 {
        let bytecode = bytecode.expect("bytecode required for custom strategy");
        let bytecode_hash: [u8; 32] = Sha256::digest(bytecode).into();
        hasher.update([9u8]);
        hasher.update(bytecode_hash);
    } else {
        hasher.update([strategy_id]);
    }
    hasher.update(salt);
    hasher.finalize().into()
}

/// Save reveal data to local file for later use
fn save_reveal_data(tournament_id: u32, player: &str, strategy_id: u8, salt: &[u8; 16], bytecode: Option<&[u8]>) -> Result<()> {
    let dir = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?
        .join(".prisoners-arena")
        .join("reveals");
    std::fs::create_dir_all(&dir)?;

    let filename = format!("{}_{}.json", tournament_id, player);
    let mut data = serde_json::json!({
        "tournament_id": tournament_id,
        "player": player,
        "strategy_id": strategy_id,
        "salt": hex::encode(salt),
    });
    if let Some(bc) = bytecode {
        data["bytecode"] = serde_json::Value::String(hex::encode(bc));
    }

    std::fs::write(dir.join(filename), serde_json::to_string_pretty(&data)?)?;
    Ok(())
}

/// Load reveal data from local file
fn load_reveal_data(tournament_id: u32, player: &str) -> Result<(u8, [u8; 16], Option<Vec<u8>>)> {
    let path = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?
        .join(".prisoners-arena")
        .join("reveals")
        .join(format!("{}_{}.json", tournament_id, player));

    let content = std::fs::read_to_string(&path)
        .map_err(|_| anyhow::anyhow!("No saved reveal data at {}. Use --salt to provide manually.", path.display()))?;
    let data: serde_json::Value = serde_json::from_str(&content)?;

    let salt_hex = data["salt"].as_str().ok_or_else(|| anyhow::anyhow!("Invalid reveal data: missing salt"))?;
    let salt_bytes = hex::decode(salt_hex)?;
    let mut salt = [0u8; 16];
    salt.copy_from_slice(&salt_bytes);

    let strategy_id = data["strategy_id"].as_u64()
        .ok_or_else(|| anyhow::anyhow!("Invalid reveal data: missing strategy_id"))? as u8;

    let bytecode = if let Some(bc_hex) = data["bytecode"].as_str() {
        Some(hex::decode(bc_hex)?)
    } else {
        None
    };

    Ok((strategy_id, salt, bytecode))
}

pub fn enter(cfg: &ArenaConfig, wallet: &str, strategy: &str, bytecode_hex: Option<&str>, salt_hex: Option<&str>, dry_run: bool) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let player = cfg.load_keypair(wallet)?;
    let strategy_id = parse_strategy(strategy)?;

    // Parse bytecode if provided
    let bytecode = if let Some(hex_str) = bytecode_hex {
        if strategy_id != 9 {
            bail!("--bytecode is only valid with --strategy custom");
        }
        Some(hex::decode(hex_str)?)
    } else {
        if strategy_id == 9 {
            bail!("--bytecode is required when using --strategy custom");
        }
        None
    };

    // Generate or parse salt
    let salt: [u8; 16] = if let Some(hex_str) = salt_hex {
        let bytes = hex::decode(hex_str)?;
        if bytes.len() != 16 {
            bail!("Salt must be exactly 16 bytes (32 hex chars)");
        }
        let mut arr = [0u8; 16];
        arr.copy_from_slice(&bytes);
        arr
    } else {
        let mut arr = [0u8; 16];
        getrandom::fill(&mut arr)?;
        arr
    };

    // Compute commitment
    let commitment = compute_commitment(strategy_id, &salt, bytecode.as_deref());

    let config = state::fetch_config(&client, &program_id)?;
    let (config_pda, _) = state::get_config_pda(&program_id);
    let (tournament_pda, _) = state::get_tournament_pda(&program_id, config.current_tournament_id);
    let (entry_pda, _) = state::get_entry_pda(&program_id, &tournament_pda, &player.pubkey());

    let mut data = disc::ENTER_TOURNAMENT.to_vec();
    data.extend_from_slice(&commitment);

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
        save_reveal_data(
            config.current_tournament_id,
            &player.pubkey().to_string(),
            strategy_id,
            &salt,
            bytecode.as_deref(),
        )?;

        println!("Commitment submitted for tournament #{}", config.current_tournament_id);
        println!("Salt: {}", hex::encode(&salt));
        println!("Reveal data saved to ~/.prisoners-arena/reveals/");
    }
    Ok(())
}

pub fn reveal(cfg: &ArenaConfig, wallet: &str, salt_hex: Option<&str>, dry_run: bool) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let player = cfg.load_keypair(wallet)?;

    let config = state::fetch_config(&client, &program_id)?;
    let (tournament_pda, _) = state::get_tournament_pda(&program_id, config.current_tournament_id);
    let (entry_pda, _) = state::get_entry_pda(&program_id, &tournament_pda, &player.pubkey());

    // Load reveal data from saved file, optionally overriding salt
    let (strategy_id, salt, bytecode) = {
        let (sid, saved_salt, bc) = load_reveal_data(config.current_tournament_id, &player.pubkey().to_string())?;
        if let Some(hex_str) = salt_hex {
            let bytes = hex::decode(hex_str)?;
            if bytes.len() != 16 { bail!("Salt must be exactly 16 bytes"); }
            let mut arr = [0u8; 16];
            arr.copy_from_slice(&bytes);
            (sid, arr, bc)
        } else {
            (sid, saved_salt, bc)
        }
    };

    // Build reveal_strategy instruction data (Borsh-compatible)
    // Layout: disc(8) || strategy_u8(1) || salt(16) || option_bytecode
    let mut data = disc::REVEAL_STRATEGY.to_vec();
    data.push(strategy_id);
    data.extend_from_slice(&salt);
    match &bytecode {
        None => data.push(0x00),           // Option::None
        Some(bc) => {
            data.push(0x01);               // Option::Some
            data.extend_from_slice(&(bc.len() as u32).to_le_bytes()); // Vec length
            data.extend_from_slice(bc);    // Vec data
        }
    }

    let accounts = vec![
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(player.pubkey(), true),
    ];

    let ix = Instruction { program_id, accounts, data };
    send_transaction(&client, &[ix], &player, dry_run)?;

    if !dry_run {
        let strat_names = ["TitForTat", "AlwaysDefect", "AlwaysCooperate", "GrimTrigger", "Pavlov", "SuspiciousTitForTat", "Random", "TitForTwoTats", "Gradual", "Custom"];
        let name = strat_names.get(strategy_id as usize).unwrap_or(&"Unknown");
        println!("Strategy revealed: {}", name);
    }
    Ok(())
}

pub fn refund(cfg: &ArenaConfig, wallet: &str, dry_run: bool) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let player = cfg.load_keypair(wallet)?;

    let config = state::fetch_config(&client, &program_id)?;
    let (tournament_pda, _) = state::get_tournament_pda(&program_id, config.current_tournament_id);
    let (entry_pda, _) = state::get_entry_pda(&program_id, &tournament_pda, &player.pubkey());

    let accounts = vec![
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
        None => state::resolve_latest_tournament_id(&client, &program_id)?,
    };

    let (tournament_pda, _) = state::get_tournament_pda(&program_id, tid);
    let (entry_pda, _) = state::get_entry_pda(&program_id, &tournament_pda, &player.pubkey());

    let accounts = vec![
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(player.pubkey(), true),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    let ix = Instruction { program_id, accounts, data: disc::CLAIM_PAYOUT.to_vec() };
    send_transaction(&client, &[ix], &player, dry_run)?;
    if !dry_run {
        println!("Payout claimed for tournament #{}", tid);
    }
    Ok(())
}
