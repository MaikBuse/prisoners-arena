//! Prisoner's Arena Tournament Simulator
//!
//! Populates devnet tournaments with simulated players:
//! - Enters N players during Registration
//! - Reveals strategies during Reveal phase
//! - Claims payouts for winners during Payout phase
//! - Recycles funds back to funder wallet

use anyhow::Result;
use clap::Parser;
use rand::Rng;
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::{
    native_token::LAMPORTS_PER_SOL, pubkey::Pubkey, signature::Keypair, signer::Signer,
};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::time::Duration;
use tracing::{error, info, warn};

mod config;
mod player;
mod state;
mod wallet;

use state::TournamentState;

/// Per-player reveal data kept in memory between Registration and Reveal phases.
struct RevealData {
    strategy_id: u8,
    salt: [u8; 16],
}

/// Tracks simulator state for a single tournament.
struct TournamentTracker {
    entered: HashMap<Pubkey, RevealData>,
    revealed: HashSet<Pubkey>,
    claimed: HashSet<Pubkey>,
}

impl TournamentTracker {
    fn new() -> Self {
        Self {
            entered: HashMap::new(),
            revealed: HashSet::new(),
            claimed: HashSet::new(),
        }
    }
}

#[derive(Parser, Debug)]
#[command(name = "simulator")]
#[command(about = "Prisoner's Arena Tournament Simulator")]
struct Args {
    /// Path to config file
    #[arg(short, long, default_value = "arena.toml")]
    config: PathBuf,

    /// Dry run mode (don't send transactions)
    #[arg(long, default_value = "false")]
    dry_run: bool,

    /// Poll interval in seconds
    #[arg(long, default_value = "10")]
    poll_interval: u64,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("simulator=info".parse()?),
        )
        .init();

    let args = Args::parse();

    let cfg = config::ArenaConfig::load(&args.config)?;
    info!("Loaded config from {}", args.config.display());

    let program_id = cfg.program_id()?;
    let funder = cfg.load_funder()?;
    let allowed_strategies = cfg.allowed_strategies();

    info!("RPC: {}", cfg.network.rpc_url);
    info!("Program: {}", program_id);
    info!("Funder: {}", funder.pubkey());
    info!("Player count: {}", cfg.simulator.player_count);
    info!("Strategies: {:?}", allowed_strategies);

    if args.dry_run {
        warn!("DRY RUN MODE — no transactions will be sent");
    }

    let client =
        RpcClient::new_with_commitment(&cfg.network.rpc_url, CommitmentConfig::confirmed());

    // Check funder balance
    let funder_balance = client.get_balance(&funder.pubkey())?;
    info!(
        "Funder balance: {} SOL",
        funder_balance as f64 / LAMPORTS_PER_SOL as f64
    );

    // Initialize player wallets
    let wallet_dir = shellexpand::tilde(&cfg.simulator.wallet_dir).to_string();
    let players = wallet::init_players(&wallet_dir, cfg.simulator.player_count)?;
    for (i, p) in players.iter().enumerate() {
        info!("Player {}: {}", i, p.pubkey());
    }

    let tx_delay = Duration::from_millis(cfg.simulator.tx_delay_ms);
    let poll_interval = Duration::from_secs(args.poll_interval);

    // In-memory state tracking across tournaments
    let mut trackers: HashMap<u32, TournamentTracker> = HashMap::new();

    loop {
        match run_cycle(
            &client,
            &program_id,
            &funder,
            &players,
            &allowed_strategies,
            &cfg,
            &mut trackers,
            tx_delay,
            args.dry_run,
        ) {
            Ok(_) => {}
            Err(e) => {
                let err_str = format!("{}", e);
                if is_state_conflict(&err_str) {
                    warn!("State conflict (stale RPC data), retrying in 3s...");
                    tokio::time::sleep(Duration::from_secs(3)).await;
                    if let Err(e2) = run_cycle(
                        &client,
                        &program_id,
                        &funder,
                        &players,
                        &allowed_strategies,
                        &cfg,
                        &mut trackers,
                        tx_delay,
                        args.dry_run,
                    ) {
                        error!("Retry failed: {}", e2);
                    }
                } else {
                    error!("Cycle error: {}", e);
                }
            }
        }

        tokio::time::sleep(poll_interval).await;
    }
}

fn is_state_conflict(err: &str) -> bool {
    err.contains("0x1770") || err.contains("InvalidState")
}

#[allow(clippy::too_many_arguments)]
fn run_cycle(
    client: &RpcClient,
    program_id: &Pubkey,
    funder: &Keypair,
    players: &[Keypair],
    allowed_strategies: &[u8],
    cfg: &config::ArenaConfig,
    trackers: &mut HashMap<u32, TournamentTracker>,
    tx_delay: Duration,
    dry_run: bool,
) -> Result<()> {
    let on_chain_config = state::fetch_config(client, program_id)?;
    let tournament = state::fetch_current_tournament(client, program_id)?;
    let tid = tournament.id;

    // Ensure tracker exists for this tournament
    trackers.entry(tid).or_insert_with(TournamentTracker::new);

    match tournament.state {
        TournamentState::Registration => {
            handle_registration(
                client,
                program_id,
                funder,
                players,
                allowed_strategies,
                cfg,
                trackers.get_mut(&tid).unwrap(),
                &tournament,
                tx_delay,
                dry_run,
            )?;
        }

        TournamentState::Reveal => {
            handle_reveal(
                client,
                program_id,
                players,
                trackers.get_mut(&tid).unwrap(),
                &tournament,
                tx_delay,
                dry_run,
            )?;
        }

        TournamentState::Running => {
            info!(
                "Tournament #{} Running | {}/{} matches — waiting for operator",
                tid, tournament.matches_completed, tournament.matches_total
            );
        }

        TournamentState::Payout => {
            handle_payout(
                client,
                program_id,
                funder,
                players,
                trackers.get_mut(&tid).unwrap(),
                &tournament,
                tx_delay,
                dry_run,
            )?;

            // Prune old trackers (keep current and previous)
            let min_keep = on_chain_config.current_tournament_id.saturating_sub(1);
            trackers.retain(|&k, _| k >= min_keep);
        }
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn handle_registration(
    client: &RpcClient,
    program_id: &Pubkey,
    funder: &Keypair,
    players: &[Keypair],
    allowed_strategies: &[u8],
    cfg: &config::ArenaConfig,
    tracker: &mut TournamentTracker,
    tournament: &state::Tournament,
    tx_delay: Duration,
    dry_run: bool,
) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    info!(
        "Tournament #{} Registration | {} participants | deadline in {}s",
        tournament.id,
        tournament.participant_count,
        tournament.registration_ends.saturating_sub(now)
    );

    // Ensure players are funded before entering
    if !dry_run {
        wallet::ensure_funded(
            client,
            funder,
            players,
            cfg.simulator.min_player_balance,
            cfg.simulator.topup_amount,
            tx_delay,
        )?;
    }

    for p in players {
        let pk = p.pubkey();

        if tracker.entered.contains_key(&pk) {
            continue;
        }

        // Check if already entered on-chain (handles restarts)
        let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);
        if state::fetch_entry(client, program_id, &tournament_pda, &pk).is_ok() {
            info!(
                "Player {} already entered tournament #{} (on-chain), tracking",
                pk, tournament.id
            );
            // We don't have the reveal data, so we can't reveal — mark as entered with dummy data
            // The operator will forfeit this player if we can't reveal
            tracker.entered.insert(
                pk,
                RevealData {
                    strategy_id: 0,
                    salt: [0u8; 16],
                },
            );
            tracker.revealed.insert(pk); // Can't reveal without real data
            continue;
        }

        // Pick a random strategy
        let mut rng = rand::thread_rng();
        let strategy_id = allowed_strategies[rng.gen_range(0..allowed_strategies.len())];
        let salt: [u8; 16] = rng.gen();
        let commitment = player::compute_commitment(strategy_id, &salt);

        info!(
            "Entering player {} into tournament #{} with strategy {}",
            pk, tournament.id, strategy_id
        );

        if dry_run {
            tracker.entered.insert(pk, RevealData { strategy_id, salt });
            continue;
        }

        match player::enter_tournament(client, program_id, p, tournament.id, &commitment) {
            Ok(sig) => {
                info!("Player {} entered: {}", pk, sig);
                tracker.entered.insert(pk, RevealData { strategy_id, salt });
            }
            Err(e) => {
                let err_str = format!("{}", e);
                if err_str.contains("AlreadyEntered") || err_str.contains("0x1775") {
                    info!(
                        "Player {} already entered (on-chain conflict), skipping",
                        pk
                    );
                    tracker.entered.insert(pk, RevealData { strategy_id, salt });
                } else {
                    warn!("Failed to enter player {}: {}", pk, e);
                }
            }
        }

        std::thread::sleep(tx_delay);
    }

    Ok(())
}

fn handle_reveal(
    client: &RpcClient,
    program_id: &Pubkey,
    players: &[Keypair],
    tracker: &mut TournamentTracker,
    tournament: &state::Tournament,
    tx_delay: Duration,
    dry_run: bool,
) -> Result<()> {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_secs() as i64;

    info!(
        "Tournament #{} Reveal | {}/{} revealed | deadline in {}s",
        tournament.id,
        tournament.reveals_completed,
        tournament.participant_count,
        tournament.reveal_ends.saturating_sub(now)
    );

    for p in players {
        let pk = p.pubkey();

        if tracker.revealed.contains(&pk) {
            continue;
        }

        let reveal_data = match tracker.entered.get(&pk) {
            Some(rd) => rd,
            None => continue, // Not entered in this tournament
        };

        info!(
            "Revealing strategy {} for player {} in tournament #{}",
            reveal_data.strategy_id, pk, tournament.id
        );

        if dry_run {
            tracker.revealed.insert(pk);
            continue;
        }

        match player::reveal_strategy(
            client,
            program_id,
            p,
            tournament.id,
            reveal_data.strategy_id,
            &reveal_data.salt,
        ) {
            Ok(sig) => {
                info!("Player {} revealed: {}", pk, sig);
                tracker.revealed.insert(pk);
            }
            Err(e) => {
                let err_str = format!("{}", e);
                if err_str.contains("AlreadyRevealed") || err_str.contains("0x1779") {
                    info!("Player {} already revealed (on-chain), marking", pk);
                    tracker.revealed.insert(pk);
                } else {
                    warn!("Failed to reveal for player {}: {}", pk, e);
                }
            }
        }

        std::thread::sleep(tx_delay);
    }

    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn handle_payout(
    client: &RpcClient,
    program_id: &Pubkey,
    funder: &Keypair,
    players: &[Keypair],
    tracker: &mut TournamentTracker,
    tournament: &state::Tournament,
    tx_delay: Duration,
    dry_run: bool,
) -> Result<()> {
    info!(
        "Tournament #{} Payout | {}/{} claims | {} entries remaining",
        tournament.id,
        tournament.claims_processed,
        tournament.winner_count,
        tournament.entries_remaining,
    );

    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament.id);

    for p in players {
        let pk = p.pubkey();

        if tracker.claimed.contains(&pk) {
            continue;
        }

        if !tracker.entered.contains_key(&pk) {
            continue; // Not entered in this tournament
        }

        // Fetch entry to check if winner
        let entry = match state::fetch_entry(client, program_id, &tournament_pda, &pk) {
            Ok(e) => e,
            Err(_) => {
                // Entry doesn't exist (already closed or never entered)
                tracker.claimed.insert(pk);
                continue;
            }
        };

        if entry.paid_out {
            info!("Player {} already paid out, skipping", pk);
            tracker.claimed.insert(pk);
            continue;
        }

        // Check if this player is a winner
        if tournament.min_winning_score > 0 && entry.score >= tournament.min_winning_score {
            info!(
                "Claiming payout for winner {} (score: {}, min: {})",
                pk, entry.score, tournament.min_winning_score
            );

            if !dry_run {
                match player::claim_payout(client, program_id, p, tournament.id) {
                    Ok(sig) => {
                        info!("Player {} claimed payout: {}", pk, sig);
                    }
                    Err(e) => {
                        warn!("Failed to claim payout for {}: {}", pk, e);
                    }
                }
                std::thread::sleep(tx_delay);
            }
        } else {
            info!(
                "Player {} not a winner (score: {}, min: {}), skipping claim",
                pk, entry.score, tournament.min_winning_score
            );
        }

        tracker.claimed.insert(pk);
    }

    // Check if all players have been processed — reclaim excess funds
    let all_claimed = players
        .iter()
        .all(|p| tracker.claimed.contains(&p.pubkey()));

    if all_claimed && !dry_run {
        info!("All players processed, reclaiming excess funds");
        for p in players {
            if let Err(e) = wallet::reclaim_funds(client, p, &funder.pubkey(), cfg_leave_amount()) {
                warn!("Failed to reclaim from {}: {}", p.pubkey(), e);
            }
        }
    }

    Ok(())
}

/// Amount to leave in player wallets after reclaiming (enough for rent + a few txs)
fn cfg_leave_amount() -> u64 {
    10_000_000 // 0.01 SOL
}
