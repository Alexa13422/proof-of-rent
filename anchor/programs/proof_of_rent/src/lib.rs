//! Proof of Rent: tenant passports and deposit escrow.
//!
//! Flow: every user owns one `Passport` PDA. A landlord creates a lease
//! *offer* for a tenant who already has a passport. The tenant either
//! rejects it (the landlord then creates a revised offer) or accepts it:
//! accepting moves the deposit into a vault owned by the lease PDA and pays
//! the platform fee. The deposit leaves the vault only through
//! `payout_and_close`, which also writes the outcome into both passports.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

#[cfg(test)]
mod tests;

declare_id!("AqMUqWYHuFNdY5s78wX52BF3fKkaQVTPT4UsAvcgsuba");

pub const CONFIG_SEED: &[u8] = b"config";
pub const PASSPORT_SEED: &[u8] = b"passport";
pub const LEASE_SEED: &[u8] = b"lease";
pub const VAULT_SEED: &[u8] = b"vault";

/// District-level label only ("Warsaw · Mokotów"), never a street address.
pub const MAX_AREA_LEN: usize = 48;
/// Hard cap on the platform fee: 10% of the deposit.
pub const MAX_FEE_BPS: u16 = 1_000;
pub const SECONDS_PER_MONTH: i64 = 30 * 24 * 60 * 60;

#[program]
pub mod proof_of_rent {
    use super::*;

    /// One-time platform setup. Whoever signs becomes the admin.
    pub fn init_config(
        ctx: Context<InitConfig>,
        treasury: Pubkey,
        arbiter: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, PorError::InvalidAmount);
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = treasury;
        config.arbiter = arbiter;
        config.fee_bps = fee_bps;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        treasury: Pubkey,
        arbiter: Pubkey,
        fee_bps: u16,
    ) -> Result<()> {
        require!(fee_bps <= MAX_FEE_BPS, PorError::InvalidAmount);
        let config = &mut ctx.accounts.config;
        config.treasury = treasury;
        config.arbiter = arbiter;
        config.fee_bps = fee_bps;
        Ok(())
    }

    /// Hands the admin role to another key. Both must sign, so a typo in the
    /// new address cannot lock the config forever.
    pub fn set_admin(ctx: Context<SetAdmin>) -> Result<()> {
        ctx.accounts.config.admin = ctx.accounts.new_admin.key();
        Ok(())
    }

    /// Every user gets exactly one passport; `init` rejects a second one.
    pub fn create_passport(ctx: Context<CreatePassport>) -> Result<()> {
        let passport = &mut ctx.accounts.passport;
        passport.owner = ctx.accounts.owner.key();
        passport.created_at = Clock::get()?.unix_timestamp;
        passport.leases_completed = 0;
        passport.returned_in_full = 0;
        passport.months_on_record = 0;
        passport.landlord_leases_closed = 0;
        passport.landlord_full_returns = 0;
        passport.bump = ctx.bumps.passport;
        Ok(())
    }

    /// Landlord proposes terms to a tenant. No money moves yet.
    #[allow(clippy::too_many_arguments)]
    pub fn create_offer(
        ctx: Context<CreateOffer>,
        offer_id: u64,
        tenant: Pubkey,
        deposit_amount: u64,
        monthly_rent: u64,
        start_ts: i64,
        end_ts: i64,
        accept_deadline: i64,
        return_timeout: i64,
        area: String,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let landlord = ctx.accounts.landlord.key();

        require_keys_neq!(landlord, tenant, PorError::InvalidParties);
        require!(deposit_amount > 0, PorError::InvalidAmount);
        require!(area.len() <= MAX_AREA_LEN, PorError::AreaTooLong);
        require!(start_ts < end_ts, PorError::InvalidTimeParams);
        require!(end_ts > now, PorError::InvalidTimeParams);
        require!(accept_deadline > now, PorError::InvalidTimeParams);
        require!(return_timeout > 0, PorError::InvalidTimeParams);

        let fee_amount = (deposit_amount as u128)
            .checked_mul(ctx.accounts.config.fee_bps as u128)
            .ok_or(PorError::MathOverflow)?
            / 10_000;

        let lease = &mut ctx.accounts.lease;
        lease.landlord = landlord;
        lease.tenant = tenant;
        lease.mint = ctx.accounts.mint.key();
        lease.payer = ctx.accounts.payer.key();
        lease.offer_id = offer_id;
        lease.deposit_amount = deposit_amount;
        lease.monthly_rent = monthly_rent;
        lease.fee_amount = u64::try_from(fee_amount).map_err(|_| PorError::MathOverflow)?;
        lease.start_ts = start_ts;
        lease.end_ts = end_ts;
        lease.accept_deadline = accept_deadline;
        lease.return_timeout = return_timeout;
        lease.status = LeaseStatus::Offered;
        lease.outcome = DepositOutcome::None;
        lease.settlement_offer = None;
        lease.amount_to_tenant = 0;
        lease.created_at = now;
        lease.accepted_at = 0;
        lease.closed_at = 0;
        lease.bump = ctx.bumps.lease;
        lease.vault_bump = 0;
        lease.area = area;
        Ok(())
    }

    /// Tenant declines. To change terms the landlord creates a new offer.
    pub fn reject_offer(ctx: Context<RespondOffer>) -> Result<()> {
        let lease = &mut ctx.accounts.lease;
        require_keys_eq!(ctx.accounts.signer.key(), lease.tenant, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Offered, PorError::InvalidStatus);
        lease.status = LeaseStatus::Rejected;
        lease.closed_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Landlord withdraws an offer the tenant has not accepted yet.
    pub fn cancel_offer(ctx: Context<RespondOffer>) -> Result<()> {
        let lease = &mut ctx.accounts.lease;
        require_keys_eq!(ctx.accounts.signer.key(), lease.landlord, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Offered, PorError::InvalidStatus);
        lease.status = LeaseStatus::Cancelled;
        lease.closed_at = Clock::get()?.unix_timestamp;
        Ok(())
    }

    /// Tenant agrees: the deposit goes to the vault, the fee to the treasury.
    pub fn accept_offer(ctx: Context<AcceptOffer>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let accounts = &mut *ctx.accounts;
        require!(accounts.lease.status == LeaseStatus::Offered, PorError::InvalidStatus);
        require!(now <= accounts.lease.accept_deadline, PorError::AcceptDeadlinePassed);

        let decimals = accounts.mint.decimals;
        token::transfer_checked(
            CpiContext::new(
                accounts.token_program.key(),
                TransferChecked {
                    from: accounts.tenant_token.to_account_info(),
                    mint: accounts.mint.to_account_info(),
                    to: accounts.vault.to_account_info(),
                    authority: accounts.tenant.to_account_info(),
                },
            ),
            accounts.lease.deposit_amount,
            decimals,
        )?;

        if accounts.lease.fee_amount > 0 {
            token::transfer_checked(
                CpiContext::new(
                    accounts.token_program.key(),
                    TransferChecked {
                        from: accounts.tenant_token.to_account_info(),
                        mint: accounts.mint.to_account_info(),
                        to: accounts.treasury_token.to_account_info(),
                        authority: accounts.tenant.to_account_info(),
                    },
                ),
                accounts.lease.fee_amount,
                decimals,
            )?;
        }

        let lease = &mut accounts.lease;
        lease.status = LeaseStatus::Active;
        lease.accepted_at = now;
        lease.vault_bump = ctx.bumps.vault;
        Ok(())
    }

    /// Landlord returns the whole deposit.
    pub fn release_full(ctx: Context<CloseOut>) -> Result<()> {
        let lease = &ctx.accounts.lease;
        require_keys_eq!(ctx.accounts.signer.key(), lease.landlord, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Active, PorError::InvalidStatus);
        let deposit = lease.deposit_amount;
        payout_and_close(ctx.accounts, deposit, DepositOutcome::FullReturn)
    }

    /// Landlord offers to return `to_tenant`; overwrites any earlier offer.
    pub fn propose_settlement(ctx: Context<ProposeSettlement>, to_tenant: u64) -> Result<()> {
        let lease = &mut ctx.accounts.lease;
        require_keys_eq!(ctx.accounts.landlord.key(), lease.landlord, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Active, PorError::InvalidStatus);
        require!(to_tenant <= lease.deposit_amount, PorError::InvalidAmount);
        lease.settlement_offer = Some(to_tenant);
        Ok(())
    }

    /// Tenant accepts the exact settlement amount they were shown.
    pub fn accept_settlement(ctx: Context<CloseOut>, expected_to_tenant: u64) -> Result<()> {
        let lease = &ctx.accounts.lease;
        require_keys_eq!(ctx.accounts.signer.key(), lease.tenant, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Active, PorError::InvalidStatus);
        let offer = lease.settlement_offer.ok_or(PorError::NoSettlementOffer)?;
        require!(offer == expected_to_tenant, PorError::SettlementMismatch);
        let outcome = if offer == lease.deposit_amount {
            DepositOutcome::FullReturn
        } else {
            DepositOutcome::Settled
        };
        payout_and_close(ctx.accounts, offer, outcome)
    }

    /// Landlord stayed silent past `end_ts + return_timeout`: tenant takes it all.
    pub fn claim_after_timeout(ctx: Context<CloseOut>) -> Result<()> {
        let lease = &ctx.accounts.lease;
        require_keys_eq!(ctx.accounts.signer.key(), lease.tenant, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Active, PorError::InvalidStatus);
        let unlock_at = lease
            .end_ts
            .checked_add(lease.return_timeout)
            .ok_or(PorError::MathOverflow)?;
        require!(
            Clock::get()?.unix_timestamp > unlock_at,
            PorError::ReturnTimeoutNotReached
        );
        let deposit = lease.deposit_amount;
        payout_and_close(ctx.accounts, deposit, DepositOutcome::TimeoutClaim)
    }
}

/// The only place tokens leave a vault.
fn payout_and_close(accounts: &mut CloseOut, to_tenant: u64, outcome: DepositOutcome) -> Result<()> {
    // Actual balance, so stray dust sent to the vault cannot brick closing.
    let total = accounts.vault.amount;
    let to_landlord = total.checked_sub(to_tenant).ok_or(PorError::MathOverflow)?;

    let landlord_key = accounts.lease.landlord;
    let offer_bytes = accounts.lease.offer_id.to_le_bytes();
    let bump = [accounts.lease.bump];
    let seeds: &[&[u8]] = &[LEASE_SEED, landlord_key.as_ref(), &offer_bytes, &bump];
    let signer_seeds = &[seeds];
    let decimals = accounts.mint.decimals;

    for (to, amount) in [
        (accounts.tenant_token.to_account_info(), to_tenant),
        (accounts.landlord_token.to_account_info(), to_landlord),
    ] {
        if amount == 0 {
            continue;
        }
        token::transfer_checked(
            CpiContext::new_with_signer(
                accounts.token_program.key(),
                TransferChecked {
                    from: accounts.vault.to_account_info(),
                    mint: accounts.mint.to_account_info(),
                    to,
                    authority: accounts.lease.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
            decimals,
        )?;
    }

    token::close_account(CpiContext::new_with_signer(
        accounts.token_program.key(),
        CloseAccount {
            account: accounts.vault.to_account_info(),
            destination: accounts.rent_receiver.to_account_info(),
            authority: accounts.lease.to_account_info(),
        },
        signer_seeds,
    ))?;

    let now = Clock::get()?.unix_timestamp;
    let lease = &mut accounts.lease;
    let full = to_tenant >= lease.deposit_amount;
    let months = (lease.end_ts.saturating_sub(lease.start_ts) / SECONDS_PER_MONTH).max(0);
    let months = u32::try_from(months).map_err(|_| PorError::MathOverflow)?;

    lease.status = LeaseStatus::Closed;
    lease.outcome = outcome;
    lease.amount_to_tenant = to_tenant;
    lease.closed_at = now;
    lease.settlement_offer = None;

    let tenant_passport = &mut accounts.tenant_passport;
    tenant_passport.leases_completed = inc(tenant_passport.leases_completed, 1)?;
    tenant_passport.months_on_record = inc(tenant_passport.months_on_record, months)?;

    let landlord_passport = &mut accounts.landlord_passport;
    landlord_passport.landlord_leases_closed = inc(landlord_passport.landlord_leases_closed, 1)?;

    if full {
        tenant_passport.returned_in_full = inc(tenant_passport.returned_in_full, 1)?;
        landlord_passport.landlord_full_returns = inc(landlord_passport.landlord_full_returns, 1)?;
    }
    Ok(())
}

fn inc(value: u32, by: u32) -> Result<u32> {
    Ok(value.checked_add(by).ok_or(PorError::MathOverflow)?)
}

// ---------------------------------------------------------------- state

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    /// Owner of the token accounts that receive platform fees.
    pub treasury: Pubkey,
    /// Reserved for the dispute flow (next milestone).
    pub arbiter: Pubkey,
    pub fee_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Passport {
    pub owner: Pubkey,
    pub created_at: i64,
    /// As tenant.
    pub leases_completed: u32,
    pub returned_in_full: u32,
    pub months_on_record: u32,
    /// As landlord (landlord rating).
    pub landlord_leases_closed: u32,
    pub landlord_full_returns: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Lease {
    pub landlord: Pubkey, // offset 8  (memcmp: landlord's leases)
    pub tenant: Pubkey,   // offset 40 (memcmp: tenant's leases)
    pub mint: Pubkey,
    /// Paid rent for the accounts; receives the vault's rent back.
    pub payer: Pubkey,
    pub offer_id: u64,
    pub deposit_amount: u64,
    /// Informational; rent itself is paid by bank transfer.
    pub monthly_rent: u64,
    pub fee_amount: u64,
    pub start_ts: i64,
    pub end_ts: i64,
    pub accept_deadline: i64,
    /// Seconds after `end_ts` after which the tenant may claim the deposit.
    pub return_timeout: i64,
    pub status: LeaseStatus,
    pub outcome: DepositOutcome,
    pub settlement_offer: Option<u64>,
    pub amount_to_tenant: u64,
    pub created_at: i64,
    pub accepted_at: i64,
    pub closed_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
    #[max_len(MAX_AREA_LEN)]
    pub area: String,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum LeaseStatus {
    Offered,
    Rejected,
    Cancelled,
    Active,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum DepositOutcome {
    None,
    FullReturn,
    Settled,
    TimeoutClaim,
}

// ---------------------------------------------------------------- contexts

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [CONFIG_SEED], bump)]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ PorError::Unauthorized)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct SetAdmin<'info> {
    pub admin: Signer<'info>,
    pub new_admin: Signer<'info>,
    #[account(mut, seeds = [CONFIG_SEED], bump = config.bump, has_one = admin @ PorError::Unauthorized)]
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct CreatePassport<'info> {
    pub owner: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + Passport::INIT_SPACE,
        seeds = [PASSPORT_SEED, owner.key().as_ref()],
        bump
    )]
    pub passport: Account<'info, Passport>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(offer_id: u64, tenant: Pubkey)]
pub struct CreateOffer<'info> {
    pub landlord: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(seeds = [PASSPORT_SEED, landlord.key().as_ref()], bump = landlord_passport.bump)]
    pub landlord_passport: Account<'info, Passport>,
    /// The tenant must already have a passport: offers go to real users.
    #[account(seeds = [PASSPORT_SEED, tenant.as_ref()], bump = tenant_passport.bump)]
    pub tenant_passport: Account<'info, Passport>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = payer,
        space = 8 + Lease::INIT_SPACE,
        seeds = [LEASE_SEED, landlord.key().as_ref(), &offer_id.to_le_bytes()],
        bump
    )]
    pub lease: Account<'info, Lease>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RespondOffer<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub lease: Account<'info, Lease>,
}

#[derive(Accounts)]
pub struct AcceptOffer<'info> {
    pub tenant: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Account<'info, Config>,
    #[account(
        mut,
        has_one = tenant @ PorError::Unauthorized,
        has_one = mint @ PorError::WrongTokenAccount
    )]
    pub lease: Box<Account<'info, Lease>>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = tenant_token.mint == mint.key() @ PorError::WrongTokenAccount,
        constraint = tenant_token.owner == tenant.key() @ PorError::WrongTokenAccount,
    )]
    pub tenant_token: Box<Account<'info, TokenAccount>>,
    #[account(
        init,
        payer = payer,
        seeds = [VAULT_SEED, lease.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = lease,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = treasury_token.mint == mint.key() @ PorError::WrongTokenAccount,
        constraint = treasury_token.owner == config.treasury @ PorError::WrongTokenAccount,
    )]
    pub treasury_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ProposeSettlement<'info> {
    pub landlord: Signer<'info>,
    #[account(mut)]
    pub lease: Account<'info, Lease>,
}

/// Shared by every instruction that pays out the vault.
/// Each handler checks the signer's role against the lease first.
#[derive(Accounts)]
pub struct CloseOut<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub lease: Box<Account<'info, Lease>>,
    #[account(mut, seeds = [VAULT_SEED, lease.key().as_ref()], bump = lease.vault_bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(address = lease.mint @ PorError::WrongTokenAccount)]
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = tenant_token.mint == lease.mint @ PorError::WrongTokenAccount,
        constraint = tenant_token.owner == lease.tenant @ PorError::WrongTokenAccount,
    )]
    pub tenant_token: Box<Account<'info, TokenAccount>>,
    #[account(
        mut,
        constraint = landlord_token.mint == lease.mint @ PorError::WrongTokenAccount,
        constraint = landlord_token.owner == lease.landlord @ PorError::WrongTokenAccount,
    )]
    pub landlord_token: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [PASSPORT_SEED, lease.tenant.as_ref()], bump = tenant_passport.bump)]
    pub tenant_passport: Box<Account<'info, Passport>>,
    #[account(mut, seeds = [PASSPORT_SEED, lease.landlord.as_ref()], bump = landlord_passport.bump)]
    pub landlord_passport: Box<Account<'info, Passport>>,
    /// CHECK: only receives the vault's rent lamports; pinned to `lease.payer`.
    #[account(mut, address = lease.payer @ PorError::Unauthorized)]
    pub rent_receiver: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum PorError {
    #[msg("Signer is not allowed to do this")]
    Unauthorized,
    #[msg("Lease is not in the right state for this action")]
    InvalidStatus,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Invalid dates or time windows")]
    InvalidTimeParams,
    #[msg("Landlord and tenant must be different users")]
    InvalidParties,
    #[msg("Area label is too long")]
    AreaTooLong,
    #[msg("The offer has expired")]
    AcceptDeadlinePassed,
    #[msg("The deposit cannot be claimed yet")]
    ReturnTimeoutNotReached,
    #[msg("There is no settlement offer")]
    NoSettlementOffer,
    #[msg("Settlement offer changed")]
    SettlementMismatch,
    #[msg("Wrong token account")]
    WrongTokenAccount,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
