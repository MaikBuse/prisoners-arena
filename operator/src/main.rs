//! Dilemma Arena Tournament Operator
//!
//! Automated bot that runs tournament lifecycle:
//! - Monitors registration deadline
//! - Closes registration and starts matches
//! - Executes matches in batches
//! - Finalizes tournament and starts next one
//! - Cleans up expired entries after claim window

use anyhow::Result;
use clap::Parser;
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{read_keypair_file, Keypair, Signer};
use solana_sdk::native_token::LAMPORTS_PER_SOL;
use std::path::PathBuf;
use std::time::Duration;
use tracing::{info, warn, error};

mod state;
mod actions;

use state::TournamentState;

/// Minimum balance to keep running (0.1 SOL)
const MIN_BALANCE: u64 = LAMPORTS_PER_SOL / 10;

/// 30 days in seconds
const CLAIM_EXPIRY_SECONDS: i64 = 2_592_000;

#[derive(Parser, Debug)]
#[command(name = "operator")]
#[command(about = "Dilemma Arena Tournament Operator")]
struct Args {
    /// Solana RPC endpoint
    #[arg(short, long, default_value = "http://localhost:8899")]
    rpc_url: String,

    /// Path to operator keypair
    #[arg(short, long, default_value = "~/.config/solana/id.json")]
    keypair: PathBuf,

    /// Program ID
    #[arg(short, long)]
    program_id: Pubkey,

    /// Poll interval in seconds
    #[arg(long, default_value = "5")]
    poll_interval: u64,

    /// Dry run mode (don't send transactions)
    #[arg(long, default_value = "false")]
    dry_run: bool,

    /// Manual mode: run a single cycle then exit
    /// Exit codes: 0 = action taken, 1 = nothing to do, 2 = error
    #[arg(long)]
    manual: bool,
}

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("operator=info".parse()?)
        )
        .init();

    let args = Args::parse();

    info!("Starting Dilemma Arena Operator");
    info!("RPC: {}", args.rpc_url);
    info!("Program: {}", args.program_id);

    // Load keypair
    let keypair_path = shellexpand::tilde(&args.keypair.to_string_lossy()).to_string();
    let keypair = read_keypair_file(&keypair_path)
        .map_err(|e| anyhow::anyhow!("Failed to load keypair: {}", e))?;

    info!("Operator wallet: {}", keypair.pubkey());

    if args.dry_run {
        warn!("DRY RUN MODE - no transactions will be sent");
    }

    // Create RPC client
    let client = RpcClient::new(args.rpc_url.clone());

    // Check initial balance
    let balance = actions::check_balance(&client, &keypair.pubkey())?;
    info!("Operator balance: {} SOL", balance as f64 / LAMPORTS_PER_SOL as f64);
    
    if balance < MIN_BALANCE {
        error!(
            "Insufficient balance! Need at least {} SOL",
            MIN_BALANCE as f64 / LAMPORTS_PER_SOL as f64
        );
        return Ok(());
    }

    if args.manual {
        // Manual mode: single cycle, then exit with appropriate code
        info!("Manual mode: running single cycle");
        match run_cycle(&client, &args.program_id, &keypair, args.dry_run).await {
            Ok(action_taken) => {
                if action_taken {
                    info!("Action taken, exiting");
                    std::process::exit(0);
                } else {
                    info!("Nothing to do, exiting");
                    std::process::exit(1);
                }
            }
            Err(e) => {
                let err_str = format!("{}", e);
                if is_state_conflict(&err_str) {
                    warn!("State conflict, retrying in 3s...");
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    match run_cycle(&client, &args.program_id, &keypair, args.dry_run).await {
                        Ok(action_taken) => {
                            std::process::exit(if action_taken { 0 } else { 1 });
                        }
                        Err(e2) => {
                            error!("Retry failed: {}", e2);
                            std::process::exit(2);
                        }
                    }
                } else {
                    error!("Cycle error: {}", e);
                    std::process::exit(2);
                }
            }
        }
    }

    // Continuous loop mode
    let poll_interval = Duration::from_secs(args.poll_interval);
    
    loop {
        match run_cycle(&client, &args.program_id, &keypair, args.dry_run).await {
            Ok(_) => {}
            Err(e) => {
                let err_str = format!("{}", e);
                if is_state_conflict(&err_str) {
                    warn!("State conflict (stale RPC data), retrying in 3s...");
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    // Retry once immediately after wait
                    match run_cycle(&client, &args.program_id, &keypair, args.dry_run).await {
                        Ok(_) => {}
                        Err(e2) => error!("Retry failed: {}", e2),
                    }
                } else {
                    error!("Cycle error: {}", e);
                }
            }
        }

        // Check balance periodically
        if let Ok(balance) = actions::check_balance(&client, &keypair.pubkey()) {
            if balance < MIN_BALANCE {
                warn!(
                    "Low balance: {} SOL - please top up operator wallet",
                    balance as f64 / LAMPORTS_PER_SOL as f64
                );
            }
        }

        tokio::time::sleep(poll_interval).await;
    }
}

/// Check if an error is a state conflict (InvalidState = error 6000, or stale data)
fn is_state_conflict(err: &str) -> bool {
    err.contains("0x1770") // 6000 in hex = InvalidState
        || err.contains("InvalidState")
        || err.contains("custom program error: 0x1770")
}

/// Returns Ok(true) if an action was taken, Ok(false) if nothing to do
async fn run_cycle(
    client: &RpcClient,
    program_id: &Pubkey,
    operator: &Keypair,
    dry_run: bool,
) -> Result<bool> {
    // Fetch current state
    let config = state::fetch_config(client, program_id)?;
    
    // Verify we're the operator
    if config.operator != operator.pubkey() {
        error!(
            "This wallet is not the operator! Expected: {}, Got: {}",
            config.operator,
            operator.pubkey()
        );
        return Ok(false);
    }
    
    let tournament = state::fetch_current_tournament(client, program_id)?;
    
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    match tournament.state {
        TournamentState::Registration => {
            info!(
                "Tournament #{} in Registration | {} participants | deadline in {}s",
                tournament.id,
                tournament.participant_count,
                tournament.registration_ends.saturating_sub(now)
            );
            
            // Check if deadline passed
            if now >= tournament.registration_ends {
                if tournament.participant_count >= config.min_participants as u32 {
                    info!("Registration deadline passed with {} participants, closing", tournament.participant_count);
                    if !dry_run {
                        actions::close_registration(client, program_id, &tournament, operator, &config)?;
                    }
                    return Ok(true);
                } else {
                    // Deadline passed but minimum not met - deadline will be extended by contract
                    info!(
                        "Deadline passed but only {} participants (need {}), extending deadline",
                        tournament.participant_count,
                        config.min_participants
                    );
                    if !dry_run {
                        // Call close_registration anyway - contract will extend deadline
                        actions::close_registration(client, program_id, &tournament, operator, &config)?;
                    }
                    return Ok(true);
                }
            }
        }

        TournamentState::Running => {
            info!(
                "Tournament #{} Running | {}/{} matches complete",
                tournament.id,
                tournament.matches_completed,
                tournament.matches_total
            );
            
            if tournament.matches_completed < tournament.matches_total {
                if !dry_run {
                    actions::run_matches(client, program_id, &tournament, operator, &config)?;
                }
                return Ok(true);
            } else {
                info!("All matches complete, finalizing tournament");
                if !dry_run {
                    actions::finalize_tournament(client, program_id, &tournament, operator, &config)?;
                }
                return Ok(true);
            }
        }

        TournamentState::Payout => {
            let time_since_payout = now - tournament.payout_started_at;
            let expired = time_since_payout >= CLAIM_EXPIRY_SECONDS;
            
            info!(
                "Tournament #{} in Payout | {}/{} claims | {} days since start{}",
                tournament.id,
                tournament.claims_processed,
                tournament.winner_count,
                time_since_payout / 86400,
                if expired { " [EXPIRED]" } else { "" }
            );
            
            if expired {
                // Clean up expired entries
                if !dry_run {
                    let closed = actions::close_expired_entries(client, program_id, &tournament, operator)?;
                    if closed > 0 {
                        info!("Closed {} expired entries", closed);
                        return Ok(true);
                    }
                    
                    // All entries closed — close the tournament account itself
                    match actions::close_tournament(client, program_id, &tournament, operator, &config) {
                        Ok(_) => {
                            info!("Tournament {} account closed, rent recovered", tournament.id);
                            return Ok(true);
                        }
                        Err(e) => {
                            // May fail if entries still exist (closed by someone else this cycle)
                            warn!("Could not close tournament account: {}", e);
                        }
                    }
                }
            }
            
            // Note: Winners claim their own payouts via claim_payout instruction
            // Operator just monitors and cleans up after expiry
        }
    }

    Ok(false)
}
