use anyhow::{Context, Result};
use serde::Deserialize;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Keypair;
use solana_sdk::signer::keypair::read_keypair_file;
use std::path::{Path, PathBuf};
use std::str::FromStr;

#[derive(Debug, Deserialize)]
pub struct ArenaConfig {
    pub network: NetworkConfig,
    pub wallets: WalletConfig,
    pub defaults: DefaultsConfig,
}

#[derive(Debug, Deserialize)]
pub struct NetworkConfig {
    pub rpc_url: String,
    pub program_id: String,
}

#[derive(Debug, Deserialize)]
pub struct WalletConfig {
    pub admin: String,
    pub operator: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
pub struct DefaultsConfig {
    pub stake: u64,
    pub min_participants: u16,
    pub max_participants: u16,
    pub registration_duration: i64,
    pub matches_per_player: u16,
    pub house_fee_bps: u16,
    #[serde(default = "default_reveal_duration")]
    pub reveal_duration: i64,
}

fn default_reveal_duration() -> i64 {
    172800 // 48 hours
}

impl ArenaConfig {
    pub fn load(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)
            .with_context(|| format!("Failed to read config from {}", path.display()))?;
        toml::from_str(&content).with_context(|| "Failed to parse arena.toml")
    }

    pub fn program_id(&self) -> Result<Pubkey> {
        Pubkey::from_str(&self.network.program_id)
            .map_err(|e| anyhow::anyhow!("Invalid program_id: {}", e))
    }

    pub fn resolve_wallet_path(&self, wallet: &str) -> PathBuf {
        let raw = match wallet {
            "admin" => &self.wallets.admin,
            "operator" => &self.wallets.operator,
            other => other,
        };
        let expanded = shellexpand::tilde(raw);
        PathBuf::from(expanded.as_ref())
    }

    pub fn load_keypair(&self, wallet: &str) -> Result<Keypair> {
        let path = self.resolve_wallet_path(wallet);
        read_keypair_file(&path)
            .map_err(|e| anyhow::anyhow!("Failed to read keypair from {}: {}", path.display(), e))
    }
}
