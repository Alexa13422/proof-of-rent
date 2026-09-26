# План: Anchor-програма Proof of Rent

Джерело: planner, 2026-09-26. Замінює шаблонну `anchor/programs/vault`. Продуктові рішення — [ROADMAP.md](ROADMAP.md).
Легенда: ⏳ не почато · ✅ зроблено · ❓ чекає рішення

## Перевірені факти
- `anchor-lang = "1.1.2"`, dev-залежності `litesvm = "0.10.0"`, `solana-sdk = "3"`; spl-крейтів у `Cargo.lock` немає.
- `LiteSVM::new()` уже вантажить SPL Token 3.5.0, Token-2022 і ATA. Mint і токен-акаунти в тестах ставляться
  через `spl_token_interface` + `solana_program_pack::Pack` (як у `tests/spl.rs` самого litesvm) — `litesvm-token` не потрібен.
- Час у LiteSVM: `svm.get_sysvar::<Clock>()` / `svm.set_sysvar(&clock)` / `svm.expire_blockhash()`; стан — `svm.set_account`.
- Anchor v1: `CpiContext::new(_with_signer)` приймає `Pubkey` програми; дублікати mut-акаунтів заборонені; лише один `#[error_code]`.
- На `generated/vault` посилаються: `app/components/vault-card.tsx`, `app/page.tsx` (import рядок 11, `<VaultCard />` рядок 265),
  `app/lib/errors.ts`. `app/generated/vault` закомічено.
- `anchor-spl 1.1.2` у кеші WSL немає — перша збірка потребує мережі.
- ✅ Базова збірка шаблону у WSL: 4/4 тести зелені, але чиста збірка на `/mnt/c` — **~13 хв**. Інкрементальні швидші;
  після додавання `anchor-spl` буде ще одна довга. Якщо кожен прогін триватиме хвилини — перенести репо у ФС WSL.

## 1. Перейменування vault → proof_of_rent
1. `git mv anchor/programs/vault anchor/programs/proof_of_rent`.
2. `Cargo.toml` програми: `name = "proof-of-rent"`, `[lib] name = "proof_of_rent"` (визначає `target/deploy/proof_of_rent.so`,
   `target/idl/proof_of_rent.json`, `proof_of_rent-keypair.json`).
3. `lib.rs`: `pub mod proof_of_rent`.
4. `declare_id`: після першої збірки один раз `cd anchor && anchor keys sync`, далі як зараз `--ignore-keys`.
   Тести використовують `crate::ID`, тож їм ID байдужий.
5. `Anchor.toml`: `[programs.devnet] proof_of_rent = "<новий id>"`, рядок `vault` прибрати.
6. `codama.json`: idl `./anchor/target/idl/proof_of_rent.json`, вихід `./app/generated/proof_of_rent`.
7. `tests.rs`: `include_bytes!("../../../target/deploy/proof_of_rent.so")`.
8. Фронт (крок S6, після codegen): видалити `app/components/vault-card.tsx` і `app/generated/vault/`; у `app/page.tsx`
   прибрати import і `<VaultCard />`; в `app/lib/errors.ts` замість `VAULT_ERROR_CODES` —
   `if (code >= 6000) return getProofOfRentErrorMessage(code as ProofOfRentError);` (імена звірити після codegen).

## 2. Залежності
```toml
[features]
idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]

[dependencies]
anchor-lang = "1.1.2"
anchor-spl = { version = "1.1.2", default-features = false, features = ["token"] }  # якщо не збереться — прибрати default-features

[dev-dependencies]
litesvm = "0.10.0"
solana-sdk = "3"
spl-token-interface = "2.0"
solana-program-pack = "3"
```
Лише класичний SPL Token (devnet USDC на ньому). `token_interface` — коли знадобиться EURC на Token-2022.

## 3. Акаунти
Vault — **PDA-токен-акаунт** (`seeds = [b"vault", lease]`, `token::authority = lease`), не ATA.

```rust
#[account] #[derive(InitSpace)]
pub struct Lease {
    pub tenant: Pubkey,             // offset 8  — memcmp для паспорта
    pub landlord: Pubkey,           // offset 40 — memcmp для рейтингу орендодавця
    pub arbiter: Pubkey,
    pub mint: Pubkey,
    pub payer: Pubkey,              // хто платив rent акаунтів; сюди rent vault при закритті
    pub lease_id: u64,              // обирає клієнт (напр. Date.now())
    pub deposit_amount: u64,
    pub monthly_rent: u64,          // інформативно
    pub start_ts: i64,
    pub end_ts: i64,
    pub num_months: u16,            // межа індексу RentRecord
    pub accept_deadline: i64,       // абсолютний unix ts
    pub return_timeout: i64,        // секунди після ended_at
    pub rent_objection_window: i64, // секунди після claimed_at
    pub checkin_hash: [u8; 32],
    pub checkout_hash: [u8; 32],
    pub status: LeaseStatus,
    pub outcome: DepositOutcome,
    pub settlement_offer: Option<u64>,
    pub amount_to_tenant: u64,
    pub accepted_at: i64,
    pub ended_at: i64,
    pub closed_at: i64,
    pub bump: u8,
    pub vault_bump: u8,
}
// seeds = [b"lease", tenant, lease_id.to_le_bytes()]

pub enum LeaseStatus { Pending, Active, Ended, Disputed, Closed }
pub enum DepositOutcome { None, FullReturn, Settled, ArbiterResolved, TimeoutClaim, Cancelled }

#[account] #[derive(InitSpace)]
pub struct RentRecord {
    pub lease: Pubkey,   // offset 8
    pub month: u16,
    pub status: RentStatus,
    pub claimed_at: i64,
    pub bump: u8,
}
// seeds = [b"rent", lease, month.to_le_bytes()]
pub enum RentStatus { Claimed, Confirmed, Disputed }
```
- «Без заперечень» рахує фронт: `status == Claimed && now > claimed_at + rent_objection_window`.
- Правило «від 3 місяців» — лише фронт.
- Окремий `payer: Signer` у `create_lease` і `claim_rent_paid` (fee payer платформи; у тестах/Phantom-фолбеку = tenant).
- Конфіг-акаунта немає: `arbiter` — аргумент `create_lease`, фронт підставляє `NEXT_PUBLIC_ARBITER`.

## 4. Машина станів
```
create_lease(tenant) ──► Pending ──accept_lease(landlord, now ≤ accept_deadline)──► Active
                           └─cancel_unaccepted(tenant, now > accept_deadline)──► Closed[Cancelled]

Active ──end_lease(tenant|landlord, checkout_hash)──► Ended (ended_at = now)

Ended ──release_full(landlord)─────────────────────────────────► Closed[FullReturn]
Ended ──propose_settlement(landlord, x ≤ deposit)   (перезаписує offer)
Ended ──accept_settlement(tenant, expected == offer)───────────► Closed[Settled]
Ended ──open_dispute(landlord, now ≤ ended_at+return_timeout)──► Disputed
Ended ──claim_after_timeout(tenant, now > ended_at+return_timeout)► Closed[TimeoutClaim]
Disputed ──resolve(arbiter, x ≤ deposit)───────────────────────► Closed[ArbiterResolved]

RentRecord (claim лише коли Lease = Active):
  claim_rent_paid(tenant, month < num_months) ──► Claimed
  Claimed ──confirm_rent(landlord, будь-коли)──► Confirmed
  Claimed ──dispute_rent(landlord, now ≤ claimed_at+window)──► Disputed
```
Усі виходи в `Closed` — через **одну** функцію `payout_and_close` (єдине місце, де гроші покидають vault).

## 5. Інструкції
**`create_lease(lease_id, landlord, arbiter, deposit_amount, monthly_rent, start_ts, end_ts, num_months, accept_deadline, return_timeout, rent_objection_window, checkin_hash)`**
— підписують `tenant` і `payer`. Акаунти: `lease` (init, seeds), `mint: Account<Mint>`, `tenant_token` (`token::mint = mint, token::authority = tenant`),
`vault` (init, seeds, `token::authority = lease`), `token_program`, `system_program`.
Перевірки: `deposit > 0`, `start_ts < end_ts`, `num_months > 0`, `return_timeout > 0`, `rent_objection_window > 0`, `accept_deadline > now`,
`landlord != tenant`, `arbiter ∉ {tenant, landlord}`. Ефект: поля, `Pending`, `transfer_checked(tenant_token → vault)`.

**`accept_lease(checkin_hash)`** — landlord (`has_one = landlord`). `status == Pending`, `now ≤ accept_deadline`,
`checkin_hash == lease.checkin_hash` (приймає саме ті фото). → `Active`, `accepted_at`.

**`claim_rent_paid(month)`** — tenant + payer; `rent_record` init. `status == Active`, `month < num_months`. → `Claimed`. Подвійний claim відсікає `init`.

**`confirm_rent()` / `dispute_rent()`** — landlord; `rent_record` `has_one = lease`. `status == Claimed`; для dispute ще `now ≤ claimed_at + window`.
Статус оренди не перевіряємо (заперечити можна й після `end_lease`).

**`end_lease(checkout_hash)`** — tenant **або** landlord (орендар зник → орендодавець). `status == Active`; `end_ts` не перевіряємо (дострокове, демо).
→ `Ended`, `ended_at`, `checkout_hash`.

**`propose_settlement(to_tenant)`** — landlord; `Ended`; `to_tenant ≤ deposit`. Перезаписує `settlement_offer`.

**`open_dispute()`** — landlord; `Ended`; `now ≤ ended_at + return_timeout`. → `Disputed`.
Орендар спір не відкриває: таймаут і так на його боці; інакше — ще один спосіб заморозити гроші.

**Спільні акаунти `CloseOut`** для 5 виходів: `signer`, `lease` (mut), `vault` (seeds, `bump = lease.vault_bump`), `mint` (`address = lease.mint`),
`tenant_token` / `landlord_token` (mint + owner перевіряються), `rent_receiver` (`address = lease.payer`), `token_program`.
Клієнт у ту ж транзакцію додає `createAssociatedTokenIdempotent` для обох сторін (платить fee payer); `init_if_needed` не використовуємо.
**Кожен обробник першим рядком — `require_keys_eq!(signer, lease.<роль>, Unauthorized)`.**

| Інструкція | Роль | Статус | Час | to_tenant | outcome |
|---|---|---|---|---|---|
| `release_full()` | landlord | Ended | — | усе | FullReturn |
| `accept_settlement(expected)` | tenant | Ended | — | offer; `require!(offer == Some(expected))` | Settled |
| `resolve(to_tenant)` | arbiter | Disputed | — | аргумент ≤ deposit | ArbiterResolved |
| `claim_after_timeout()` | tenant | Ended | `now > ended_at + return_timeout` | усе | TimeoutClaim |
| `cancel_unaccepted()` | tenant | Pending | `now > accept_deadline` | усе | Cancelled |

`payout_and_close(to_tenant, outcome)`: `total = vault.amount` (фактичний баланс — пил у vault не заблокує закриття) →
`to_landlord = total.checked_sub(to_tenant)` → `transfer_checked` обом (нулі пропускати; seeds `[b"lease", tenant, lease_id, bump]`) →
`close_account(vault → rent_receiver)` → `Closed`, `outcome`, `amount_to_tenant`, `closed_at`, `settlement_offer = None`.
`Lease` і `RentRecord` **ніколи не закриваються** — це дані паспорта.

## 6. Помилки
`Unauthorized`, `InvalidStatus`, `InvalidAmount`, `InvalidTimeParams`, `InvalidParties`, `AcceptDeadlinePassed`, `AcceptDeadlineNotReached`,
`CheckinHashMismatch`, `ReturnTimeoutExpired`, `ReturnTimeoutNotReached`, `NoSettlementOffer`, `SettlementMismatch`, `ObjectionWindowClosed`,
`MonthOutOfRange`, `InvalidRentStatus`, `WrongTokenAccount`, `MathOverflow`.

## 7. Безпека
- Уся арифметика `checked_*` → `MathOverflow`; `to_tenant ≤ deposit` у `propose` і `resolve`.
- Подвійна виплата: статус на вході + `Closed` і закритий vault в одній інструкції. SPL Token callback-ів не робить.
- Чужий mint/акаунт: `address = lease.mint`, mint+owner отримувачів, vault прив'язаний сідами.
- Арбітр ∉ {tenant, landlord}, tenant ≠ landlord.
- Підміна пропозиції — `accept_settlement(expected)`. Пил у vault — `vault.amount` у хелпері.
- Лише pubkey, суми, час, хеші — жодних PII.

## 8. LiteSVM-тести (`src/tests.rs`)
Обв'язка: інструкції через `crate::instruction::X { .. }.data()` + `crate::accounts::X { .. }.to_account_metas(None)`;
`struct Fx { svm, tenant, landlord, arbiter, stranger, mint, tenant_ata, landlord_ata, lease, vault }`; mint/токен-акаунти — `set_account` + `Pack`;
хелпери `send`, `warp(secs)`, `balance`, `lease_state`; годинник стартує з `1_700_000_000`; будівники `fx_pending/active/ended`;
вікна: accept +60, return_timeout 60, objection 30; депозит 3000.

1. `create_lease_ok`; `create_lease_rejects_arbiter_eq_landlord`
2. `accept_ok`; `accept_by_stranger_fails`; `accept_after_deadline_fails`; `accept_wrong_hash_fails`
3. `cancel_before_deadline_fails`; `cancel_after_deadline_ok`; `cancel_by_landlord_fails`
4. `rent_claim_confirm_ok`; `rent_claim_by_landlord_fails`; `rent_month_out_of_range_fails`; `rent_claim_twice_fails`;
   `rent_dispute_in_window_ok`; `rent_dispute_after_window_fails`; `rent_dispute_by_tenant_fails`
5. `end_lease_by_tenant_ok`; `end_lease_by_stranger_fails`; `release_before_end_fails`
6. `release_full_ok`; `release_full_by_tenant_fails`; `second_payout_fails`
7. `settlement_ok` (2500/500); `accept_settlement_mismatch_fails`; `propose_over_deposit_fails`; `accept_settlement_by_landlord_fails`
8. `dispute_resolve_ok`; `resolve_by_landlord_fails`; `open_dispute_by_tenant_fails`; `open_dispute_after_timeout_fails`; `claim_timeout_while_disputed_fails`
9. `claim_after_timeout_before_fails`; `claim_after_timeout_ok`; `claim_after_timeout_by_landlord_fails`
10. `dust_in_vault_does_not_brick`

## 9. Кроки
Контрольна точка після кожного: `wsl -d Ubuntu -- bash -lc "cd /mnt/c/Programming/SOL/proof-of-rent && NO_DNA=1 npm run anchor-test"`.

| # | Крок | ~год | Контрольна точка |
|---|---|---|---|
| ⏳ S0 | Перейменування (§1 п.1–7), порожня інструкція + smoke-тест, `anchor keys sync` | 0.75 | зелений тест, є `target/idl/proof_of_rent.json` |
| ⏳ S1 | Залежності, `Lease`, enum-и, помилки, `create_lease`, `accept_lease`, обв'язка тестів; тести 1–2 | 2.5 | anchor-test |
| ⏳ S2 | `CloseOut` + `payout_and_close`, `cancel_unaccepted`; тест 3 | 1.5 | anchor-test |
| ⏳ S3 | `end_lease`, `release_full`, `claim_after_timeout`; тести 5, 6, 9, 10 | 1.5 | anchor-test |
| ⏳ S4 | `propose_settlement`, `accept_settlement`, `open_dispute`, `resolve`; тести 7–8 | 1.5 | anchor-test |
| ⏳ S5 | `RentRecord`, `claim_rent_paid`, `confirm_rent`, `dispute_rent`; тест 4 | 1.5 | anchor-test |
| ⏳ S6 | `npm run codama:js` → `app/generated/proof_of_rent`; фронт з §1 п.8 | 0.75 | `npm run build && npm run lint` |
| ⏳ S7 | Резерв; оновити CLAUDE.md/ROADMAP.md | 1 | anchor-test + `npm run ci` |

**Якщо не встигаємо, ріжемо по черзі:** S5 цілком → закриття vault (лишити `payer`) → перевірку `checkin_hash` в `accept_lease` →
межу `num_months` → частину негативних тестів (але «чужий підписант» на кожну грошову інструкцію лишається).
**Не різати:** перевірки ролей у `CloseOut`, `expected` в `accept_settlement`, `vault.amount` у хелпері.

## 10. Відкриті рішення (у дужках — рекомендація)
- ❓ **Арбітр мовчить → гроші заблоковані назавжди.** Додати `arbiter_timeout` (параметр оренди), після якого орендар забирає кауцію —
  спір відкрив орендодавець, тягар доведення на ньому. Це новий шлях виходу грошей = зміна інваріанту. *(Так, ~30 хв.)*
- ❓ **Скасування `Pending` до дедлайну** (помилка в адресі орендодавця). *(Так — орендодавець ще нічого не прийняв.)*
- ❓ **`claim_rent_paid` після `end_lease`** (останній місяць). *(Так — дозволити і в `Ended`.)*
- ❓ **Правило 3 місяців на демо.** *(Засіяти на devnet 2–3 історичні оренди з минулими датами; поруч показувати on-chain `accepted_at`/`closed_at`.)*
- ❓ **Keypair програми** лише в gitignored `target/`. *(Скопіювати в `~/keys/` у WSL до першого деплою.)*
- Privy fee payer ще не підтверджений spike-ом; план з окремим `payer` працює в обох варіантах.
- Ризики, які перевірить лише збірка: сумісність `Pubkey`/`Address` між `anchor-lang 1.1.2` і `solana-sdk 3`;
  `anchor-spl` з `default-features = false`; чи Codama 1.5.3 правильно генерує PDA з сідом-аргументом `lease_id` і `Option<u64>`.
