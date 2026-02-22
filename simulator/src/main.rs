//! Prisoner's Arena Tournament Simulator
//!
//! Populates devnet tournaments with simulated players:
//! - Enters N players during Registration (random count per tournament)
//! - Optionally refunds some players during Registration
//! - Reveals strategies during Reveal phase (some players intentionally skip)
//! - Claims payouts for winners during Payout phase
//! - Recycles funds back to funder wallet

use anyhow::Result;
use clap::Parser;
use rand::seq::SliceRandom;
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
    /// Players pre-selected to refund during Registration
    planned_refunds: HashSet<Pubkey>,
    /// Refunds completed on-chain
    refunded: HashSet<Pubkey>,
    /// Players that will intentionally skip reveal (operator forfeits them)
    skip_reveal: HashSet<Pubkey>,
    /// Subset of wallet pool selected for this tournament
    active_player_keys: Vec<Pubkey>,
    /// Whether all planned refunds have been submitted
    refunds_done: bool,
}

impl TournamentTracker {
    fn new() -> Self {
        Self {
            entered: HashMap::new(),
            revealed: HashSet::new(),
            claimed: HashSet::new(),
            planned_refunds: HashSet::new(),
            refunded: HashSet::new(),
            skip_reveal: HashSet::new(),
            active_player_keys: Vec::new(),
            refunds_done: false,
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
    info!(
        "Player count: {}-{}",
        cfg.simulator.player_count_min, cfg.simulator.player_count_max
    );
    info!(
        "Refund count: {}-{}",
        cfg.simulator.refund_count_min, cfg.simulator.refund_count_max
    );
    info!(
        "No-reveal count: {}-{}",
        cfg.simulator.no_reveal_count_min, cfg.simulator.no_reveal_count_max
    );
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

    // Initialize wallet pool sized to player_count_max
    let wallet_dir = shellexpand::tilde(&cfg.simulator.wallet_dir).to_string();
    let players = wallet::init_players(&wallet_dir, cfg.simulator.player_count_max)?;
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

/// Select players for a new tournament: random count, random refund/no-reveal assignments.
fn select_tournament_players(
    players: &[Keypair],
    cfg: &config::SimulatorConfig,
) -> TournamentTracker {
    let mut rng = rand::thread_rng();
    let mut tracker = TournamentTracker::new();

    // Pick random player count within configured range
    let player_count = rng.gen_range(cfg.player_count_min..=cfg.player_count_max);

    // Shuffle and select players from the pool
    let mut indices: Vec<usize> = (0..players.len()).collect();
    indices.shuffle(&mut rng);
    let selected_indices = &indices[..player_count];

    let active_keys: Vec<Pubkey> = selected_indices.iter().map(|&i| players[i].pubkey()).collect();
    tracker.active_player_keys = active_keys.clone();

    // Pick refund count, clamped so at least 2 players remain after refunds
    let max_refundable = player_count.saturating_sub(2);
    let refund_count_max = cfg.refund_count_max.min(max_refundable);
    let refund_count_min = cfg.refund_count_min.min(refund_count_max);
    let refund_count = if refund_count_min >= refund_count_max {
        refund_count_min
    } else {
        rng.gen_range(refund_count_min..=refund_count_max)
    };

    if refund_count < cfg.refund_count_min {
        warn!(
            "Clamped refund count from {} to {} (need at least 2 players after refunds)",
            cfg.refund_count_min, refund_count
        );
    }

    // Assign refund roles to the first `refund_count` selected players
    let mut assignable: Vec<Pubkey> = active_keys.clone();
    assignable.shuffle(&mut rng);

    for pk in assignable.iter().take(refund_count) {
        tracker.planned_refunds.insert(*pk);
    }

    // Pick no-reveal count from the remaining (non-refund) players
    let remaining: Vec<&Pubkey> = assignable
        .iter()
        .skip(refund_count)
        .collect();
    let max_no_reveal = remaining.len().saturating_sub(2); // keep at least 2 revealers
    let no_reveal_max = cfg.no_reveal_count_max.min(max_no_reveal);
    let no_reveal_min = cfg.no_reveal_count_min.min(no_reveal_max);
    let no_reveal_count = if no_reveal_min >= no_reveal_max {
        no_reveal_min
    } else {
        rng.gen_range(no_reveal_min..=no_reveal_max)
    };

    for pk in remaining.iter().take(no_reveal_count) {
        tracker.skip_reveal.insert(**pk);
    }

    info!(
        "Tournament plan: {} players, {} refunds, {} skip-reveal",
        player_count, refund_count, no_reveal_count
    );

    tracker
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

    // Ensure tracker exists for this tournament — create with player selection if new
    if !trackers.contains_key(&tid) {
        let tracker = select_tournament_players(players, &cfg.simulator);
        trackers.insert(tid, tracker);
    }

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

    // Build the set of active player keypairs for this tournament
    let active_set: HashSet<Pubkey> = tracker.active_player_keys.iter().cloned().collect();
    let active_players: Vec<&Keypair> = players
        .iter()
        .filter(|p| active_set.contains(&p.pubkey()))
        .collect();

    // Ensure active players are funded before entering
    if !dry_run {
        let active_refs: Vec<&Keypair> = active_players.iter().copied().collect();
        wallet::ensure_funded_refs(
            client,
            funder,
            &active_refs,
            cfg.simulator.min_player_balance,
            cfg.simulator.topup_amount,
            tx_delay,
        )?;
    }

    // Enter active players into the tournament
    for p in &active_players {
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

    // Process refunds for planned-refund players (after all entries are submitted)
    if !tracker.refunds_done && !tracker.planned_refunds.is_empty() {
        let all_entered = active_players
            .iter()
            .all(|p| tracker.entered.contains_key(&p.pubkey()));

        if all_entered {
            let refund_keys: Vec<Pubkey> = tracker.planned_refunds.iter().cloned().collect();
            let mut all_refunded = true;

            for pk in &refund_keys {
                if tracker.refunded.contains(pk) {
                    continue;
                }

                let p = match players.iter().find(|kp| kp.pubkey() == *pk) {
                    Some(kp) => kp,
                    None => continue,
                };

                info!(
                    "Claiming refund for player {} from tournament #{}",
                    pk, tournament.id
                );

                if dry_run {
                    tracker.refunded.insert(*pk);
                    continue;
                }

                match player::claim_refund(client, program_id, p, tournament.id) {
                    Ok(sig) => {
                        info!("Player {} refunded: {}", pk, sig);
                        tracker.refunded.insert(*pk);
                    }
                    Err(e) => {
                        warn!("Failed to refund player {}: {}", pk, e);
                        all_refunded = false;
                    }
                }

                std::thread::sleep(tx_delay);
            }

            tracker.refunds_done = all_refunded;
        }
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

    let active_set: HashSet<Pubkey> = tracker.active_player_keys.iter().cloned().collect();

    for p in players {
        let pk = p.pubkey();

        // Only process active players for this tournament
        if !active_set.contains(&pk) {
            continue;
        }

        if tracker.revealed.contains(&pk) {
            continue;
        }

        // Skip refunded players (entry closed on-chain)
        if tracker.refunded.contains(&pk) {
            tracker.revealed.insert(pk); // Mark so we don't revisit
            continue;
        }

        // Skip players designated to not reveal (operator will forfeit them)
        if tracker.skip_reveal.contains(&pk) {
            info!(
                "Skipping reveal for player {} (will be forfeited by operator)",
                pk
            );
            tracker.revealed.insert(pk); // Mark so we don't revisit
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
    let active_set: HashSet<Pubkey> = tracker.active_player_keys.iter().cloned().collect();

    for p in players {
        let pk = p.pubkey();

        // Only process active players for this tournament
        if !active_set.contains(&pk) {
            continue;
        }

        if tracker.claimed.contains(&pk) {
            continue;
        }

        // Skip refunded players (entry already closed on-chain)
        if tracker.refunded.contains(&pk) {
            tracker.claimed.insert(pk);
            continue;
        }

        if !tracker.entered.contains_key(&pk) {
            continue; // Not entered in this tournament
        }

        // Fetch entry to check if winner
        let entry = match state::fetch_entry(client, program_id, &tournament_pda, &pk) {
            Ok(e) => e,
            Err(_) => {
                // Entry doesn't exist (already closed, forfeited, or never entered)
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

    // Check if all active players have been processed — reclaim excess funds
    let all_claimed = tracker
        .active_player_keys
        .iter()
        .all(|pk| tracker.claimed.contains(pk));

    if all_claimed && !dry_run {
        info!("All players processed, reclaiming excess funds");
        let active_players: Vec<&Keypair> = players
            .iter()
            .filter(|p| active_set.contains(&p.pubkey()))
            .collect();
        for p in active_players {
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
