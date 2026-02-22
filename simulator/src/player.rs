//! Player tournament actions: enter, reveal, claim.
//!
//! Adapted from cli/src/commands/player.rs — builds and sends transactions
//! for simulated players participating in tournaments.

use anyhow::Result;
use sha2::{Digest, Sha256};
use solana_client::rpc_client::RpcClient;
use solana_commitment_config::CommitmentConfig;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signature},
    signer::Signer,
    transaction::Transaction,
};
use solana_system_interface::program as system_program;

use crate::state;

/// Instruction discriminators (first 8 bytes of sha256("global:<instruction_name>"))
mod disc {
    pub const ENTER_TOURNAMENT: [u8; 8] = [19, 21, 109, 109, 227, 108, 232, 25];
    pub const REVEAL_STRATEGY: [u8; 8] = [102, 15, 100, 245, 177, 6, 9, 198];
    pub const CLAIM_PAYOUT: [u8; 8] = [127, 240, 132, 62, 227, 198, 146, 133];
    pub const CLAIM_REFUND: [u8; 8] = [15, 16, 30, 161, 255, 228, 97, 60];
}

/// Compute SHA256 commitment hash for a builtin strategy (index 0-8).
/// Layout: SHA256(strategy_u8 || salt_16_bytes)
pub fn compute_commitment(strategy_id: u8, salt: &[u8; 16]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update([strategy_id]);
    hasher.update(salt);
    hasher.finalize().into()
}

/// Enter a tournament with a commitment hash.
pub fn enter_tournament(
    client: &RpcClient,
    program_id: &Pubkey,
    player: &Keypair,
    tournament_id: u32,
    commitment: &[u8; 32],
) -> Result<Signature> {
    let (config_pda, _) = state::get_config_pda(program_id);
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament_id);
    let (entry_pda, _) = state::get_entry_pda(program_id, &tournament_pda, &player.pubkey());

    let mut data = disc::ENTER_TOURNAMENT.to_vec();
    data.extend_from_slice(commitment);

    let accounts = vec![
        AccountMeta::new(config_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(player.pubkey(), true),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    let ix = Instruction {
        program_id: *program_id,
        accounts,
        data,
    };

    send_transaction(client, &[ix], player)
}

/// Reveal a strategy for a previously entered tournament.
pub fn reveal_strategy(
    client: &RpcClient,
    program_id: &Pubkey,
    player: &Keypair,
    tournament_id: u32,
    strategy_id: u8,
    salt: &[u8; 16],
) -> Result<Signature> {
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament_id);
    let (entry_pda, _) = state::get_entry_pda(program_id, &tournament_pda, &player.pubkey());

    // Build reveal_strategy instruction data (Borsh-compatible)
    // Layout: disc(8) || strategy_u8(1) || salt(16) || 0x00 (Option::None for bytecode)
    let mut data = disc::REVEAL_STRATEGY.to_vec();
    data.push(strategy_id);
    data.extend_from_slice(salt);
    data.push(0x00); // Option::None — no bytecode for builtin strategies

    let accounts = vec![
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(player.pubkey(), true),
    ];

    let ix = Instruction {
        program_id: *program_id,
        accounts,
        data,
    };

    send_transaction(client, &[ix], player)
}

/// Claim payout for a winning entry.
pub fn claim_payout(
    client: &RpcClient,
    program_id: &Pubkey,
    player: &Keypair,
    tournament_id: u32,
) -> Result<Signature> {
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament_id);
    let (entry_pda, _) = state::get_entry_pda(program_id, &tournament_pda, &player.pubkey());

    let accounts = vec![
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(player.pubkey(), true),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    let ix = Instruction {
        program_id: *program_id,
        accounts,
        data: disc::CLAIM_PAYOUT.to_vec(),
    };

    send_transaction(client, &[ix], player)
}

/// Claim refund during Registration phase (closes entry, returns stake).
pub fn claim_refund(
    client: &RpcClient,
    program_id: &Pubkey,
    player: &Keypair,
    tournament_id: u32,
) -> Result<Signature> {
    let (tournament_pda, _) = state::get_tournament_pda(program_id, tournament_id);
    let (entry_pda, _) = state::get_entry_pda(program_id, &tournament_pda, &player.pubkey());

    let accounts = vec![
        AccountMeta::new(tournament_pda, false),
        AccountMeta::new(entry_pda, false),
        AccountMeta::new(player.pubkey(), true),
        AccountMeta::new_readonly(system_program::id(), false),
    ];

    let ix = Instruction {
        program_id: *program_id,
        accounts,
        data: disc::CLAIM_REFUND.to_vec(),
    };

    send_transaction(client, &[ix], player)
}

/// Send a transaction signed by a single keypair.
fn send_transaction(
    client: &RpcClient,
    instructions: &[Instruction],
    signer: &Keypair,
) -> Result<Signature> {
    let recent_blockhash = client.get_latest_blockhash()?;

    let transaction = Transaction::new_signed_with_payer(
        instructions,
        Some(&signer.pubkey()),
        &[signer],
        recent_blockhash,
    );

    let signature = client.send_and_confirm_transaction_with_spinner_and_commitment(
        &transaction,
        CommitmentConfig::confirmed(),
    )?;

    Ok(signature)
}
