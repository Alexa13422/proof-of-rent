//! Proof of Rent: tenant passports and deposit escrow.
//!
//! Flow: every user owns one `Passport` PDA. A landlord creates a lease
//! *offer* for a tenant who already has a passport. The tenant either
//! rejects it (the landlord then creates a revised offer) or accepts it:
//! accepting moves the deposit into a vault owned by the lease PDA and pays
//! the platform fee. The deposit leaves the vault only through `pay_out`,
//! which also writes the outcome into both passports.
//!
//! Move-out: the landlord returns everything or proposes a partial return
//! within `return_timeout` after `end_ts` (silence → tenant claims it all).
//! The tenant then accepts, stays silent (the proposal executes after another
//! `return_timeout`) or opens a dispute by posting a bond. The arbiter (or
//! admin) splits the deposit; the losing side pays the bond to the treasury.
//! Photos and statements live off-chain; the lease stores their sha256.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

#[cfg(test)]
mod tests;

declare_id!("AqMUqWYHuFNdY5s78wX52BF3fKkaQVTPT4UsAvcgsuba");

pub const CONFIG_SEED: &[u8] = b"config";
pub const PASSPORT_SEED: &[u8] = b"passport";
pub const LEASE_SEED: &[u8] = b"lease";
pub const VAULT_SEED: &[u8] = b"vault";
pub const RENT_SEED: &[u8] = b"rent";

/// District-level label only ("Warsaw · Mokotów"), never a street address.
pub const MAX_AREA_LEN: usize = 48;
/// Hard cap on the platform fee: 10% of the deposit.
pub const MAX_FEE_BPS: u16 = 1_000;
pub const SECONDS_PER_MONTH: i64 = 30 * 24 * 60 * 60;
/// Dispute bond the tenant posts when disputing: 5% of the deposit.
pub const DISPUTE_BOND_BPS: u64 = 500;
pub const DAY: i64 = 24 * 60 * 60;
/// Tenant can mark a month paid from this long before the month ends.
pub const RENT_CLAIM_OPENS: i64 = 10 * DAY;
/// Landlord confirms or rejects within this window; silence = accepted.
pub const RENT_REVIEW_WINDOW: i64 = 7 * DAY;

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
        checkin_hash: [u8; 32],
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
        lease.checkin_hash = checkin_hash;
        lease.proposed_at = 0;
        lease.dispute_bond = 0;
        lease.disputed_at = 0;
        lease.tenant_evidence = [0; 32];
        lease.landlord_evidence = [0; 32];
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
        let a = &mut *ctx.accounts;
        pay_out(&a.close(), &mut a.lease, &mut a.tenant_passport, &mut a.landlord_passport, deposit, 0, deposit, DepositOutcome::FullReturn)
    }

    /// Landlord offers to return `to_tenant`, once, with photos/notes of the
    /// damage (`evidence` = sha256 of the off-chain manifest). Only before the
    /// return window closes: after it the tenant may claim the full deposit.
    pub fn propose_settlement(
        ctx: Context<ProposeSettlement>,
        to_tenant: u64,
        evidence: [u8; 32],
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let lease = &mut ctx.accounts.lease;
        require_keys_eq!(ctx.accounts.landlord.key(), lease.landlord, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Active, PorError::InvalidStatus);
        require!(lease.settlement_offer.is_none(), PorError::AlreadyProposed);
        require!(to_tenant < lease.deposit_amount, PorError::InvalidAmount);
        require!(now <= return_deadline(lease)?, PorError::ReturnWindowClosed);
        lease.settlement_offer = Some(to_tenant);
        lease.proposed_at = now;
        lease.landlord_evidence = evidence;
        Ok(())
    }

    /// Tenant accepts the exact settlement amount they were shown.
    pub fn accept_settlement(ctx: Context<CloseOut>, expected_to_tenant: u64) -> Result<()> {
        let lease = &ctx.accounts.lease;
        require_keys_eq!(ctx.accounts.signer.key(), lease.tenant, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Active, PorError::InvalidStatus);
        let offer = lease.settlement_offer.ok_or(PorError::NoSettlementOffer)?;
        require!(offer == expected_to_tenant, PorError::SettlementMismatch);
        let a = &mut *ctx.accounts;
        pay_out(&a.close(), &mut a.lease, &mut a.tenant_passport, &mut a.landlord_passport, offer, 0, offer, DepositOutcome::Settled)
    }

    /// Tenant stayed silent on a proposal for `return_timeout`: it executes.
    /// Either party may trigger it.
    pub fn finalize_settlement(ctx: Context<CloseOut>) -> Result<()> {
        let lease = &ctx.accounts.lease;
        let signer = ctx.accounts.signer.key();
        require!(signer == lease.landlord || signer == lease.tenant, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Active, PorError::InvalidStatus);
        let offer = lease.settlement_offer.ok_or(PorError::NoSettlementOffer)?;
        require!(
            Clock::get()?.unix_timestamp > response_deadline(lease)?,
            PorError::ResponseWindowOpen
        );
        let a = &mut *ctx.accounts;
        pay_out(&a.close(), &mut a.lease, &mut a.tenant_passport, &mut a.landlord_passport, offer, 0, offer, DepositOutcome::Settled)
    }

    /// Landlord neither returned the deposit nor proposed a split in time:
    /// the tenant takes it all. Not available once a proposal exists.
    pub fn claim_after_timeout(ctx: Context<CloseOut>) -> Result<()> {
        let lease = &ctx.accounts.lease;
        require_keys_eq!(ctx.accounts.signer.key(), lease.tenant, PorError::Unauthorized);
        require!(lease.status == LeaseStatus::Active, PorError::InvalidStatus);
        require!(lease.settlement_offer.is_none(), PorError::ProposalPending);
        require!(
            Clock::get()?.unix_timestamp > return_deadline(lease)?,
            PorError::ReturnTimeoutNotReached
        );
        let deposit = lease.deposit_amount;
        let a = &mut *ctx.accounts;
        pay_out(&a.close(), &mut a.lease, &mut a.tenant_passport, &mut a.landlord_passport, deposit, 0, deposit, DepositOutcome::TimeoutClaim)
    }

    /// Tenant marks calendar month `period` (YYYYMM, UTC) as paid on
    /// `paid_at`. Rent for a month is due by its last day. The month the
    /// lease starts in is paid at signing, so the first period is the next
    /// one. Opens 10 days before the month ends; late claims are allowed.
    pub fn claim_rent(ctx: Context<ClaimRent>, period: u32, paid_at: i64) -> Result<()> {
        let lease = &ctx.accounts.lease;
        let rent = &mut ctx.accounts.rent_payment;
        rent.lease = lease.key();
        rent.tenant = lease.tenant;
        rent.landlord = lease.landlord;
        rent.period = period;
        rent.rejections = 0;
        rent.bump = ctx.bumps.rent_payment;
        submit_rent_claim(lease, rent, paid_at)
    }

    /// Tenant resubmits a month the landlord rejected.
    pub fn reclaim_rent(ctx: Context<ReclaimRent>, paid_at: i64) -> Result<()> {
        require!(
            ctx.accounts.rent_payment.status == RentStatus::Rejected,
            PorError::InvalidStatus
        );
        submit_rent_claim(&ctx.accounts.lease, &mut ctx.accounts.rent_payment, paid_at)
    }

    /// Landlord confirms, with the date the money arrived. On time = arrived
    /// by the end of the month.
    pub fn confirm_rent(ctx: Context<ReviewRent>, received_at: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let rent = &mut ctx.accounts.rent_payment;
        review_window_open(rent, now)?;
        let (start, _) = period_bounds(rent.period)?;
        require!(received_at >= start && received_at <= now, PorError::InvalidTimeParams);
        rent.status = RentStatus::Confirmed;
        rent.received_at = received_at;
        rent.reviewed_at = now;
        Ok(())
    }

    /// Landlord says the money did not arrive. The tenant may resubmit.
    pub fn reject_rent(ctx: Context<ReviewRent>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let rent = &mut ctx.accounts.rent_payment;
        review_window_open(rent, now)?;
        rent.status = RentStatus::Rejected;
        rent.rejections = rent.rejections.saturating_add(1);
        rent.reviewed_at = now;
        Ok(())
    }

    /// Tenant rejects the proposal and escalates to the arbiter, posting a
    /// bond (5% of the deposit) into the vault. `evidence` = their statement.
    pub fn open_dispute(ctx: Context<OpenDispute>, evidence: [u8; 32]) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let a = &mut *ctx.accounts;
        require!(a.lease.status == LeaseStatus::Active, PorError::InvalidStatus);
        require!(a.lease.settlement_offer.is_some(), PorError::NoSettlementOffer);
        require!(now <= response_deadline(&a.lease)?, PorError::ResponseWindowClosed);

        let bond = dispute_bond(a.lease.deposit_amount);
        if bond > 0 {
            token::transfer_checked(
                CpiContext::new(
                    a.token_program.key(),
                    TransferChecked {
                        from: a.tenant_token.to_account_info(),
                        mint: a.mint.to_account_info(),
                        to: a.vault.to_account_info(),
                        authority: a.tenant.to_account_info(),
                    },
                ),
                bond,
                a.mint.decimals,
            )?;
        }
        let lease = &mut a.lease;
        lease.status = LeaseStatus::Disputed;
        lease.dispute_bond = bond;
        lease.disputed_at = now;
        lease.tenant_evidence = evidence;
        Ok(())
    }

    /// Either party replaces their statement while the dispute is open.
    pub fn submit_evidence(ctx: Context<SubmitEvidence>, evidence: [u8; 32]) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let lease = &mut ctx.accounts.lease;
        require!(lease.status == LeaseStatus::Disputed, PorError::InvalidStatus);
        if signer == lease.tenant {
            lease.tenant_evidence = evidence;
        } else if signer == lease.landlord {
            lease.landlord_evidence = evidence;
        } else {
            return err!(PorError::Unauthorized);
        }
        Ok(())
    }

    /// Arbiter (or admin) decides how much of the deposit the tenant gets.
    /// Tenant wins if they get more than the landlord offered: their bond is
    /// refunded and the landlord pays the same amount (from their share) to
    /// the treasury. Otherwise the tenant's bond goes to the treasury.
    pub fn resolve_dispute(ctx: Context<ResolveDispute>, to_tenant: u64) -> Result<()> {
        let a = &mut *ctx.accounts;
        let signer = a.arbiter.key();
        require!(
            signer == a.config.arbiter || signer == a.config.admin,
            PorError::Unauthorized
        );
        require!(a.lease.status == LeaseStatus::Disputed, PorError::InvalidStatus);
        require!(to_tenant <= a.lease.deposit_amount, PorError::InvalidAmount);

        let offer = a.lease.settlement_offer.ok_or(PorError::NoSettlementOffer)?;
        let bond = a.lease.dispute_bond;
        let total = a.vault.amount;
        let (tenant_gets, treasury_gets) = if to_tenant > offer {
            let landlord_share = total
                .checked_sub(to_tenant.checked_add(bond).ok_or(PorError::MathOverflow)?)
                .ok_or(PorError::MathOverflow)?;
            (to_tenant + bond, bond.min(landlord_share))
        } else {
            (to_tenant, bond)
        };

        let close = Close {
            vault: a.vault.to_account_info(),
            vault_amount: total,
            mint: a.mint.to_account_info(),
            decimals: a.mint.decimals,
            tenant_token: a.tenant_token.to_account_info(),
            landlord_token: a.landlord_token.to_account_info(),
            treasury_token: Some(a.treasury_token.to_account_info()),
            rent_receiver: a.rent_receiver.to_account_info(),
            token_program: a.token_program.to_account_info(),
        };
        pay_out(
            &close,
            &mut a.lease,
            &mut a.tenant_passport,
            &mut a.landlord_passport,
            tenant_gets,
            treasury_gets,
            to_tenant,
            DepositOutcome::ArbiterResolved,
        )
    }
}

fn submit_rent_claim(lease: &Lease, rent: &mut RentPayment, paid_at: i64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    require!(
        lease.status == LeaseStatus::Active || lease.status == LeaseStatus::Disputed,
        PorError::InvalidStatus
    );
    let (start, end) = period_bounds(rent.period)?;
    // First period is the month after the one the lease starts in.
    require!(start > lease.start_ts && start < lease.end_ts, PorError::InvalidPeriod);
    require!(now >= end - RENT_CLAIM_OPENS, PorError::RentClaimNotOpen);
    require!(paid_at >= start && paid_at <= now, PorError::InvalidTimeParams);
    rent.status = RentStatus::Claimed;
    rent.paid_at = paid_at;
    rent.claimed_at = now;
    rent.received_at = 0;
    rent.reviewed_at = 0;
    Ok(())
}

fn review_window_open(rent: &RentPayment, now: i64) -> Result<()> {
    require!(rent.status == RentStatus::Claimed, PorError::InvalidStatus);
    require!(now <= rent.claimed_at + RENT_REVIEW_WINDOW, PorError::ReviewWindowClosed);
    Ok(())
}

/// Days since 1970-01-01 for a proleptic Gregorian date (H. Hinnant).
fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let mp = (m + 9) % 12;
    let doy = (153 * mp + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

/// `[start, end)` of calendar month YYYYMM in unix seconds (UTC).
pub fn period_bounds(period: u32) -> Result<(i64, i64)> {
    let (y, m) = ((period / 100) as i64, (period % 100) as i64);
    require!((2000..=2200).contains(&y) && (1..=12).contains(&m), PorError::InvalidPeriod);
    let (ny, nm) = if m == 12 { (y + 1, 1) } else { (y, m + 1) };
    Ok((days_from_civil(y, m, 1) * DAY, days_from_civil(ny, nm, 1) * DAY))
}

fn return_deadline(lease: &Lease) -> Result<i64> {
    Ok(lease.end_ts.checked_add(lease.return_timeout).ok_or(PorError::MathOverflow)?)
}

fn response_deadline(lease: &Lease) -> Result<i64> {
    Ok(lease.proposed_at.checked_add(lease.return_timeout).ok_or(PorError::MathOverflow)?)
}

pub fn dispute_bond(deposit: u64) -> u64 {
    ((deposit as u128) * (DISPUTE_BOND_BPS as u128) / 10_000) as u64
}

/// Accounts `pay_out` moves tokens between.
struct Close<'info> {
    vault: AccountInfo<'info>,
    vault_amount: u64,
    mint: AccountInfo<'info>,
    decimals: u8,
    tenant_token: AccountInfo<'info>,
    landlord_token: AccountInfo<'info>,
    treasury_token: Option<AccountInfo<'info>>,
    rent_receiver: AccountInfo<'info>,
    token_program: AccountInfo<'info>,
}

impl<'info> CloseOut<'info> {
    fn close(&self) -> Close<'info> {
        Close {
            vault: self.vault.to_account_info(),
            vault_amount: self.vault.amount,
            mint: self.mint.to_account_info(),
            decimals: self.mint.decimals,
            tenant_token: self.tenant_token.to_account_info(),
            landlord_token: self.landlord_token.to_account_info(),
            treasury_token: None,
            rent_receiver: self.rent_receiver.to_account_info(),
            token_program: self.token_program.to_account_info(),
        }
    }
}

/// The only place tokens leave a vault. The landlord gets whatever is left
/// after `to_tenant` and `to_treasury` (actual balance, so stray dust sent to
/// the vault cannot brick closing).
fn pay_out<'info>(
    c: &Close<'info>,
    lease: &mut Box<Account<'info, Lease>>,
    tenant_passport: &mut Box<Account<'info, Passport>>,
    landlord_passport: &mut Box<Account<'info, Passport>>,
    to_tenant: u64,
    to_treasury: u64,
    award: u64,
    outcome: DepositOutcome,
) -> Result<()> {
    let to_landlord = c
        .vault_amount
        .checked_sub(to_tenant)
        .and_then(|v| v.checked_sub(to_treasury))
        .ok_or(PorError::MathOverflow)?;

    let landlord_key = lease.landlord;
    let offer_bytes = lease.offer_id.to_le_bytes();
    let bump = [lease.bump];
    let seeds: &[&[u8]] = &[LEASE_SEED, landlord_key.as_ref(), &offer_bytes, &bump];
    let signer_seeds = &[seeds];
    let authority = lease.to_account_info();

    let mut legs = vec![
        (c.tenant_token.clone(), to_tenant),
        (c.landlord_token.clone(), to_landlord),
    ];
    if let Some(treasury) = &c.treasury_token {
        legs.push((treasury.clone(), to_treasury));
    } else {
        require!(to_treasury == 0, PorError::WrongTokenAccount);
    }
    for (to, amount) in legs {
        if amount == 0 {
            continue;
        }
        token::transfer_checked(
            CpiContext::new_with_signer(
                *c.token_program.key,
                TransferChecked {
                    from: c.vault.clone(),
                    mint: c.mint.clone(),
                    to,
                    authority: authority.clone(),
                },
                signer_seeds,
            ),
            amount,
            c.decimals,
        )?;
    }

    token::close_account(CpiContext::new_with_signer(
        *c.token_program.key,
        CloseAccount {
            account: c.vault.clone(),
            destination: c.rent_receiver.clone(),
            authority,
        },
        signer_seeds,
    ))?;

    let now = Clock::get()?.unix_timestamp;
    let full = award >= lease.deposit_amount;
    let months = (lease.end_ts.saturating_sub(lease.start_ts) / SECONDS_PER_MONTH).max(0);
    let months = u32::try_from(months).map_err(|_| PorError::MathOverflow)?;

    lease.status = LeaseStatus::Closed;
    lease.outcome = outcome;
    lease.amount_to_tenant = award;
    lease.closed_at = now;

    tenant_passport.leases_completed = inc(tenant_passport.leases_completed, 1)?;
    tenant_passport.months_on_record = inc(tenant_passport.months_on_record, months)?;

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
    /// Resolves deposit disputes (the admin can too).
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
    /// sha256 of the move-in photo manifest (off-chain), set by the landlord.
    pub checkin_hash: [u8; 32],
    /// When the landlord made the settlement proposal.
    pub proposed_at: i64,
    /// Tenant's bond held in the vault while disputed.
    pub dispute_bond: u64,
    pub disputed_at: i64,
    /// sha256 of each side's statement + photos manifest (off-chain).
    pub tenant_evidence: [u8; 32],
    pub landlord_evidence: [u8; 32],
}

/// One calendar month of rent, claimed by the tenant, reviewed by the landlord.
#[account]
#[derive(InitSpace)]
pub struct RentPayment {
    pub lease: Pubkey,    // offset 8  (memcmp: a lease's months)
    pub tenant: Pubkey,   // offset 40 (memcmp: tenant record)
    pub landlord: Pubkey, // offset 72 (memcmp: landlord record)
    /// YYYYMM, UTC calendar month.
    pub period: u32,
    pub status: RentStatus,
    /// Date the tenant says they paid.
    pub paid_at: i64,
    pub claimed_at: i64,
    /// Date the landlord says the money arrived (0 until confirmed).
    pub received_at: i64,
    pub reviewed_at: i64,
    pub rejections: u8,
    pub bump: u8,
}

/// `Claimed` older than RENT_REVIEW_WINDOW counts as accepted (no objection).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum RentStatus {
    Claimed,
    Confirmed,
    Rejected,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum LeaseStatus {
    Offered,
    Rejected,
    Cancelled,
    Active,
    Closed,
    Disputed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum DepositOutcome {
    None,
    FullReturn,
    Settled,
    TimeoutClaim,
    ArbiterResolved,
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

#[derive(Accounts)]
pub struct OpenDispute<'info> {
    pub tenant: Signer<'info>,
    #[account(mut, has_one = tenant @ PorError::Unauthorized)]
    pub lease: Box<Account<'info, Lease>>,
    #[account(mut, seeds = [VAULT_SEED, lease.key().as_ref()], bump = lease.vault_bump)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(address = lease.mint @ PorError::WrongTokenAccount)]
    pub mint: Box<Account<'info, Mint>>,
    #[account(
        mut,
        constraint = tenant_token.mint == lease.mint @ PorError::WrongTokenAccount,
        constraint = tenant_token.owner == tenant.key() @ PorError::WrongTokenAccount,
    )]
    pub tenant_token: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(period: u32)]
pub struct ClaimRent<'info> {
    pub tenant: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(has_one = tenant @ PorError::Unauthorized)]
    pub lease: Box<Account<'info, Lease>>,
    #[account(
        init,
        payer = payer,
        space = 8 + RentPayment::INIT_SPACE,
        seeds = [RENT_SEED, lease.key().as_ref(), &period.to_le_bytes()],
        bump
    )]
    pub rent_payment: Account<'info, RentPayment>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReclaimRent<'info> {
    pub tenant: Signer<'info>,
    #[account(has_one = tenant @ PorError::Unauthorized)]
    pub lease: Box<Account<'info, Lease>>,
    #[account(mut, has_one = lease @ PorError::Unauthorized)]
    pub rent_payment: Account<'info, RentPayment>,
}

#[derive(Accounts)]
pub struct ReviewRent<'info> {
    pub landlord: Signer<'info>,
    #[account(mut, has_one = landlord @ PorError::Unauthorized)]
    pub rent_payment: Account<'info, RentPayment>,
}

#[derive(Accounts)]
pub struct SubmitEvidence<'info> {
    pub signer: Signer<'info>,
    #[account(mut)]
    pub lease: Account<'info, Lease>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    pub arbiter: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,
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
    #[account(
        mut,
        constraint = treasury_token.mint == lease.mint @ PorError::WrongTokenAccount,
        constraint = treasury_token.owner == config.treasury @ PorError::WrongTokenAccount,
    )]
    pub treasury_token: Box<Account<'info, TokenAccount>>,
    #[account(mut, seeds = [PASSPORT_SEED, lease.tenant.as_ref()], bump = tenant_passport.bump)]
    pub tenant_passport: Box<Account<'info, Passport>>,
    #[account(mut, seeds = [PASSPORT_SEED, lease.landlord.as_ref()], bump = landlord_passport.bump)]
    pub landlord_passport: Box<Account<'info, Passport>>,
    /// CHECK: only receives the vault's rent lamports; pinned to `lease.payer`.
    #[account(mut, address = lease.payer @ PorError::Unauthorized)]
    pub rent_receiver: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
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
    #[msg("A return proposal was already made")]
    AlreadyProposed,
    #[msg("The return window is over; the tenant can claim the full deposit")]
    ReturnWindowClosed,
    #[msg("The tenant can still respond to the proposal")]
    ResponseWindowOpen,
    #[msg("The time to respond to the proposal is over")]
    ResponseWindowClosed,
    #[msg("There is a pending return proposal")]
    ProposalPending,
    #[msg("This month is not part of the lease")]
    InvalidPeriod,
    #[msg("You can mark this month paid 10 days before it ends")]
    RentClaimNotOpen,
    #[msg("The 7-day review window is over")]
    ReviewWindowClosed,
}
