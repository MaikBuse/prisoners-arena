//! Prisoner's Arena Tournament Operator
//!
//! Automated bot that runs tournament lifecycle:
//! - Monitors registration deadline
//! - Closes registration → Reveal phase
//! - Waits for reveal deadline
//! - Forfeits unrevealed entries
//! - Closes reveal → Running
//! - Executes matches in batches
//! - Finalizes tournament and starts next one
//! - Cleans up expired entries after claim window

use anyhow::{Context, Result};
use clap::Parser;
use serde::Deserialize;
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{read_keypair_file, Keypair, Signer};
use solana_sdk::native_token::LAMPORTS_PER_SOL;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::time::Duration;
use tracing::{info, warn, error};

mod state;
mod actions;
mod db;

use state::TournamentState;

/// Minimum balance to keep running (0.1 SOL)
const MIN_BALANCE: u64 = LAMPORTS_PER_SOL / 10;

/// 30 days in seconds
const CLAIM_EXPIRY_SECONDS: i64 = 2_592_000;

// --- Config file structs (mirrors cli/src/config.rs, operator only needs network + wallets) ---

#[derive(Debug, Deserialize)]
struct ArenaConfig {
    network: NetworkConfig,
    wallets: WalletConfig,
}

#[derive(Debug, Deserialize)]
struct NetworkConfig {
    rpc_url: String,
    program_id: String,
}

#[derive(Debug, Deserialize)]
struct WalletConfig {
    operator: String,
}

impl ArenaConfig {
    fn load(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read config from {}", path.display()))?;
        toml::from_str(&content).with_context(|| format!("Failed to parse {}", path.display()))
    }
}

// --- CLI args (all optional when arena.toml provides defaults) ---

#[derive(Parser, Debug)]
#[command(name = "operator")]
#[command(about = "Prisoner's Arena Tournament Operator")]
struct Args {
    /// Path to config file
    #[arg(short, long, default_value = "arena.toml")]
    config: PathBuf,

    /// Solana RPC endpoint (overrides config file)
    #[arg(short, long)]
    rpc_url: Option<String>,

    /// Path to operator keypair (overrides config file)
    #[arg(short, long)]
    keypair: Option<PathBuf>,

    /// Program ID (overrides config file)
    #[arg(short, long)]
    program_id: Option<Pubkey>,

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
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("operator=info".parse()?)
        )
        .init();

    let args = Args::parse();

    // Load config file (non-fatal if missing, fatal only if no CLI overrides)
    let file_config = match ArenaConfig::load(&args.config) {
        Ok(cfg) => {
            info!("Loaded config from {}", args.config.display());
            Some(cfg)
        }
        Err(e) => {
            if args.config.as_os_str() != "arena.toml" {
                // Explicitly specified config file must exist
                return Err(e);
            }
            warn!("No arena.toml found, using CLI args only");
            None
        }
    };

    // Resolve values: CLI args override config file
    let rpc_url = args.rpc_url
        .or_else(|| file_config.as_ref().map(|c| c.network.rpc_url.clone()))
        .unwrap_or_else(|| "http://localhost:8899".to_string());

    let program_id = match args.program_id {
        Some(id) => id,
        None => {
            let id_str = file_config.as_ref()
                .map(|c| c.network.program_id.as_str())
                .ok_or_else(|| anyhow::anyhow!(
                    "No program_id provided. Pass --program-id or set it in arena.toml"
                ))?;
            Pubkey::from_str(id_str)
                .map_err(|e| anyhow::anyhow!("Invalid program_id in config: {}", e))?
        }
    };

    let keypair_path_raw = args.keypair
        .map(|p| p.to_string_lossy().to_string())
        .or_else(|| file_config.as_ref().map(|c| c.wallets.operator.clone()))
        .unwrap_or_else(|| "~/.config/solana/id.json".to_string());

    info!("Starting Prisoner's Arena Operator");
    info!("RPC: {}", rpc_url);
    info!("Program: {}", program_id);

    let keypair_path = shellexpand::tilde(&keypair_path_raw).to_string();
    let keypair = read_keypair_file(&keypair_path)
        .map_err(|e| anyhow::anyhow!("Failed to load keypair from {}: {}", keypair_path, e))?;

    info!("Operator wallet: {}", keypair.pubkey());

    if args.dry_run {
        warn!("DRY RUN MODE - no transactions will be sent");
    }

    let client = RpcClient::new_with_commitment(
        rpc_url,
        CommitmentConfig::confirmed(),
    );

    let db_path = args.config.parent().unwrap_or(Path::new(".")).join("operator.db");
    let db = db::open(&db_path)?;
    info!("Operator DB: {}", db_path.display());

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
        info!("Manual mode: running single cycle");
        match run_cycle(&client, &program_id, &keypair, args.dry_run, &db).await {
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
                    match run_cycle(&client, &program_id, &keypair, args.dry_run, &db).await {
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

    let poll_interval = Duration::from_secs(args.poll_interval);
    
    loop {
        match run_cycle(&client, &program_id, &keypair, args.dry_run, &db).await {
            Ok(_) => {}
            Err(e) => {
                let err_str = format!("{}", e);
                if is_state_conflict(&err_str) {
                    warn!("State conflict (stale RPC data), retrying in 3s...");
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    match run_cycle(&client, &program_id, &keypair, args.dry_run, &db).await {
                        Ok(_) => {}
                        Err(e2) => error!("Retry failed: {}", e2),
                    }
                } else {
                    error!("Cycle error: {}", e);
                }
            }
        }

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
    db: &rusqlite::Connection,
) -> Result<bool> {
    let config = state::fetch_config(client, program_id)?;
    
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
            
            if now >= tournament.registration_ends {
                if tournament.participant_count >= config.min_participants as u32 {
                    info!("Registration deadline passed with {} participants, closing → Reveal", tournament.participant_count);
                    if !dry_run {
                        actions::close_registration(client, program_id, &tournament, operator, &config)?;
                    }
                    return Ok(true);
                } else {
                    let needed = config.min_participants as u32 - tournament.participant_count;
                    info!(
                        "Deadline passed but only {} participants (need {}), waiting for {} more",
                        tournament.participant_count,
                        config.min_participants,
                        needed
                    );
                }
            }
        }

        TournamentState::Reveal => {
            let active_count = tournament.participant_count - tournament.forfeits;
            info!(
                "Tournament #{} in Reveal | {}/{} revealed | deadline in {}s",
                tournament.id,
                tournament.reveals_completed,
                active_count,
                tournament.reveal_ends.saturating_sub(now)
            );
            
            if now > tournament.reveal_ends {
                // Reveal deadline passed — forfeit unrevealed entries, then close reveal
                if tournament.reveals_completed < active_count {
                    info!("Assigning random strategies to unrevealed entries...");
                    if !dry_run {
                        let assigned = actions::forfeit_all_unrevealed(client, program_id, &tournament, operator)?;
                        info!("Assigned random strategies to {} entries", assigned);
                    }
                    return Ok(true);
                }

                // All unrevealed entries processed — close reveal
                info!("All unrevealed entries processed, closing reveal → Running");
                if !dry_run {
                    actions::close_reveal(client, program_id, &tournament, operator, &config)?;
                }
                return Ok(true);
            }
            // Else: still waiting for reveal deadline, nothing to do
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
            let all_winners_claimed = tournament.claims_processed >= tournament.winner_count;

            info!(
                "Tournament #{} in Payout | {}/{} claims | {} days since start{}{}",
                tournament.id,
                tournament.claims_processed,
                tournament.winner_count,
                time_since_payout / 86400,
                if expired { " [EXPIRED]" } else { "" },
                if all_winners_claimed { " [ALL CLAIMED]" } else { "" }
            );

            if expired || all_winners_claimed {
                if !dry_run {
                    let closed = actions::close_expired_entries(client, program_id, &tournament, operator)?;
                    if closed > 0 {
                        info!("Closed {} expired entries", closed);
                        return Ok(true);
                    }

                    match actions::close_tournament(client, program_id, &tournament, operator, &config) {
                        Ok(_) => {
                            info!("Tournament {} account closed, rent recovered", tournament.id);
                            return Ok(true);
                        }
                        Err(e) => {
                            warn!("Could not close tournament account: {}", e);
                        }
                    }
                }
            }
        }
    }

    // Check all past tournaments for Payout cleanup
    let program_id_str = program_id.to_string();
    for prev_id in (0..config.current_tournament_id).rev() {
        if db::is_closed(db, &program_id_str, prev_id) {
            continue;
        }

        match state::fetch_tournament(client, program_id, prev_id) {
            Ok(prev) if prev.state == TournamentState::Payout => {
                let time_since_payout = now - prev.payout_started_at;
                let expired = time_since_payout >= CLAIM_EXPIRY_SECONDS;
                let all_winners_claimed = prev.claims_processed >= prev.winner_count;

                info!(
                    "Past Tournament #{} in Payout | {}/{} claims | {} entries remaining | {} days{}{}",
                    prev.id, prev.claims_processed, prev.winner_count,
                    prev.entries_remaining, time_since_payout / 86400,
                    if expired { " [EXPIRED]" } else { "" },
                    if all_winners_claimed { " [ALL CLAIMED]" } else { "" }
                );

                if (expired || all_winners_claimed) && !dry_run {
                    let closed = actions::close_expired_entries(client, program_id, &prev, operator)?;
                    if closed > 0 {
                        info!("Closed {} expired entries from tournament #{}", closed, prev.id);
                        return Ok(true);
                    }

                    if prev.entries_remaining == 0 {
                        match actions::close_tournament(client, program_id, &prev, operator, &config) {
                            Ok(_) => {
                                info!("Tournament #{} account closed, rent recovered", prev.id);
                                db::mark_closed(db, &program_id_str, prev.id)?;
                                return Ok(true);
                            }
                            Err(e) => warn!("Could not close tournament #{}: {}", prev.id, e),
                        }
                    }
                }
            }
            Err(_) => {
                // Account doesn't exist — already closed on-chain, record it
                db::mark_closed(db, &program_id_str, prev_id)?;
            }
            _ => {} // Not in Payout (shouldn't happen for past tournaments)
        }
    }

    Ok(false)
}
