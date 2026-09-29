<div align="center">

# Proof of Rent

### Your rent history. Your proof.

A privacy-first rental passport for tenants and landlords — built on Solana.

[![Status: In development](https://img.shields.io/badge/status-in%20development-f59e0b?style=for-the-badge)](https://github.com/Alexa13422/proof-of-rent)
[![Solana](https://img.shields.io/badge/Solana-devnet-9945FF?style=for-the-badge&logo=solana&logoColor=white)](https://explorer.solana.com/address/AqMUqWYHuFNdY5s78wX52BF3fKkaQVTPT4UsAvcgsuba?cluster=devnet)
[![Next.js](https://img.shields.io/badge/Next.js-16-111111?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![License](https://img.shields.io/badge/license-TBD-64748b?style=for-the-badge)](#license)

<br />

**A bank can show that you paid. Proof of Rent shows how the tenancy ended.**

[Launch demo](#quick-start) · [Explore the program](#on-chain-program) · [See the roadmap](#roadmap)

</div>

---

## The problem

Renters often have no portable, credible rental history — especially when moving to a new country. Landlords, in turn, have little evidence that a new tenant returned a previous home responsibly.

A bank statement can show a transfer. It cannot show whether the deposit was returned, whether a disagreement was resolved, or whether both sides kept their word.

## The idea

**Proof of Rent is a verifiable history of completed tenancies.**

Each lease can produce a durable outcome such as:

- deposit returned in full;
- deposit partially returned by mutual settlement;
- deposit resolved through arbitration; or
- deposit claimed after a party missed the response deadline.

Those outcomes form a shareable **rental passport**. It is not a credit score and it does not publish a person’s identity, address, bank details, or private documents.

> **Proof of Rent does not replace a rental contract, a bank, or legal advice. It is an open-source prototype for verifiable rental outcomes.**

---

## Why it is different

|                    | What Proof of Rent adds                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| **For tenants**    | A portable record that can make the next rental application easier, without handing over private documents.             |
| **For landlords**  | Evidence based on how previous leases actually ended — not an unverifiable screenshot or self-reported claim.           |
| **For both sides** | Deposit escrow with explicit rules, deadlines, settlement, and a dispute-resolution path.                               |
| **For privacy**    | On-chain records contain parties, amounts, timestamps, status, and hashes — not photos, names, addresses, or documents. |
| **For developers** | A real Anchor program, generated type-safe client, LiteSVM tests, and a Next.js application in one repository.          |

### The core advantages

- **Low-friction deposit flow** — the UI is designed around a simple checkout experience; the prototype includes a BLIK-style flow while the on-chain layer settles the escrowed token deposit.
- **Money moves by rules, not by trust** — the vault is controlled by the lease program, and every payout path is explicit.
- **Timeouts prevent indefinite silence** — if the responsible party does not act within the configured window, the protocol exposes a deterministic next step.
- **Two-sided monthly confirmations** — a tenant marks rent as paid and the landlord can confirm or reject it. Silence becomes a visible “no objection” record after the review window, rather than an invisible off-chain conversation.
- **Evidence without exposing evidence** — check-in, settlement, dispute, and statement files can stay off-chain; only their SHA-256 hashes are anchored on-chain.
- **Trust in both directions** — tenants build a rental passport and landlords can build a return/confirmation history too.
- **No crypto expertise required in the product vision** — Google sign-in via Privy and platform-paid transaction fees are intended to hide wallet friction from ordinary users.

> The BLIK payment UI is currently a prototype/demo flow. Real payment-provider settlement, custody, KYC/AML, and jurisdiction-specific compliance are not claimed as complete.

---

## How it works

```text
1. Create a passport
        ↓
2. Landlord creates a lease offer
        ↓
3. Tenant accepts and locks the deposit in escrow
        ↓
4. Monthly payment records are claimed and confirmed
        ↓
5. Lease ends: full return, settlement, timeout, or dispute
        ↓
6. The outcome becomes part of both parties’ on-chain history
```

### Deposit lifecycle

```text
Offered ──accept──▶ Active ──close──▶ Full return
                       │              Settlement
                       │              Timeout claim
                       └─dispute────▶ Arbiter resolution
```

The program centralizes payout logic so the deposit leaves the vault only through a controlled close-out path. A landlord can return the full deposit or propose a partial settlement. A tenant can accept the exact proposal or use the timeout/dispute flow defined by the program.

---

## What is implemented

### Product

- Google/Privy sign-in and embedded Solana wallet flow
- Tenant and landlord dashboards
- Public rental passports with shareable URLs
- Lease offers: create, accept, reject, and cancel
- Deposit escrow and payout flows on Solana devnet
- Full return, partial settlement, timeout claim, and dispute interfaces
- Monthly rent records with tenant claim and landlord confirmation/rejection
- Evidence upload flow with content hashes
- Open disputes view
- Light/dark theme and responsive UI

### Protocol

- `Passport` PDA: one durable history account per user
- `Lease` PDA: terms, escrow state, outcome, deadlines, and evidence hashes
- `RentPayment` PDA: one record per lease/month
- Token-agnostic lease mint field; current demo uses a devnet test token
- Fee cap enforced on-chain (`MAX_FEE_BPS = 10%`)
- Role checks for tenant, landlord, admin, and arbiter
- Checked arithmetic and explicit state transitions
- Generated TypeScript client via Codama
- LiteSVM program tests

> The devnet program is currently deployed at [`AqMUqWYHuFNdY5s78wX52BF3fKkaQVTPT4UsAvcgsuba`](https://explorer.solana.com/address/AqMUqWYHuFNdY5s78wX52BF3fKkaQVTPT4UsAvcgsuba?cluster=devnet). Devnet data and program behavior may change while the project is under active development.

---

## Architecture

```text
Next.js app → generated @solana/kit client → Proof of Rent Anchor program → Solana devnet

Private evidence / photos → off-chain storage
                         ↘ SHA-256 hash anchored on-chain
```

### Privacy model

The protocol is intentionally minimal on-chain. It stores the information needed to verify a lease outcome, while documents and media remain off-chain. A public passport is a verification surface, not a document locker.

This is a technical privacy design, **not a legal compliance certification**. Production deployment would still require a privacy review, retention policy, consent model, and jurisdiction-specific analysis.

---

## Quick start

### Prerequisites

- Node.js 20+
- npm
- Rust and Cargo
- Solana CLI
- Anchor CLI

```bash
git clone https://github.com/Alexa13422/proof-of-rent.git
cd proof-of-rent
npm install
npm run setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Useful commands

| Command                         | Purpose                                            |
| ------------------------------- | -------------------------------------------------- |
| `npm run dev`                   | Start the Next.js development server               |
| `npm run build`                 | Create a production build                          |
| `npm run lint`                  | Run ESLint                                         |
| `npm run format:check`          | Check Prettier formatting                          |
| `npm run setup`                 | Build the program and regenerate the Codama client |
| `npm run anchor-test`           | Build and run Rust/LiteSVM tests                   |
| `npm run ci`                    | Build, lint, and format-check the project          |
| `npx tsx scripts/e2e-devnet.ts` | Run the devnet end-to-end flow                     |

### Local validator

```bash
solana-test-validator
solana config set --url localhost
cd anchor && anchor build && anchor deploy
cd .. && npm run codama:js && npm run dev
```

---

## Repository map

```text
app/                         # Next.js UI, API routes, passports, disputes
anchor/programs/proof_of_rent/ # Anchor program and LiteSVM tests
scripts/                     # Devnet setup, E2E, and utility scripts
```

## Roadmap

- [x] Passport accounts and public passport pages
- [x] Lease offers and deposit escrow on devnet
- [x] Full return, partial settlement, and timeout paths
- [x] Monthly payment records and review window
- [x] Evidence hashes and dispute data model
- [x] Privy-based sign-in prototype
- [ ] Production payment-provider integration
- [ ] Production-grade encrypted evidence storage
- [ ] Independent arbiter marketplace and arbiter timeout guarantees
- [ ] Selective disclosure (for example: “12 months, no disputes” without amounts)
- [ ] KYC/identity and landlord-verification integrations
- [ ] Polish and Ukrainian localization
- [ ] Security audit and production compliance review

The project is in active development. Interfaces, program rules, and devnet data can change without backwards compatibility.

## Security and responsible use

- Never use the devnet demo for real funds or real identity documents.
- Do not upload sensitive personal data to the prototype evidence flow.
- The program has not yet received an independent security audit.
- Smart-contract correctness does not establish legal enforceability of a lease or arbitration decision.
- Before production use, payment custody, consumer protection, GDPR/data retention, and local rental law must be reviewed with qualified professionals.

Found a security issue? Please do not open a public issue with exploitable details. Contact the maintainer privately first.

## Contributing

Issues and pull requests are welcome while the protocol and UX are being shaped. For substantial changes, open an issue first and describe the user problem, protocol impact, and test plan.

## License

A production license has not been selected yet. Until a license is added to the repository, all rights are reserved.

---

<div align="center">

**Proof of Rent** · Open rental history, without exposing private life.

</div>
