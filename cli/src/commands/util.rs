use anyhow::Result;
use solana_client::rpc_client::RpcClient;
use solana_sdk::signer::Signer;

use crate::config::ArenaConfig;

pub fn balance(cfg: &ArenaConfig, wallet: &str) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let kp = cfg.load_keypair(wallet)?;
    let bal = client.get_balance(&kp.pubkey())?;
    println!("{}: {:.4} SOL ({} lamports)", kp.pubkey(), bal as f64 / 1e9, bal);
    Ok(())
}

pub fn airdrop(cfg: &ArenaConfig, wallet: &str, amount_sol: f64) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let kp = cfg.load_keypair(wallet)?;
    let lamports = (amount_sol * 1e9) as u64;

    println!("Requesting airdrop of {:.2} SOL to {}...", amount_sol, kp.pubkey());
    let sig = client.request_airdrop(&kp.pubkey(), lamports)?;

    // Wait for confirmation
    loop {
        let confirmed = client.confirm_transaction(&sig)?;
        if confirmed {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }

    let bal = client.get_balance(&kp.pubkey())?;
    println!("Airdrop confirmed. Balance: {:.4} SOL", bal as f64 / 1e9);
    Ok(())
}
