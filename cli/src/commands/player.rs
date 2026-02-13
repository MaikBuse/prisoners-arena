use anyhow::{bail, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    signer::Signer,
};
#[allow(deprecated)]
use solana_sdk::system_program;
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
        _ => bail!("Unknown strategy: {}. Options: tit-for-tat, always-defect, always-cooperate, grim-trigger, pavlov, suspicious-tit-for-tat, random, tit-for-two-tats, gradual", name),
    }
}

/// Compute SHA256 commitment: hash(strategy_byte || params[5] || salt[16])
fn compute_commitment(strategy_id: u8, forgiveness: u8, retaliation_delay: u8, noise_tolerance: u8, initial_moves: u8, cooperate_bias: u8, salt: &[u8; 16]) -> [u8; 32] {
    let mut preimage = Vec::with_capacity(22);
    preimage.push(strategy_id);
    preimage.push(forgiveness);
    preimage.push(retaliation_delay);
    preimage.push(noise_tolerance);
    preimage.push(initial_moves);
    preimage.push(cooperate_bias);
    preimage.extend_from_slice(salt);
    
    let mut hasher = Sha256::new();
    hasher.update(&preimage);
    hasher.finalize().into()
}

/// Save reveal data to local file for later use
fn save_reveal_data(tournament_id: u32, player: &str, strategy_id: u8, forgiveness: u8, retaliation_delay: u8, noise_tolerance: u8, initial_moves: u8, cooperate_bias: u8, salt: &[u8; 16]) -> Result<()> {
    let dir = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?
        .join(".dilemma-arena")
        .join("reveals");
    std::fs::create_dir_all(&dir)?;
    
    let filename = format!("{}_{}.json", tournament_id, player);
    let data = serde_json::json!({
        "tournament_id": tournament_id,
        "player": player,
        "strategy_id": strategy_id,
        "forgiveness": forgiveness,
        "retaliation_delay": retaliation_delay,
        "noise_tolerance": noise_tolerance,
        "initial_moves": initial_moves,
        "cooperate_bias": cooperate_bias,
        "salt": hex::encode(salt),
    });
    
    std::fs::write(dir.join(filename), serde_json::to_string_pretty(&data)?)?;
    Ok(())
}

/// Load reveal data from local file
fn load_reveal_data(tournament_id: u32, player: &str) -> Result<(u8, u8, u8, u8, u8, u8, [u8; 16])> {
    let path = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Could not determine home directory"))?
        .join(".dilemma-arena")
        .join("reveals")
        .join(format!("{}_{}.json", tournament_id, player));
    
    let content = std::fs::read_to_string(&path)
        .map_err(|_| anyhow::anyhow!("No saved reveal data at {}. Use --salt to provide manually.", path.display()))?;
    let data: serde_json::Value = serde_json::from_str(&content)?;
    
    let salt_hex = data["salt"].as_str().ok_or_else(|| anyhow::anyhow!("Invalid reveal data"))?;
    let salt_bytes = hex::decode(salt_hex)?;
    let mut salt = [0u8; 16];
    salt.copy_from_slice(&salt_bytes);
    
    Ok((
        data["strategy_id"].as_u64().unwrap() as u8,
        data["forgiveness"].as_u64().unwrap() as u8,
        data["retaliation_delay"].as_u64().unwrap() as u8,
        data["noise_tolerance"].as_u64().unwrap() as u8,
        data["initial_moves"].as_u64().unwrap() as u8,
        data["cooperate_bias"].as_u64().unwrap() as u8,
        salt,
    ))
}

pub fn enter(cfg: &ArenaConfig, wallet: &str, strategy: &str, forgiveness: u8, retaliation_delay: u8, noise_tolerance: u8, initial_moves: u8, cooperate_bias: u8, salt_hex: Option<&str>, dry_run: bool) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let program_id = cfg.program_id()?;
    let player = cfg.load_keypair(wallet)?;
    let strategy_id = parse_strategy(strategy)?;

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
        getrandom::getrandom(&mut arr)?;
        arr
    };

    // Compute commitment
    let commitment = compute_commitment(strategy_id, forgiveness, retaliation_delay, noise_tolerance, initial_moves, cooperate_bias, &salt);

    let config = state::fetch_config(&client, &program_id)?;
    let (config_pda, _) = state::get_config_pda(&program_id);
    let (tournament_pda, _) = state::get_tournament_pda(&program_id, config.current_tournament_id);
    let (entry_pda, _) = state::get_entry_pda(&program_id, &tournament_pda, &player.pubkey());

    // v1.7: enter_tournament takes commitment [u8; 32]
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
        // Save reveal data locally
        save_reveal_data(
            config.current_tournament_id,
            &player.pubkey().to_string(),
            strategy_id, forgiveness, retaliation_delay, noise_tolerance, initial_moves, cooperate_bias,
            &salt,
        )?;
        
        println!("Commitment submitted for tournament #{}", config.current_tournament_id);
        println!("Salt: {}", hex::encode(&salt));
        println!("Reveal data saved to ~/.dilemma-arena/reveals/");
        println!("⚠️  Save your salt! You'll need it to reveal your strategy.");
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

    // Load reveal data from saved file or use provided salt
    let (strategy_id, forgiveness, retaliation_delay, noise_tolerance, initial_moves, cooperate_bias, salt) = if let Some(hex_str) = salt_hex {
        // If salt provided manually, we still need strategy+params from saved data
        let (sid, f, rd, nt, im, cb, _) = load_reveal_data(config.current_tournament_id, &player.pubkey().to_string())?;
        let bytes = hex::decode(hex_str)?;
        if bytes.len() != 16 { bail!("Salt must be exactly 16 bytes"); }
        let mut arr = [0u8; 16];
        arr.copy_from_slice(&bytes);
        (sid, f, rd, nt, im, cb, arr)
    } else {
        load_reveal_data(config.current_tournament_id, &player.pubkey().to_string())?
    };

    // Build reveal_strategy instruction data
    let mut data = disc::REVEAL_STRATEGY.to_vec();
    data.push(strategy_id);
    data.push(forgiveness);
    data.push(retaliation_delay);
    data.push(noise_tolerance);
    data.push(initial_moves);
    data.push(cooperate_bias);
    data.extend_from_slice(&salt);

    let accounts = vec![
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(player.pubkey(), true),
    ];

    let ix = Instruction { program_id, accounts, data };
    send_transaction(&client, &[ix], &player, dry_run)?;
    
    if !dry_run {
        let strat_names = ["TitForTat", "AlwaysDefect", "AlwaysCooperate", "GrimTrigger", "Pavlov", "SuspiciousTitForTat", "Random", "TitForTwoTats", "Gradual"];
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
