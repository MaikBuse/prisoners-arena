use anyhow::Result;
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::{
    instruction::Instruction,
    signature::Keypair,
    signer::Signer,
    transaction::Transaction,
};

pub fn send_transaction(
    client: &RpcClient,
    instructions: &[Instruction],
    signer: &Keypair,
    dry_run: bool,
) -> Result<()> {
    let recent_blockhash = client.get_latest_blockhash()?;
    let transaction = Transaction::new_signed_with_payer(
        instructions,
        Some(&signer.pubkey()),
        &[signer],
        recent_blockhash,
    );

    if dry_run {
        let result = client.simulate_transaction(&transaction)?;
        println!("=== DRY RUN ===");
        if let Some(logs) = result.value.logs {
            for log in &logs {
                println!("  {}", log);
            }
        }
        if let Some(err) = result.value.err {
            println!("  Simulation error: {:?}", err);
        } else {
            println!("  Simulation succeeded");
        }
        println!("  CU consumed: {:?}", result.value.units_consumed);
    } else {
        let sig = client.send_and_confirm_transaction_with_spinner_and_commitment(
            &transaction,
            CommitmentConfig::confirmed(),
        )?;
        println!("Transaction confirmed: {}", sig);
    }
    Ok(())
}
