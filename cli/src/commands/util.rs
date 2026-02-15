use anyhow::Result;
use solana_client::rpc_client::RpcClient;
use solana_sdk::{pubkey::Pubkey, signer::Signer};
use solana_system_interface::instruction as system_instruction;
use std::str::FromStr;

use crate::config::ArenaConfig;

pub fn balance(cfg: &ArenaConfig, wallet: &str) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let kp = cfg.load_keypair(wallet)?;
    let bal = client.get_balance(&kp.pubkey())?;
    println!("{}: {:.4} SOL ({} lamports)", kp.pubkey(), bal as f64 / 1e9, bal);
    Ok(())
}

pub fn transfer(cfg: &ArenaConfig, from: &str, to: &str, amount_sol: f64) -> Result<()> {
    let client = RpcClient::new(&cfg.network.rpc_url);
    let sender = cfg.load_keypair(from)?;
    let recipient = cfg
        .load_keypair(to)
        .map(|kp| kp.pubkey())
        .unwrap_or_else(|_| Pubkey::from_str(to).expect("Invalid recipient pubkey or wallet name"));
    let lamports = (amount_sol * 1e9) as u64;

    let before = client.get_balance(&sender.pubkey())?;
    println!(
        "Transferring {:.4} SOL from {} to {}...",
        amount_sol,
        sender.pubkey(),
        recipient
    );

    let ix = system_instruction::transfer(&sender.pubkey(), &recipient, lamports);
    crate::tx::send_transaction(&client, &[ix], &sender, false)?;

    let after = client.get_balance(&sender.pubkey())?;
    println!(
        "Sender balance: {:.4} SOL -> {:.4} SOL",
        before as f64 / 1e9,
        after as f64 / 1e9
    );
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
