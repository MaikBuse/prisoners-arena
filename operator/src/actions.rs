//! Tournament action handlers
//!
//! Builds and sends transactions for tournament lifecycle management.

use anyhow::{bail, Result};
use solana_client::rpc_client::RpcClient;
use solana_sdk::{
    commitment_config::CommitmentConfig,
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    system_program,
    sysvar,
    transaction::Transaction,
};
use tracing::{info, warn};

use crate::state::{self, Config, Tournament, TournamentState};

/// Number of matches to run per transaction
const MATCHES_PER_TX: u32 = 5;

/// Instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
mod discriminator {
    pub const CLOSE_REGISTRATION: [u8; 8] = [44, 118, 178, 58, 21, 125, 102, 138];
    pub const RUN_MATCHES: [u8; 8] = [231, 195, 232, 182, 30, 237, 182, 246];
    pub const FINALIZE_TOURNAMENT: [u8; 8] = [205, 30, 149, 11, 108, 122, 120, 11];
    pub const CLOSE_EXPIRED_ENTRY: [u8; 8] = [241, 64, 198, 246, 182, 114, 87, 149];
}

/// Close registration and transition to Running state
pub fn close_registration(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    operator: &Keypair,
    config: &Config,
) -> Result<()> {
    info!("Closing registration for tournament {}", tournament.id);
    
    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
    
    // Check if we need to refund the last player (odd count)
    let need_refund = tournament.participant_count % 2 == 1 && tournament.participant_count >= config.min_participants as u32;
    
    let mut accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new_readonly(sysvar::slot_hashes::id(), false),
    ];
    
    // Add refund accounts if needed
    if need_refund {
        // Find the last non-refunded player
        let last_player = tournament.players.iter()
            .rposition(|pk| *pk != Pubkey::default())
            .map(|idx| tournament.players[idx]);
            
        if let Some(player) = last_player {
            let (entry_pda, _) = state::get_entry_pda(program_id, &tournament_pda, &player);
            accounts.push(AccountMeta::new(entry_pda, false)); // refund_entry
            accounts.push(AccountMeta::new(player, false)); // refund_player
        } else {
            bail!("Need to refund but couldn't find last player");
        }
    } else {
        // Pass program ID for optional None accounts (Anchor convention)
        accounts.push(AccountMeta::new_readonly(*program_id, false)); // refund_entry = None
        accounts.push(AccountMeta::new_readonly(*program_id, false)); // refund_player = None
    }
    
    accounts.push(AccountMeta::new_readonly(operator.pubkey(), true)); // operator (signer)
    accounts.push(AccountMeta::new_readonly(system_program::id(), false));
    
    let instruction = Instruction {
        program_id: *program_id,
        accounts,
        data: discriminator::CLOSE_REGISTRATION.to_vec(),
    };
    
    send_transaction(client, &[instruction], operator)?;
    info!("Registration closed for tournament {}", tournament.id);
    
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
    
    // Collect entry accounts for this batch
    let mut entry_accounts: Vec<AccountMeta> = Vec::new();
    let mut seen_entries: std::collections::HashSet<Pubkey> = std::collections::HashSet::new();
    
    for batch_idx in 0..matches_to_run {
        let match_index = tournament.matches_completed + batch_idx;
        
        let pairing = match_logic::get_pairing_for_match(
            tournament.participant_count,
            tournament.matches_per_player,
            &tournament.randomness_seed,
            match_index,
        );
        
        if let Some((idx_a, idx_b)) = pairing {
            // Get players from tournament
            let player_a = tournament.players.get(idx_a as usize);
            let player_b = tournament.players.get(idx_b as usize);
            
            if let (Some(pk_a), Some(pk_b)) = (player_a, player_b) {
                // Skip if either player refunded
                if *pk_a == Pubkey::default() || *pk_b == Pubkey::default() {
                    continue;
                }
                
                // Add entry accounts (deduplicated)
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
    
    // Build accounts list
    let mut accounts = vec![
        AccountMeta::new_readonly(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new_readonly(operator.pubkey(), true),
    ];
    
    // Add entry accounts as remaining_accounts
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
        AccountMeta::new(next_tournament_pda, false), // next_tournament (init)
        AccountMeta::new(operator.pubkey(), true), // operator (signer, payer)
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

/// Close expired entry accounts after 30-day claim window
pub fn close_expired_entries(
    client: &RpcClient,
    program_id: &Pubkey,
    tournament: &Tournament,
    operator: &Keypair,
) -> Result<u32> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;
    
    const CLAIM_EXPIRY_SECONDS: i64 = 2_592_000; // 30 days
    
    if now < tournament.payout_started_at + CLAIM_EXPIRY_SECONDS {
        return Ok(0); // Not expired yet
    }
    
    info!("Closing expired entries for tournament {}", tournament.id);
    
    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
    
    let mut closed = 0u32;
    
    for player in &tournament.players {
        if *player == Pubkey::default() {
            continue; // Skip refunded
        }
        
        let (entry_pda, _) = state::get_entry_pda(program_id, &tournament_pda, player);
        
        // Check if entry still exists
        match client.get_account(&entry_pda) {
            Ok(_) => {
                // Entry exists, close it
                let accounts = vec![
                    AccountMeta::new(config_pda, false),
                    AccountMeta::new(tournament_pda, false),
                    AccountMeta::new(entry_pda, false),
                    AccountMeta::new(operator.pubkey(), true),
                ];
                
                let instruction = Instruction {
                    program_id: *program_id,
                    accounts,
                    data: discriminator::CLOSE_EXPIRED_ENTRY.to_vec(),
                };
                
                match send_transaction(client, &[instruction], operator) {
                    Ok(_) => {
                        info!("Closed expired entry for {}", player);
                        closed += 1;
                    }
                    Err(e) => {
                        warn!("Failed to close entry for {}: {}", player, e);
                    }
                }
            }
            Err(_) => {
                // Entry already closed
            }
        }
    }
    
    Ok(closed)
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
    
    // Send with confirmation
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
