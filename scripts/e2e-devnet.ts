// End-to-end devnet smoke test of the full lease flow, with throwaway
// keypairs standing in for the two Privy users. Fee payer = platform key.
// Run: npx tsx scripts/e2e-devnet.ts
import { readFileSync } from "node:fs";
import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  getBase64EncodedWireTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getMintToInstruction,
} from "@solana-program/token";
import { findPassportPda } from "../app/generated/proof_of_rent/pdas/passport.ts";
import { findLeasePda } from "../app/generated/proof_of_rent/pdas/lease.ts";
import { fetchLease } from "../app/generated/proof_of_rent/accounts/lease.ts";
import { fetchPassport } from "../app/generated/proof_of_rent/accounts/passport.ts";
import { fetchConfig } from "../app/generated/proof_of_rent/accounts/config.ts";
import { findConfigPda } from "../app/generated/proof_of_rent/pdas/config.ts";
import { getCreatePassportInstructionAsync } from "../app/generated/proof_of_rent/instructions/createPassport.ts";
import { getCreateOfferInstructionAsync } from "../app/generated/proof_of_rent/instructions/createOffer.ts";
import { getRejectOfferInstruction } from "../app/generated/proof_of_rent/instructions/rejectOffer.ts";
import { getAcceptOfferInstructionAsync } from "../app/generated/proof_of_rent/instructions/acceptOffer.ts";
import { getProposeSettlementInstruction } from "../app/generated/proof_of_rent/instructions/proposeSettlement.ts";
import { getAcceptSettlementInstructionAsync } from "../app/generated/proof_of_rent/instructions/acceptSettlement.ts";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const MINT = env.NEXT_PUBLIC_DEPOSIT_MINT as Address;
const rpc = createSolanaRpc("https://api.devnet.solana.com");
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.devnet.solana.com"),
});

const feePayer = await createKeyPairSignerFromBytes(
  new Uint8Array(JSON.parse(env.FEE_PAYER_SECRET_KEY))
);

async function send(label: string, instructions: Instruction[]) {
  await new Promise((r) => setTimeout(r, 2500)); // public devnet RPC rate limit
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const tx = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(feePayer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m)
    )
  );
  const sim = await rpc
    .simulateTransaction(getBase64EncodedWireTransaction(tx), {
      encoding: "base64",
      sigVerify: true,
    })
    .send();
  if (sim.value.err) {
    console.error(sim.value.logs?.join("\n"));
    throw new Error(`${label}: simulation failed`);
  }
  await sendAndConfirm(tx as Parameters<typeof sendAndConfirm>[0], {
    commitment: "confirmed",
  });
  console.log(`✓ ${label}`);
}

const ata = async (owner: Address) =>
  (await findAssociatedTokenPda({ mint: MINT, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];
const balance = async (owner: Address) => (await fetchToken(rpc, await ata(owner))).data.amount;

async function onboard(user: KeyPairSigner) {
  await send("create passport + starter tokens", [
    await getCreatePassportInstructionAsync({ owner: user, payer: feePayer }),
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: feePayer, mint: MINT, owner: user.address }),
    getMintToInstruction({ mint: MINT, token: await ata(user.address), mintAuthority: feePayer, amount: 20_000_000_000n }),
  ]);
}

const landlord = await generateKeyPairSigner();
const tenant = await generateKeyPairSigner();
console.log("landlord", landlord.address, "\ntenant  ", tenant.address);
await onboard(landlord);
await onboard(tenant);

const config = (await fetchConfig(rpc, (await findConfigPda())[0])).data;
const now = BigInt(Math.floor(Date.now() / 1000));
const MONTH = 30n * 24n * 3600n;

async function offer(offerId: bigint, deposit: bigint) {
  await send(`create offer #${offerId}`, [
    await getCreateOfferInstructionAsync({
      landlord,
      payer: feePayer,
      mint: MINT,
      offerId,
      tenant: tenant.address,
      depositAmount: deposit,
      monthlyRent: 3_200_000_000n,
      startTs: now - 12n * MONTH,
      endTs: now + 60n,
      acceptDeadline: now + 3600n,
      returnTimeout: 60n,
      area: "Warsaw · Mokotów",
    }),
  ]);
  return (await findLeasePda({ landlord: landlord.address, offerId }))[0];
}

// 1. Tenant rejects the first offer; landlord sends a revised one.
const first = await offer(1n, 8_000_000_000n);
await send("tenant rejects offer #1", [getRejectOfferInstruction({ signer: tenant, lease: first })]);
const lease = await offer(2n, 6_400_000_000n);

// 2. Tenant accepts: deposit to escrow + fee to treasury.
const before = await balance(tenant.address);
await send("tenant accepts offer #2 (deposit + fee)", [
  await getAcceptOfferInstructionAsync({
    tenant,
    payer: feePayer,
    lease,
    mint: MINT,
    tenantToken: await ata(tenant.address),
    treasuryToken: await ata(config.treasury),
  }),
]);
const leaseData = (await fetchLease(rpc, lease)).data;
console.log(`  paid ${before - (await balance(tenant.address))} (deposit ${leaseData.depositAmount} + fee ${leaseData.feeAmount})`);

// 3. Move-out: landlord proposes 5 800, tenant accepts.
await send("landlord proposes 5 800 back", [
  getProposeSettlementInstruction({ landlord, lease, toTenant: 5_800_000_000n }),
]);
const [tenantPassport] = await findPassportPda({ owner: tenant.address });
const [landlordPassport] = await findPassportPda({ owner: landlord.address });
await send("tenant accepts settlement", [
  await getAcceptSettlementInstructionAsync({
    signer: tenant,
    lease,
    mint: MINT,
    tenantToken: await ata(tenant.address),
    landlordToken: await ata(landlord.address),
    tenantPassport,
    landlordPassport,
    rentReceiver: feePayer.address,
    expectedToTenant: 5_800_000_000n,
  }),
]);

const final = (await fetchLease(rpc, lease)).data;
const tp = (await fetchPassport(rpc, tenantPassport)).data;
const lp = (await fetchPassport(rpc, landlordPassport)).data;
console.log("lease status", final.status, "outcome", final.outcome, "to tenant", final.amountToTenant);
console.log("tenant passport", { leases: tp.leasesCompleted, full: tp.returnedInFull, months: tp.monthsOnRecord });
console.log("landlord passport", { closed: lp.landlordLeasesClosed, full: lp.landlordFullReturns });
console.log("landlord balance", await balance(landlord.address));
console.log(`\npassport: http://localhost:3000/passport/${tenant.address}`);
