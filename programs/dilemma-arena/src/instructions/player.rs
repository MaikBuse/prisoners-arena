//! Player instructions

use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{Config, Tournament, Entry, Strategy, StrategyParams, TournamentState, CLAIM_EXPIRY_SECONDS, BYTES_PER_PLAYER};
use crate::error::DilemmaError;

/// Enter the current tournament
#[derive(Accounts)]
pub struct EnterTournament<'info> {
    #[account(
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"tournament", tournament.id.to_le_bytes().as_ref()],
        bump = tournament.bump,
        realloc = Tournament::BASE_SPACE + ((tournament.players.len() + 1) * BYTES_PER_PLAYER),
        realloc::payer = player,
        realloc::zero = false
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        init,
        payer = player,
        space = Entry::LEN,
        seeds = [b"entry", tournament.key().as_ref(), player.key().as_ref()],
        bump
    )]
    pub entry: Account<'info, Entry>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn enter_tournament(
    ctx: Context<EnterTournament>,
    strategy: Strategy,
    params: StrategyParams,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let tournament = &mut ctx.accounts.tournament;
    let entry = &mut ctx.accounts.entry;
    let player = &ctx.accounts.player;

    // Validate state
    require!(
        tournament.state == TournamentState::Registration,
        DilemmaError::RegistrationClosed
    );

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < tournament.registration_ends,
        DilemmaError::RegistrationClosed
    );

    // Check max participants
    require!(
        tournament.players.len() < config.max_participants as usize,
        DilemmaError::TournamentFull
    );

    // Validate strategy params
    require!(params.forgiveness <= 100, DilemmaError::InvalidParams);
    require!(params.retaliation_delay <= 10, DilemmaError::InvalidParams);
    require!(params.noise_tolerance <= 5, DilemmaError::InvalidParams);
    require!(params.cooperate_bias <= 100, DilemmaError::InvalidParams);
    // initial_moves: any u8 is valid (bitmask)

    // Use snapshotted stake from tournament
    let stake = tournament.stake;

    // Transfer stake from player to tournament
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: player.to_account_info(),
                to: tournament.to_account_info(),
            },
        ),
        stake,
    )?;

    // Initialize entry with index = current players count
    entry.tournament = tournament.key();
    entry.player = player.key();
    entry.index = tournament.players.len() as u32;
    entry.strategy = strategy;
    entry.strategy_params = params;
    entry.score = 0;
    entry.matches_played = 0;
    entry.paid_out = false;
    entry.created_at = clock.unix_timestamp;
    entry.bump = ctx.bumps.entry;

    // Add player to tournament's players vec
    tournament.players.push(player.key());
    tournament.scores.push(0);
    tournament.strategies.push(strategy as u8);
    tournament.strategy_params.push(params);
    tournament.participant_count += 1;
    tournament.entries_remaining += 1;
    tournament.pool += stake;

    msg!(
        "Player {} entered tournament {} at index {} with strategy {:?}",
        player.key(),
        tournament.id,
        entry.index,
        strategy
    );

    Ok(())
}

/// Claim refund during registration (allowed anytime)
#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(
        mut,
        seeds = [b"tournament", tournament.id.to_le_bytes().as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        seeds = [b"entry", tournament.key().as_ref(), player.key().as_ref()],
        bump = entry.bump,
        has_one = player,
        has_one = tournament,
        close = player
    )]
    pub entry: Account<'info, Entry>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
    let tournament = &mut ctx.accounts.tournament;
    let entry = &ctx.accounts.entry;
    let player = &ctx.accounts.player;

    // Refund allowed only during Registration state (anytime, no lock)
    require!(
        tournament.state == TournamentState::Registration,
        DilemmaError::InvalidState
    );

    // Use snapshotted stake from tournament
    let refund_amount = tournament.stake;

    // Transfer stake back to player from tournament
    **tournament.to_account_info().try_borrow_mut_lamports()? -= refund_amount;
    **player.try_borrow_mut_lamports()? += refund_amount;

    // Mark player slot as refunded (set to default pubkey)
    tournament.players[entry.index as usize] = Pubkey::default();
    tournament.strategies[entry.index as usize] = u8::MAX; // 255 = refunded/invalid
    tournament.strategy_params[entry.index as usize] = StrategyParams::default();
    tournament.participant_count -= 1;
    tournament.entries_remaining -= 1;
    tournament.pool -= refund_amount;

    // Note: scores[index] stays 0, entry is closed

    msg!(
        "Refunded {} lamports to player {} from tournament {}",
        refund_amount,
        player.key(),
        tournament.id
    );

    Ok(())
}

/// Claim payout if winner
#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(
        mut,
        seeds = [b"tournament", tournament.id.to_le_bytes().as_ref()],
        bump = tournament.bump
    )]
    pub tournament: Account<'info, Tournament>,

    #[account(
        mut,
        seeds = [b"entry", tournament.key().as_ref(), player.key().as_ref()],
        bump = entry.bump,
        has_one = player,
        has_one = tournament,
        close = player
    )]
    pub entry: Account<'info, Entry>,

    #[account(mut)]
    pub player: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
    let tournament = &mut ctx.accounts.tournament;
    let entry = &mut ctx.accounts.entry;
    let player = &ctx.accounts.player;
    let clock = Clock::get()?;

    // Must be in Payout state
    require!(
        tournament.state == TournamentState::Payout,
        DilemmaError::InvalidState
    );

    // Must not have already claimed
    require!(!entry.paid_out, DilemmaError::AlreadyPaid);

    // Check 30-day claim expiry
    require!(
        clock.unix_timestamp < tournament.payout_started_at + CLAIM_EXPIRY_SECONDS,
        DilemmaError::ClaimExpired
    );

    // Must be a winner (score >= min_winning_score)
    require!(
        entry.score >= tournament.min_winning_score,
        DilemmaError::NotWinner
    );

    // Calculate equal share (all winners split equally)
    let payout = tournament.winner_pool
        .checked_div(tournament.winner_count as u64)
        .ok_or(DilemmaError::Overflow)?;

    // Transfer payout to player
    **tournament.to_account_info().try_borrow_mut_lamports()? -= payout;
    **player.try_borrow_mut_lamports()? += payout;

    // Mark as paid
    entry.paid_out = true;
    tournament.claims_processed += 1;
    tournament.entries_remaining -= 1;

    msg!(
        "Paid {} lamports to player {} from tournament {}",
        payout,
        player.key(),
        tournament.id
    );

    Ok(())
}
