mod commands;
mod config;
mod state;
mod tx;

use anyhow::Result;
use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "arena", about = "Dilemma Arena CLI")]
struct Cli {
    /// Path to config file
    #[arg(long, default_value = "arena.toml")]
    config: PathBuf,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Initialize config and Tournament #0
    Init {
        #[arg(long)]
        dry_run: bool,
    },
    /// Config operations
    Config {
        #[command(subcommand)]
        action: ConfigAction,
    },
    /// Withdraw accumulated house fees
    WithdrawFees {
        #[arg(long)]
        dry_run: bool,
    },
    /// Show current tournament status
    Status,
    /// Show specific tournament details
    Tournament {
        id: u32,
    },
    /// List entries for a tournament
    Entries {
        #[arg(long)]
        tournament: Option<u32>,
    },
    /// Enter current tournament
    Enter {
        #[arg(long, default_value = "admin")]
        wallet: String,
        #[arg(long, default_value = "tit-for-tat")]
        strategy: String,
        #[arg(long, default_value = "0")]
        forgiveness: u8,
        #[arg(long, default_value = "0")]
        retaliation_delay: u8,
        #[arg(long, default_value = "0")]
        noise_tolerance: u8,
        #[arg(long, default_value = "0")]
        initial_moves: u8,
        #[arg(long, default_value = "50")]
        cooperate_bias: u8,
        #[arg(long)]
        dry_run: bool,
    },
    /// Claim refund for current tournament
    Refund {
        #[arg(long, default_value = "admin")]
        wallet: String,
        #[arg(long)]
        dry_run: bool,
    },
    /// Claim payout
    Claim {
        #[arg(long, default_value = "admin")]
        wallet: String,
        #[arg(long)]
        tournament: Option<u32>,
        #[arg(long)]
        dry_run: bool,
    },
    /// Check wallet balance
    Balance {
        #[arg(long, default_value = "admin")]
        wallet: String,
    },
    /// Request devnet airdrop
    Airdrop {
        #[arg(long, default_value = "admin")]
        wallet: String,
        #[arg(long, default_value = "1.0")]
        amount: f64,
    },
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Display on-chain config
    Show,
    /// Update config parameters
    Update {
        #[arg(long)]
        stake: Option<u64>,
        #[arg(long)]
        min_participants: Option<u16>,
        #[arg(long)]
        max_participants: Option<u16>,
        #[arg(long)]
        registration_duration: Option<i64>,
        #[arg(long)]
        matches_per_player: Option<u16>,
        #[arg(long)]
        house_fee_bps: Option<u16>,
        #[arg(long)]
        operator: Option<String>,
        #[arg(long)]
        dry_run: bool,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    let cfg = config::ArenaConfig::load(&cli.config)?;

    match cli.command {
        Commands::Init { dry_run } => commands::admin::init(&cfg, dry_run),
        Commands::Config { action } => match action {
            ConfigAction::Show => commands::admin::config_show(&cfg),
            ConfigAction::Update {
                stake, min_participants, max_participants,
                registration_duration, matches_per_player, house_fee_bps,
                operator, dry_run,
            } => commands::admin::config_update(
                &cfg, stake, min_participants, max_participants,
                registration_duration, matches_per_player, house_fee_bps,
                operator, dry_run,
            ),
        },
        Commands::WithdrawFees { dry_run } => commands::admin::withdraw_fees(&cfg, dry_run),
        Commands::Status => commands::info::status(&cfg),
        Commands::Tournament { id } => commands::info::tournament(&cfg, id),
        Commands::Entries { tournament } => commands::info::entries(&cfg, tournament),
        Commands::Enter { wallet, strategy, forgiveness, retaliation_delay, noise_tolerance, initial_moves, cooperate_bias, dry_run } => {
            commands::player::enter(&cfg, &wallet, &strategy, forgiveness, retaliation_delay, noise_tolerance, initial_moves, cooperate_bias, dry_run)
        }
        Commands::Refund { wallet, dry_run } => commands::player::refund(&cfg, &wallet, dry_run),
        Commands::Claim { wallet, tournament, dry_run } => commands::player::claim(&cfg, &wallet, tournament, dry_run),
        Commands::Balance { wallet } => commands::util::balance(&cfg, &wallet),
        Commands::Airdrop { wallet, amount } => commands::util::airdrop(&cfg, &wallet, amount),
    }
}
