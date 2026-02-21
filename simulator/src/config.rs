//! Configuration loading for the simulator.
//!
//! Supports three layers (highest priority wins):
//! 1. Environment variables (`RPC_URL`, `PROGRAM_ID`, `FUNDER`, etc.)
//! 2. Config file (`arena.toml` with `[simulator]` section)
//! 3. Built-in defaults

use anyhow::{Context, Result};
use serde::Deserialize;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{read_keypair_file, Keypair};
use std::env;
use std::path::Path;
use std::str::FromStr;

#[derive(Debug)]
pub struct ArenaConfig {
    pub network: NetworkConfig,
    pub simulator: SimulatorConfig,
}

#[derive(Debug)]
pub struct NetworkConfig {
    pub rpc_url: String,
    pub program_id: String,
}

#[derive(Debug)]
pub struct SimulatorConfig {
    /// Path to the funder keypair file (funds player wallets)
    pub funder: String,

    /// Number of simulated players per tournament
    pub player_count: usize,

    /// Directory to store generated player keypair files
    pub wallet_dir: String,

    /// Allowed strategy indices (empty = all 0-8)
    pub strategies: Vec<u8>,

    /// Minimum player balance before topping up (lamports)
    pub min_player_balance: u64,

    /// Amount to top up player wallets to (lamports)
    pub topup_amount: u64,

    /// Delay between player transactions in milliseconds (rate limiting)
    pub tx_delay_ms: u64,
}

// --- TOML file structs (optional fields for partial override) ---

#[derive(Debug, Deserialize, Default)]
struct FileConfig {
    #[serde(default)]
    network: FileNetworkConfig,
    #[serde(default)]
    simulator: FileSimulatorConfig,
}

#[derive(Debug, Deserialize, Default)]
struct FileNetworkConfig {
    rpc_url: Option<String>,
    program_id: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct FileSimulatorConfig {
    funder: Option<String>,
    player_count: Option<usize>,
    wallet_dir: Option<String>,
    #[serde(default)]
    strategies: Vec<u8>,
    min_player_balance: Option<u64>,
    topup_amount: Option<u64>,
    tx_delay_ms: Option<u64>,
}

impl ArenaConfig {
    /// Load configuration with env vars taking priority over config file.
    ///
    /// Env vars:
    /// - `RPC_URL` — Solana RPC endpoint
    /// - `PROGRAM_ID` — On-chain program ID
    /// - `FUNDER` — Path to funder keypair JSON file
    /// - `PLAYER_COUNT` — Number of simulated players
    /// - `WALLET_DIR` — Directory for player keypair files
    /// - `STRATEGIES` — Comma-separated strategy indices (e.g. "0,1,4")
    /// - `MIN_PLAYER_BALANCE` — Top-up threshold in lamports
    /// - `TOPUP_AMOUNT` — Amount to fund players to in lamports
    /// - `TX_DELAY_MS` — Delay between transactions in ms
    pub fn load(path: &Path) -> Result<Self> {
        // Load file config (non-fatal if missing and env vars provide everything)
        let file = match std::fs::read_to_string(path) {
            Ok(content) => toml::from_str::<FileConfig>(&content)
                .with_context(|| format!("Failed to parse {}", path.display()))?,
            Err(_) => FileConfig::default(),
        };

        let rpc_url = env_or(
            "RPC_URL",
            file.network
                .rpc_url
                .unwrap_or_else(|| "https://api.devnet.solana.com".to_string()),
        );

        let program_id = env_or(
            "PROGRAM_ID",
            file.network.program_id.unwrap_or_else(|| {
                "2j8FBKuXsBsHRjfVLWCdPtZbPDLKzM3jXG7JSAy4jtga".to_string()
            }),
        );

        let funder = env_or(
            "FUNDER",
            file.simulator
                .funder
                .unwrap_or_else(|| "~/.config/solana/id.json".to_string()),
        );

        let player_count = env_parse("PLAYER_COUNT", file.simulator.player_count.unwrap_or(4));

        let wallet_dir = env_or(
            "WALLET_DIR",
            file.simulator
                .wallet_dir
                .unwrap_or_else(|| "./simulator-wallets".to_string()),
        );

        let strategies = match env::var("STRATEGIES") {
            Ok(val) if !val.is_empty() => val
                .split(',')
                .map(|s| {
                    s.trim()
                        .parse::<u8>()
                        .with_context(|| format!("Invalid strategy index: {}", s))
                })
                .collect::<Result<Vec<u8>>>()?,
            _ => file.simulator.strategies,
        };

        let min_player_balance =
            env_parse("MIN_PLAYER_BALANCE", file.simulator.min_player_balance.unwrap_or(100_000_000));

        let topup_amount =
            env_parse("TOPUP_AMOUNT", file.simulator.topup_amount.unwrap_or(500_000_000));

        let tx_delay_ms = env_parse("TX_DELAY_MS", file.simulator.tx_delay_ms.unwrap_or(500));

        Ok(ArenaConfig {
            network: NetworkConfig {
                rpc_url,
                program_id,
            },
            simulator: SimulatorConfig {
                funder,
                player_count,
                wallet_dir,
                strategies,
                min_player_balance,
                topup_amount,
                tx_delay_ms,
            },
        })
    }

    pub fn program_id(&self) -> Result<Pubkey> {
        Pubkey::from_str(&self.network.program_id)
            .map_err(|e| anyhow::anyhow!("Invalid program_id: {}", e))
    }

    pub fn load_funder(&self) -> Result<Keypair> {
        let expanded = shellexpand::tilde(&self.simulator.funder).to_string();
        read_keypair_file(&expanded)
            .map_err(|e| anyhow::anyhow!("Failed to load funder keypair from {}: {}", expanded, e))
    }

    /// Return the list of allowed strategy indices, defaulting to all builtin (0-8)
    pub fn allowed_strategies(&self) -> Vec<u8> {
        if self.simulator.strategies.is_empty() {
            (0..=8).collect()
        } else {
            self.simulator.strategies.clone()
        }
    }
}

/// Read env var or fall back to default.
fn env_or(key: &str, default: String) -> String {
    env::var(key).unwrap_or(default)
}

/// Parse env var as T, or fall back to default.
fn env_parse<T: std::str::FromStr>(key: &str, default: T) -> T {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}
