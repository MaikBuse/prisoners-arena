//! Dilemma Arena - Iterated Prisoner's Dilemma Tournament
//!
//! A Solana smart contract for running competitive tournaments
//! based on the classic Prisoner's Dilemma game theory scenario.

use anchor_lang::prelude::*;

mod state;
mod instructions;
mod error;

use instructions::*;
pub use state::Strategy;

declare_id!("6GhLrCuPioYDRquc9xW6mmEu3s9EfuXdwkEN5mFKcE56");

#[program]
pub mod dilemma_arena {
    use super::*;

    /// Initialize the global config and Tournament #0 (one-time setup)
    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        operator: Pubkey,
        stake: u64,
        min_participants: u16,
        max_participants: u16,
        registration_duration: i64,
        matches_per_player: u16,
    ) -> Result<()> {
        instructions::admin::initialize_config(
            ctx,
            operator,
            stake,
            min_participants,
            max_participants,
            registration_duration,
            matches_per_player,
        )
    }

    /// Update config parameters (admin only)
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        operator: Option<Pubkey>,
        house_fee_bps: Option<u16>,
        stake: Option<u64>,
        min_participants: Option<u16>,
        max_participants: Option<u16>,
        registration_duration: Option<i64>,
        matches_per_player: Option<u16>,
    ) -> Result<()> {
        instructions::admin::update_config(
            ctx,
            operator,
            house_fee_bps,
            stake,
            min_participants,
            max_participants,
            registration_duration,
            matches_per_player,
        )
    }

    /// Withdraw accumulated house fees (admin only)
    pub fn withdraw_fees(ctx: Context<WithdrawFees>) -> Result<()> {
        instructions::admin::withdraw_fees(ctx)
    }

    /// Enter the current tournament
    pub fn enter_tournament(
        ctx: Context<EnterTournament>,
        strategy: state::Strategy,
    ) -> Result<()> {
        instructions::player::enter_tournament(ctx, strategy)
    }

    /// Claim refund during registration (allowed anytime)
    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::player::claim_refund(ctx)
    }

    /// Claim payout if winner (within 30 days)
    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        instructions::player::claim_payout(ctx)
    }

    /// Close registration and transition to Running state (or extend deadline)
    pub fn close_registration(ctx: Context<CloseRegistration>) -> Result<()> {
        instructions::tournament::close_registration(ctx)
    }

    /// Execute a batch of matches (up to 5 per tx)
    pub fn run_matches<'info>(ctx: Context<'_, '_, '_, 'info, RunMatches<'info>>) -> Result<()> {
        instructions::tournament::run_matches(ctx)
    }

    /// Finalize tournament and create next tournament
    pub fn finalize_tournament(ctx: Context<FinalizeTournament>) -> Result<()> {
        instructions::tournament::finalize_tournament(ctx)
    }

    /// Close expired entry after 30-day claim window
    pub fn close_expired_entry(ctx: Context<CloseExpiredEntry>) -> Result<()> {
        instructions::tournament::close_expired_entry(ctx)
    }

    /// Close tournament account and recover rent (30 days after payout)
    pub fn close_tournament(ctx: Context<CloseTournament>) -> Result<()> {
        instructions::tournament::close_tournament(ctx)
    }
}
