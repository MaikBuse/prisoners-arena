//! Tournament action handlers
//!
//! Builds and sends transactions for tournament lifecycle management.

use anyhow::{bail, Result};
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    sysvar,
    transaction::Transaction,
};
use solana_system_interface::program as system_program;
use tracing::{info, warn};

use crate::state::{self, Config, Tournament};

/// Number of matches to run per transaction
const MATCHES_PER_TX: u32 = 5;

/// Instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
mod discriminator {
    pub const CLOSE_REGISTRATION: [u8; 8] = [44, 118, 178, 58, 21, 125, 102, 138];
    pub const CLOSE_REVEAL: [u8; 8] = [178, 16, 118, 36, 7, 42, 184, 51];
    pub const FORFEIT_UNREVEALED: [u8; 8] = [106, 138, 130, 170, 105, 11, 59, 183];
    pub const RUN_MATCHES: [u8; 8] = [231, 195, 232, 182, 30, 237, 182, 246];
    pub const FINALIZE_TOURNAMENT: [u8; 8] = [205, 30, 149, 11, 108, 122, 120, 11];
    pub const CLOSE_ENTRY: [u8; 8] = [132, 26, 202, 145, 190, 37, 114, 67];
    pub const CLOSE_TOURNAMENT: [u8; 8] = [14, 80, 54, 9, 221, 239, 201, 35];
}

/// Close registration and transition to Reveal phase
pub fn close_registration(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    operator: &Keypair,
    _config: &Config,
) -> Result<()> {
    info!("Closing registration for tournament {}", tournament.id);
    
    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
    
    // v1.7: close_registration no longer needs slotHashes or refund accounts
    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new_readonly(operator.pubkey(), true),
        AccountMeta::new_readonly(system_program::id(), false),
    ];
    
    let instruction = Instruction {
        program_id: *program_id,
        accounts,
        data: discriminator::CLOSE_REGISTRATION.to_vec(),
    };
    
    send_transaction(client, &[instruction], operator)?;
    info!("Registration closed for tournament {} → Reveal phase", tournament.id);

    Ok(())
}

/// Forfeit an unrevealed entry after reveal deadline
pub fn forfeit_unrevealed(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    entry_player: &Pubkey,
    operator: &Keypair,
) -> Result<()> {
    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
    let (entry_pda, _) = state::get_entry_pda(program_id, &tournament_pda, entry_player);
    
    let accounts = vec![
        AccountMeta::new_readonly(config_pda, false),
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(operator.pubkey(), true),
    ];
    
    let instruction = Instruction {
        program_id: *program_id,
        accounts,
        data: discriminator::FORFEIT_UNREVEALED.to_vec(),
    };
    
    send_transaction(client, &[instruction], operator)?;
    info!("Assigned random strategy to unrevealed entry for player {}", entry_player);
    
    Ok(())
}

/// Forfeit all unrevealed entries for a tournament
pub fn forfeit_all_unrevealed(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    operator: &Keypair,
) -> Result<u32> {
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
    let mut assigned = 0u32;

    for player in &tournament.players {
        if *player == Pubkey::default() {
            continue; // Already refunded
        }

        // Check if entry exists and is unrevealed
        match state::fetch_entry(client, program_id, &tournament_pda, player) {
            Ok(entry) => {
                if !entry.revealed {
                    match forfeit_unrevealed(client, program_id, tournament, player, operator) {
                        Ok(_) => assigned += 1,
                        Err(e) => warn!("Failed to assign strategy for {}: {}", player, e),
                    }
                }
            }
            Err(_) => continue, // Entry doesn't exist
        }
    }

    Ok(assigned)
}

/// Close reveal phase and transition to Running
pub fn close_reveal(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    operator: &Keypair,
    _config: &Config,
) -> Result<()> {
    info!("Closing reveal phase for tournament {}", tournament.id);
    
    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
    
    // Check if we need to refund the last player (odd active count)
    let active_count = tournament.participant_count;
    let need_refund = active_count % 2 == 1 && active_count > 0;
    
    let mut accounts = vec![
        AccountMeta::new_readonly(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new_readonly(sysvar::slot_hashes::id(), false),
    ];
    
    if need_refund {
        let last_player = tournament.players.iter()
            .rposition(|pk| *pk != Pubkey::default())
            .map(|idx| tournament.players[idx]);
            
        if let Some(player) = last_player {
            let (entry_pda, _) = state::get_entry_pda(program_id, &tournament_pda, &player);
            accounts.push(AccountMeta::new(entry_pda, false));
            accounts.push(AccountMeta::new(player, false));
        } else {
            bail!("Need to refund but couldn't find last player");
        }
    } else {
        accounts.push(AccountMeta::new_readonly(*program_id, false));
        accounts.push(AccountMeta::new_readonly(*program_id, false));
    }
    
    accounts.push(AccountMeta::new_readonly(operator.pubkey(), true));
    accounts.push(AccountMeta::new_readonly(system_program::id(), false));
    
    let instruction = Instruction {
        program_id: *program_id,
        accounts,
        data: discriminator::CLOSE_REVEAL.to_vec(),
    };
    
    send_transaction(client, &[instruction], operator)?;
    info!("Reveal closed for tournament {} → Running", tournament.id);
    
    Ok(())
}

/// Run a batch of matches
pub fn run_matches(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    operator: &Keypair,
    _config: &Config,
) -> Result<()> {
    let matches_remaining = tournament.matches_total.saturating_sub(tournament.matches_completed);
    let matches_to_run = matches_remaining.min(MATCHES_PER_TX);
    
    if matches_to_run == 0 {
        info!("No matches remaining");
        return Ok(());
    }
    
    info!(
        "Running matches {}-{} of {}",
        tournament.matches_completed + 1,
        tournament.matches_completed + matches_to_run,
        tournament.matches_total
    );
    
    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
    
    let mut entry_accounts: Vec<AccountMeta> = Vec::new();
    let mut seen_entries: std::collections::HashSet<Pubkey> = std::collections::HashSet::new();
    
    let active_count = tournament.participant_count;
    
    for batch_idx in 0..matches_to_run {
        let match_index = tournament.matches_completed + batch_idx;
        
        let pairing = match_logic::get_pairing_for_match(
            active_count,
            tournament.matches_per_player,
            &tournament.randomness_seed,
            match_index,
        );
        
        if let Some((idx_a, idx_b)) = pairing {
            let player_a = tournament.players.get(idx_a as usize);
            let player_b = tournament.players.get(idx_b as usize);
            
            if let (Some(pk_a), Some(pk_b)) = (player_a, player_b) {
                if *pk_a == Pubkey::default() || *pk_b == Pubkey::default() {
                    continue;
                }
                
                let (entry_a, _) = state::get_entry_pda(program_id, &tournament_pda, pk_a);
                let (entry_b, _) = state::get_entry_pda(program_id, &tournament_pda, pk_b);
                
                if seen_entries.insert(entry_a) {
                    entry_accounts.push(AccountMeta::new(entry_a, false));
                }
                if seen_entries.insert(entry_b) {
                    entry_accounts.push(AccountMeta::new(entry_b, false));
                }
            }
        }
    }
    
    let mut accounts = vec![
        AccountMeta::new_readonly(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new_readonly(operator.pubkey(), true),
    ];
    accounts.extend(entry_accounts);
    
    let instruction = Instruction {
        program_id: *program_id,
        accounts,
        data: discriminator::RUN_MATCHES.to_vec(),
    };
    
    send_transaction(client, &[instruction], operator)?;
    info!("Completed match batch");
    
    Ok(())
}

/// Finalize tournament and create next one
pub fn finalize_tournament(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    operator: &Keypair,
    config: &Config,
) -> Result<()> {
    info!("Finalizing tournament {}", tournament.id);
    
    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
    let (next_tournament_pda, _) = state::get_tournament_pda(program_id, config.current_tournament_id + 1);
    
    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(next_tournament_pda, false),
        AccountMeta::new(operator.pubkey(), true),
        AccountMeta::new_readonly(system_program::id(), false),
    ];
    
    let instruction = Instruction {
        program_id: *program_id,
        accounts,
        data: discriminator::FINALIZE_TOURNAMENT.to_vec(),
    };
    
    send_transaction(client, &[instruction], operator)?;
    info!("Tournament {} finalized, next tournament created", tournament.id);
    
    Ok(())
}

/// Close entry accounts — distributes payouts and returns rent to players
pub fn close_entries(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    operator: &Keypair,
) -> Result<u32> {
    info!("Closing entries for tournament {}", tournament.id);

    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);

    let mut closed = 0u32;

    for player in &tournament.players {
        if *player == Pubkey::default() {
            continue;
        }

        let (entry_pda, _) = state::get_entry_pda(program_id, &tournament_pda, player);

        if client.get_account(&entry_pda).is_err() {
            continue;
        }

        let accounts = vec![
            AccountMeta::new(config_pda, false),
            AccountMeta::new(tournament_pda, false),
            AccountMeta::new(entry_pda, false),
            AccountMeta::new(*player, false),
            AccountMeta::new(operator.pubkey(), true),
        ];

        let instruction = Instruction {
            program_id: *program_id,
            accounts,
            data: discriminator::CLOSE_ENTRY.to_vec(),
        };

        match send_transaction(client, &[instruction], operator) {
            Ok(_) => {
                info!("Closed entry for {}", player);
                closed += 1;
            }
            Err(e) => warn!("Failed to close entry for {}: {}", player, e),
        }
    }

    Ok(closed)
}

/// Close a tournament account and recover rent lamports
pub fn close_tournament(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    operator: &Keypair,
    _config: &Config,
) -> Result<()> {
    info!("Closing tournament {} account to recover rent", tournament.id);
    
    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
    
    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new_readonly(operator.pubkey(), true),
    ];
    
    let instruction = Instruction {
        program_id: *program_id,
        accounts,
        data: discriminator::CLOSE_TOURNAMENT.to_vec(),
    };
    
    send_transaction(client, &[instruction], operator)?;
    info!("Tournament {} account closed, rent recovered", tournament.id);
    
    Ok(())
}

/// Send a transaction with retry logic
fn send_transaction(
    client: &RpcClient,
    instructions: &[Instruction],
    signer: &Keypair,
) -> Result<()> {
    let recent_blockhash = client.get_latest_blockhash()?;
    
    let transaction = Transaction::new_signed_with_payer(
        instructions,
        Some(&signer.pubkey()),
        &[signer],
        recent_blockhash,
    );
    
    let signature = client.send_and_confirm_transaction_with_spinner_and_commitment(
        &transaction,
        CommitmentConfig::confirmed(),
    )?;
    
    info!("Transaction confirmed: {}", signature);
    
    Ok(())
}

/// Check operator wallet balance
pub fn check_balance(client: &RpcClient, operator: &Pubkey) -> Result<u64> {
    let balance = client.get_balance(operator)?;
    Ok(balance)
}

/// Shared HTTP client for pre-cache requests (avoids rebuilding connection pools).
fn http_client() -> &'static reqwest::Client {
    static CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();
    CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .unwrap_or_default()
    })
}

/// Fire-and-forget HTTP GET to pre-cache a tournament in the web API's SQLite
/// before the operator closes entry/tournament accounts on-chain.
pub async fn pre_cache_tournament(web_url: &str, tournament_id: u32) {
    let url = format!("{}/api/tournament/{}", web_url.trim_end_matches('/'), tournament_id);
    info!("Pre-caching tournament {} via {}", tournament_id, url);
    match http_client().get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            info!("Pre-cache OK for tournament {}", tournament_id);
        }
        Ok(resp) => {
            warn!("Pre-cache returned {} for tournament {}", resp.status(), tournament_id);
        }
        Err(e) => {
            warn!("Pre-cache failed for tournament {}: {}", tournament_id, e);
        }
    }
}
