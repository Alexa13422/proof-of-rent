//! LiteSVM tests. Build first: `anchor build --ignore-keys`, then `cargo test`.

use crate::{accounts, instruction, DepositOutcome, Lease, LeaseStatus, Passport, ID as PROGRAM_ID};
use anchor_lang::{AccountDeserialize, InstructionData, ToAccountMetas};
use litesvm::LiteSVM;
use solana_program_pack::Pack;
use solana_sdk::{
    account::Account,
    clock::Clock,
    instruction::Instruction,
    pubkey::Pubkey,
    signature::Keypair,
    signer::Signer,
    transaction::Transaction,
};
use spl_token_interface::state::{Account as TokenAccountState, AccountState, Mint as MintState};

const T0: i64 = 1_700_000_000;
const DEPOSIT: u64 = 3_000_000_000; // 3000 tokens, 6 decimals
const FEE_BPS: u16 = 100; // 1%
const FEE: u64 = DEPOSIT / 100;
const MONTH: i64 = crate::SECONDS_PER_MONTH;

fn token_program() -> Pubkey {
    spl_token_interface::ID
}
fn system_program() -> Pubkey {
    anchor_lang::system_program::ID
}

struct Fx {
    svm: LiteSVM,
    payer: Keypair,
    admin: Keypair,
    landlord: Keypair,
    tenant: Keypair,
    stranger: Keypair,
    treasury: Pubkey,
    mint: Pubkey,
    tenant_token: Pubkey,
    landlord_token: Pubkey,
    treasury_token: Pubkey,
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &PROGRAM_ID).0
}
fn config_pda() -> Pubkey {
    pda(&[crate::CONFIG_SEED])
}
fn passport_pda(owner: &Pubkey) -> Pubkey {
    pda(&[crate::PASSPORT_SEED, owner.as_ref()])
}
fn lease_pda(landlord: &Pubkey, offer_id: u64) -> Pubkey {
    pda(&[crate::LEASE_SEED, landlord.as_ref(), &offer_id.to_le_bytes()])
}
fn vault_pda(lease: &Pubkey) -> Pubkey {
    pda(&[crate::VAULT_SEED, lease.as_ref()])
}

impl Fx {
    fn new() -> Self {
        let mut svm = LiteSVM::new();
        svm.add_program(PROGRAM_ID, include_bytes!("../../../target/deploy/proof_of_rent.so"))
            .unwrap();
        let mut clock = svm.get_sysvar::<Clock>();
        clock.unix_timestamp = T0;
        svm.set_sysvar(&clock);

        let payer = Keypair::new();
        let admin = Keypair::new();
        let landlord = Keypair::new();
        let tenant = Keypair::new();
        let stranger = Keypair::new();
        let treasury = Pubkey::new_unique();
        for k in [&payer, &admin] {
            svm.airdrop(&k.pubkey(), 10_000_000_000).unwrap();
        }

        let mint = Pubkey::new_unique();
        let mut fx = Fx {
            svm,
            payer,
            admin,
            landlord,
            tenant,
            stranger,
            treasury,
            mint,
            tenant_token: Pubkey::new_unique(),
            landlord_token: Pubkey::new_unique(),
            treasury_token: Pubkey::new_unique(),
        };
        fx.put_mint();
        let (t, l, tr) = (fx.tenant.pubkey(), fx.landlord.pubkey(), fx.treasury);
        fx.put_token_account(fx.tenant_token, t, 10_000_000_000);
        fx.put_token_account(fx.landlord_token, l, 0);
        fx.put_token_account(fx.treasury_token, tr, 0);

        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::InitConfig {
                admin: fx.admin.pubkey(),
                config: config_pda(),
                system_program: system_program(),
            }
            .to_account_metas(None),
            data: instruction::InitConfig { treasury: tr, arbiter: Pubkey::new_unique(), fee_bps: FEE_BPS }.data(),
        };
        let admin = fx.admin.insecure_clone();
        fx.send(ix, &[&admin]).unwrap();
        fx
    }

    fn put_mint(&mut self) {
        let mut data = vec![0u8; MintState::LEN];
        MintState {
            mint_authority: Some(Pubkey::new_unique()).into(),
            supply: u64::MAX / 2,
            decimals: 6,
            is_initialized: true,
            freeze_authority: None.into(),
        }
        .pack_into_slice(&mut data);
        self.set_account(self.mint, data, token_program());
    }

    fn put_token_account(&mut self, address: Pubkey, owner: Pubkey, amount: u64) {
        let mut data = vec![0u8; TokenAccountState::LEN];
        TokenAccountState {
            mint: self.mint,
            owner,
            amount,
            delegate: None.into(),
            state: AccountState::Initialized,
            is_native: None.into(),
            delegated_amount: 0,
            close_authority: None.into(),
        }
        .pack_into_slice(&mut data);
        self.set_account(address, data, token_program());
    }

    fn set_account(&mut self, address: Pubkey, data: Vec<u8>, owner: Pubkey) {
        let lamports = self.svm.minimum_balance_for_rent_exemption(data.len());
        self.svm
            .set_account(address, Account { lamports, data, owner, executable: false, rent_epoch: 0 })
            .unwrap();
    }

    /// The platform fee payer always pays; `signers` are the user signatures.
    fn send(&mut self, ix: Instruction, signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let mut all: Vec<&Keypair> = vec![&self.payer];
        all.extend_from_slice(signers);
        let tx = Transaction::new_signed_with_payer(
            &[ix],
            Some(&self.payer.pubkey()),
            &all,
            self.svm.latest_blockhash(),
        );
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?}\n{}", e.err, e.meta.logs.join("\n")))
    }

    fn warp(&mut self, secs: i64) {
        let mut clock = self.svm.get_sysvar::<Clock>();
        clock.unix_timestamp += secs;
        self.svm.set_sysvar(&clock);
    }

    fn balance(&self, token_account: &Pubkey) -> u64 {
        let acc = self.svm.get_account(token_account).unwrap();
        TokenAccountState::unpack(&acc.data).unwrap().amount
    }

    fn lease(&self, key: &Pubkey) -> Lease {
        let acc = self.svm.get_account(key).unwrap();
        Lease::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    fn passport(&self, owner: &Pubkey) -> Passport {
        let acc = self.svm.get_account(&passport_pda(owner)).unwrap();
        Passport::try_deserialize(&mut acc.data.as_slice()).unwrap()
    }

    fn create_passport(&mut self, owner: &Keypair) -> Result<(), String> {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::CreatePassport {
                owner: owner.pubkey(),
                payer: self.payer.pubkey(),
                passport: passport_pda(&owner.pubkey()),
                system_program: system_program(),
            }
            .to_account_metas(None),
            data: instruction::CreatePassport {}.data(),
        };
        self.send(ix, &[owner])
    }

    fn create_offer_as(&mut self, signer: &Keypair, offer_id: u64, tenant: Pubkey) -> Result<Pubkey, String> {
        let lease = lease_pda(&signer.pubkey(), offer_id);
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::CreateOffer {
                landlord: signer.pubkey(),
                payer: self.payer.pubkey(),
                config: config_pda(),
                landlord_passport: passport_pda(&signer.pubkey()),
                tenant_passport: passport_pda(&tenant),
                mint: self.mint,
                lease,
                system_program: system_program(),
            }
            .to_account_metas(None),
            data: instruction::CreateOffer {
                offer_id,
                tenant,
                deposit_amount: DEPOSIT,
                monthly_rent: 1_500_000_000,
                start_ts: T0,
                end_ts: T0 + 3 * MONTH,
                accept_deadline: T0 + 60,
                return_timeout: 60,
                area: "Warsaw · Mokotów".to_string(),
            }
            .data(),
        };
        self.send(ix, &[signer]).map(|_| lease)
    }

    /// Both passports + an open offer.
    fn offered() -> (Self, Pubkey) {
        let mut fx = Fx::new();
        let (l, t) = (fx.landlord.insecure_clone(), fx.tenant.insecure_clone());
        fx.create_passport(&l).unwrap();
        fx.create_passport(&t).unwrap();
        let lease = fx.create_offer_as(&l, 1, t.pubkey()).unwrap();
        (fx, lease)
    }

    fn respond(&mut self, signer: &Keypair, lease: Pubkey, reject: bool) -> Result<(), String> {
        let accounts = accounts::RespondOffer { signer: signer.pubkey(), lease }.to_account_metas(None);
        let data = if reject { instruction::RejectOffer {}.data() } else { instruction::CancelOffer {}.data() };
        self.send(Instruction { program_id: PROGRAM_ID, accounts, data }, &[signer])
    }

    fn accept_as(&mut self, signer: &Keypair, lease: Pubkey) -> Result<(), String> {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::AcceptOffer {
                tenant: signer.pubkey(),
                payer: self.payer.pubkey(),
                config: config_pda(),
                lease,
                mint: self.mint,
                tenant_token: self.tenant_token,
                vault: vault_pda(&lease),
                treasury_token: self.treasury_token,
                token_program: token_program(),
                system_program: system_program(),
            }
            .to_account_metas(None),
            data: instruction::AcceptOffer {}.data(),
        };
        self.send(ix, &[signer])
    }

    fn active() -> (Self, Pubkey) {
        let (mut fx, lease) = Fx::offered();
        let t = fx.tenant.insecure_clone();
        fx.accept_as(&t, lease).unwrap();
        (fx, lease)
    }

    fn close_out(&mut self, signer: &Keypair, lease: Pubkey, data: Vec<u8>) -> Result<(), String> {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::CloseOut {
                signer: signer.pubkey(),
                lease,
                vault: vault_pda(&lease),
                mint: self.mint,
                tenant_token: self.tenant_token,
                landlord_token: self.landlord_token,
                tenant_passport: passport_pda(&self.tenant.pubkey()),
                landlord_passport: passport_pda(&self.landlord.pubkey()),
                rent_receiver: self.payer.pubkey(),
                token_program: token_program(),
            }
            .to_account_metas(None),
            data,
        };
        self.send(ix, &[signer])
    }

    fn propose(&mut self, signer: &Keypair, lease: Pubkey, to_tenant: u64) -> Result<(), String> {
        let ix = Instruction {
            program_id: PROGRAM_ID,
            accounts: accounts::ProposeSettlement { landlord: signer.pubkey(), lease }.to_account_metas(None),
            data: instruction::ProposeSettlement { to_tenant }.data(),
        };
        self.send(ix, &[signer])
    }
}

// ------------------------------------------------------------ passports

#[test]
fn passport_create_ok_and_only_once() {
    let mut fx = Fx::new();
    let t = fx.tenant.insecure_clone();
    fx.create_passport(&t).unwrap();
    let p = fx.passport(&t.pubkey());
    assert_eq!(p.owner, t.pubkey());
    assert_eq!(p.created_at, T0);
    assert_eq!(p.leases_completed, 0);
    assert!(fx.create_passport(&t).is_err(), "second passport must fail");
}

// ------------------------------------------------------------ offers

#[test]
fn offer_create_ok_with_fee() {
    let (fx, lease) = Fx::offered();
    let l = fx.lease(&lease);
    assert_eq!(l.status, LeaseStatus::Offered);
    assert_eq!(l.landlord, fx.landlord.pubkey());
    assert_eq!(l.tenant, fx.tenant.pubkey());
    assert_eq!(l.fee_amount, FEE);
    assert_eq!(l.area, "Warsaw · Mokotów");
}

#[test]
fn offer_requires_tenant_passport() {
    let mut fx = Fx::new();
    let l = fx.landlord.insecure_clone();
    fx.create_passport(&l).unwrap();
    let tenant = fx.tenant.pubkey();
    assert!(fx.create_offer_as(&l, 1, tenant).is_err());
}

#[test]
fn offer_to_self_fails() {
    let mut fx = Fx::new();
    let l = fx.landlord.insecure_clone();
    fx.create_passport(&l).unwrap();
    assert!(fx.create_offer_as(&l, 1, l.pubkey()).is_err());
}

#[test]
fn reject_by_tenant_then_new_offer() {
    let (mut fx, lease) = Fx::offered();
    let (l, t) = (fx.landlord.insecure_clone(), fx.tenant.insecure_clone());
    fx.respond(&t, lease, true).unwrap();
    assert_eq!(fx.lease(&lease).status, LeaseStatus::Rejected);
    assert!(fx.accept_as(&t, lease).is_err(), "rejected offer cannot be accepted");
    let revised = fx.create_offer_as(&l, 2, t.pubkey()).unwrap();
    fx.accept_as(&t, revised).unwrap();
}

#[test]
fn reject_by_landlord_or_stranger_fails() {
    let (mut fx, lease) = Fx::offered();
    let (l, s) = (fx.landlord.insecure_clone(), fx.stranger.insecure_clone());
    assert!(fx.respond(&l, lease, true).is_err());
    assert!(fx.respond(&s, lease, true).is_err());
}

#[test]
fn cancel_by_landlord_ok_by_tenant_fails() {
    let (mut fx, lease) = Fx::offered();
    let (l, t) = (fx.landlord.insecure_clone(), fx.tenant.insecure_clone());
    assert!(fx.respond(&t, lease, false).is_err());
    fx.respond(&l, lease, false).unwrap();
    assert_eq!(fx.lease(&lease).status, LeaseStatus::Cancelled);
}

#[test]
fn accept_moves_deposit_and_fee() {
    let (fx, lease) = Fx::active();
    let l = fx.lease(&lease);
    assert_eq!(l.status, LeaseStatus::Active);
    assert_eq!(l.accepted_at, T0);
    assert_eq!(fx.balance(&vault_pda(&lease)), DEPOSIT);
    assert_eq!(fx.balance(&fx.treasury_token), FEE);
    assert_eq!(fx.balance(&fx.tenant_token), 10_000_000_000 - DEPOSIT - FEE);
}

#[test]
fn accept_by_stranger_fails() {
    let (mut fx, lease) = Fx::offered();
    let s = fx.stranger.insecure_clone();
    assert!(fx.accept_as(&s, lease).is_err());
}

#[test]
fn accept_after_deadline_fails() {
    let (mut fx, lease) = Fx::offered();
    let t = fx.tenant.insecure_clone();
    fx.warp(61);
    assert!(fx.accept_as(&t, lease).is_err());
}

#[test]
fn accept_twice_fails() {
    let (mut fx, lease) = Fx::active();
    let t = fx.tenant.insecure_clone();
    assert!(fx.accept_as(&t, lease).is_err());
}

#[test]
fn accept_with_wrong_treasury_fails() {
    let (mut fx, lease) = Fx::offered();
    let t = fx.tenant.insecure_clone();
    fx.treasury_token = fx.landlord_token; // landlord tries to collect the fee
    assert!(fx.accept_as(&t, lease).is_err());
}

// ------------------------------------------------------------ payouts

#[test]
fn release_full_updates_passports() {
    let (mut fx, lease) = Fx::active();
    let l = fx.landlord.insecure_clone();
    fx.close_out(&l, lease, instruction::ReleaseFull {}.data()).unwrap();
    let state = fx.lease(&lease);
    assert_eq!(state.status, LeaseStatus::Closed);
    assert_eq!(state.outcome, DepositOutcome::FullReturn);
    assert_eq!(fx.balance(&fx.tenant_token), 10_000_000_000 - FEE);
    assert!(fx.svm.get_account(&vault_pda(&lease)).map_or(true, |a| a.lamports == 0));
    let tp = fx.passport(&fx.tenant.pubkey());
    assert_eq!((tp.leases_completed, tp.returned_in_full, tp.months_on_record), (1, 1, 3));
    let lp = fx.passport(&l.pubkey());
    assert_eq!((lp.landlord_leases_closed, lp.landlord_full_returns), (1, 1));
}

#[test]
fn release_full_by_tenant_fails_and_twice_fails() {
    let (mut fx, lease) = Fx::active();
    let (l, t) = (fx.landlord.insecure_clone(), fx.tenant.insecure_clone());
    assert!(fx.close_out(&t, lease, instruction::ReleaseFull {}.data()).is_err());
    fx.close_out(&l, lease, instruction::ReleaseFull {}.data()).unwrap();
    assert!(fx.close_out(&l, lease, instruction::ReleaseFull {}.data()).is_err());
}

#[test]
fn release_before_accept_fails() {
    let (mut fx, lease) = Fx::offered();
    let l = fx.landlord.insecure_clone();
    assert!(fx.close_out(&l, lease, instruction::ReleaseFull {}.data()).is_err());
}

#[test]
fn settlement_ok() {
    let (mut fx, lease) = Fx::active();
    let (l, t) = (fx.landlord.insecure_clone(), fx.tenant.insecure_clone());
    let to_tenant = 2_500_000_000;
    fx.propose(&l, lease, to_tenant).unwrap();
    fx.close_out(&t, lease, instruction::AcceptSettlement { expected_to_tenant: to_tenant }.data())
        .unwrap();
    assert_eq!(fx.lease(&lease).outcome, DepositOutcome::Settled);
    assert_eq!(fx.balance(&fx.landlord_token), DEPOSIT - to_tenant);
    let tp = fx.passport(&t.pubkey());
    assert_eq!((tp.leases_completed, tp.returned_in_full), (1, 0));
}

#[test]
fn settlement_guards() {
    let (mut fx, lease) = Fx::active();
    let (l, t) = (fx.landlord.insecure_clone(), fx.tenant.insecure_clone());
    assert!(fx.propose(&l, lease, DEPOSIT + 1).is_err(), "over deposit");
    assert!(fx.propose(&t, lease, 1).is_err(), "tenant cannot propose");
    fx.propose(&l, lease, 2_000_000_000).unwrap();
    assert!(fx
        .close_out(&t, lease, instruction::AcceptSettlement { expected_to_tenant: 2_500_000_000 }.data())
        .is_err(), "mismatch");
    assert!(fx
        .close_out(&l, lease, instruction::AcceptSettlement { expected_to_tenant: 2_000_000_000 }.data())
        .is_err(), "landlord cannot accept");
}

#[test]
fn claim_after_timeout() {
    let (mut fx, lease) = Fx::active();
    let (l, t) = (fx.landlord.insecure_clone(), fx.tenant.insecure_clone());
    assert!(fx.close_out(&t, lease, instruction::ClaimAfterTimeout {}.data()).is_err(), "too early");
    fx.warp(3 * MONTH + 61);
    assert!(fx.close_out(&l, lease, instruction::ClaimAfterTimeout {}.data()).is_err(), "landlord");
    fx.close_out(&t, lease, instruction::ClaimAfterTimeout {}.data()).unwrap();
    assert_eq!(fx.lease(&lease).outcome, DepositOutcome::TimeoutClaim);
}

#[test]
fn dust_in_vault_does_not_brick() {
    let (mut fx, lease) = Fx::active();
    let l = fx.landlord.insecure_clone();
    let vault = vault_pda(&lease);
    let mut acc = fx.svm.get_account(&vault).unwrap();
    let mut state = TokenAccountState::unpack(&acc.data).unwrap();
    state.amount += 7;
    state.pack_into_slice(&mut acc.data);
    fx.svm.set_account(vault, acc).unwrap();
    fx.close_out(&l, lease, instruction::ReleaseFull {}.data()).unwrap();
    assert_eq!(fx.balance(&fx.landlord_token), 7);
}
