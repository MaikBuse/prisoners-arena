//! Wallet management for simulated players.
//!
//! Generates, loads, funds, and reclaims SOL from player keypairs.

use anyhow::{Context, Result};
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    native_token::LAMPORTS_PER_SOL,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::Transaction,
};
use solana_system_interface::program as system_program;
use std::path::Path;
use std::time::Duration;
use tracing::{info, warn};

/// Build a system program transfer instruction
fn transfer_instruction(from: &Pubkey, to: &Pubkey, lamports: u64) -> Instruction {
    // system_program Transfer instruction index = 2
    // Data layout: u32 instruction index (2) + u64 lamports
    let mut data = vec![2, 0, 0, 0]; // Transfer = index 2, little-endian u32
    data.extend_from_slice(&lamports.to_le_bytes());

    Instruction {
        program_id: system_program::id(),
        accounts: vec![AccountMeta::new(*from, true), AccountMeta::new(*to, false)],
        data,
    }
}

/// Initialize player keypairs: load existing ones from disk or generate new ones.
///
/// Keypairs are stored as JSON arrays of bytes (same format as solana-keygen).
pub fn init_players(wallet_dir: &str, count: usize) -> Result<Vec<Keypair>> {
    let dir = Path::new(wallet_dir);
    std::fs::create_dir_all(dir)
        .with_context(|| format!("Failed to create wallet directory: {}", wallet_dir))?;

    let mut players = Vec::with_capacity(count);

    for i in 0..count {
        let filename = format!("player_{}.json", i);
        let path = dir.join(&filename);

        let keypair = if path.exists() {
            solana_sdk::signature::read_keypair_file(&path)
                .map_err(|e| anyhow::anyhow!("Invalid keypair in {}: {}", path.display(), e))?
        } else {
            let kp = Keypair::new();
            let bytes = kp.to_bytes().to_vec();
            let json = serde_json::to_string(&bytes)?;
            std::fs::write(&path, json)
                .with_context(|| format!("Failed to write {}", path.display()))?;
            info!(
                "Generated new player keypair: {} -> {}",
                kp.pubkey(),
                path.display()
            );
            kp
        };

        players.push(keypair);
    }

    Ok(players)
}

/// Ensure all players have at least `min_balance` lamports, topping up from funder if needed.
pub fn ensure_funded(
    client: &RpcClient,
    funder: &Keypair,
    players: &[Keypair],
    min_balance: u64,
    topup_amount: u64,
    tx_delay: Duration,
) -> Result<()> {
    for player in players {
        let balance = client.get_balance(&player.pubkey()).unwrap_or(0);

        if balance < min_balance {
            let deficit = topup_amount.saturating_sub(balance);
            if deficit == 0 {
                continue;
            }

            info!(
                "Funding player {} with {} SOL (balance: {} SOL)",
                player.pubkey(),
                deficit as f64 / LAMPORTS_PER_SOL as f64,
                balance as f64 / LAMPORTS_PER_SOL as f64,
            );

            let ix = transfer_instruction(&funder.pubkey(), &player.pubkey(), deficit);
            let recent_blockhash = client.get_latest_blockhash()?;
            let tx = Transaction::new_signed_with_payer(
                &[ix],
                Some(&funder.pubkey()),
                &[funder],
                recent_blockhash,
            );
            client.send_and_confirm_transaction_with_spinner_and_commitment(
                &tx,
                CommitmentConfig::confirmed(),
            )?;

            std::thread::sleep(tx_delay);
        }
    }

    Ok(())
}

/// Reclaim excess SOL from a player back to the funder, leaving `leave_amount` for rent.
pub fn reclaim_funds(
    client: &RpcClient,
    player: &Keypair,
    funder_pubkey: &Pubkey,
    leave_amount: u64,
) -> Result<()> {
    let balance = client.get_balance(&player.pubkey()).unwrap_or(0);

    // Need to leave enough for rent + tx fee
    let fee_reserve = 5000; // lamports for tx fee
    let keep = leave_amount + fee_reserve;

    if balance <= keep {
        return Ok(());
    }

    let send_amount = balance - keep;

    info!(
        "Reclaiming {} SOL from player {} -> funder",
        send_amount as f64 / LAMPORTS_PER_SOL as f64,
        player.pubkey(),
    );

    let ix = transfer_instruction(&player.pubkey(), funder_pubkey, send_amount);
    let recent_blockhash = client.get_latest_blockhash()?;
    let tx = Transaction::new_signed_with_payer(
        &[ix],
        Some(&player.pubkey()),
        &[player],
        recent_blockhash,
    );
    match client.send_and_confirm_transaction_with_spinner_and_commitment(
        &tx,
        CommitmentConfig::confirmed(),
    ) {
        Ok(_) => {}
        Err(e) => warn!("Failed to reclaim from {}: {}", player.pubkey(), e),
    }

    Ok(())
}
