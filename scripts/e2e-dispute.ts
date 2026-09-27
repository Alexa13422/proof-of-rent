// Devnet e2e of the dispute flow with throwaway users; the arbiter is
// whatever key config.arbiter is (the fee payer on devnet).
// Run: npx tsx scripts/e2e-dispute.ts
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
import { fetchConfig } from "../app/generated/proof_of_rent/accounts/config.ts";
import { findConfigPda } from "../app/generated/proof_of_rent/pdas/config.ts";
import { getCreatePassportInstructionAsync } from "../app/generated/proof_of_rent/instructions/createPassport.ts";
import { getCreateOfferInstructionAsync } from "../app/generated/proof_of_rent/instructions/createOffer.ts";
import { getAcceptOfferInstructionAsync } from "../app/generated/proof_of_rent/instructions/acceptOffer.ts";
import { getProposeSettlementInstruction } from "../app/generated/proof_of_rent/instructions/proposeSettlement.ts";
import { getOpenDisputeInstructionAsync } from "../app/generated/proof_of_rent/instructions/openDispute.ts";
import { getSubmitEvidenceInstruction } from "../app/generated/proof_of_rent/instructions/submitEvidence.ts";
import { getResolveDisputeInstructionAsync } from "../app/generated/proof_of_rent/instructions/resolveDispute.ts";

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(label: string, instructions: Instruction[]) {
  await sleep(2500); // public devnet RPC rate limit
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
    .simulateTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64", sigVerify: true })
    .send();
  if (sim.value.err) {
    console.error(sim.value.logs?.join("\n"));
    throw new Error(`${label}: simulation failed`);
  }
  await sendAndConfirm(tx as Parameters<typeof sendAndConfirm>[0], { commitment: "confirmed" });
  console.log(`✓ ${label}`);
}

const ata = async (owner: Address) =>
  (await findAssociatedTokenPda({ mint: MINT, owner, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];
const balance = async (owner: Address) => (await fetchToken(rpc, await ata(owner))).data.amount;
const hash = (n: number) => new Uint8Array(32).fill(n);

async function onboard(user: KeyPairSigner) {
  await send("passport + starter tokens", [
    await getCreatePassportInstructionAsync({ owner: user, payer: feePayer }),
    await getCreateAssociatedTokenIdempotentInstructionAsync({ payer: feePayer, mint: MINT, owner: user.address }),
    getMintToInstruction({ mint: MINT, token: await ata(user.address), mintAuthority: feePayer, amount: 20_000_000_000n }),
  ]);
}

const config = (await fetchConfig(rpc, (await findConfigPda())[0])).data;
if (config.arbiter !== feePayer.address && config.admin !== feePayer.address) {
  throw new Error(`fee payer is not the arbiter (${config.arbiter})`);
}

const landlord = await generateKeyPairSigner();
const tenant = await generateKeyPairSigner();
console.log("landlord", landlord.address, "\ntenant  ", tenant.address);
await onboard(landlord);
await onboard(tenant);

const now = BigInt(Math.floor(Date.now() / 1000));
const DEPOSIT = 6_000_000_000n;
const OFFER = 3_000_000_000n;
const AWARD = 5_000_000_000n;
const WINDOW = 120n;

await send("create offer (with move-in hash)", [
  await getCreateOfferInstructionAsync({
    landlord,
    payer: feePayer,
    mint: MINT,
    offerId: 1n,
    tenant: tenant.address,
    depositAmount: DEPOSIT,
    monthlyRent: 3_000_000_000n,
    startTs: now - 90n * 86400n,
    endTs: now + 30n, // ends almost immediately
    acceptDeadline: now + 3600n,
    returnTimeout: WINDOW,
    area: "Warsaw · Wola",
    checkinHash: hash(7),
  }),
]);
const [lease] = await findLeasePda({ landlord: landlord.address, offerId: 1n });

await send("tenant accepts", [
  await getAcceptOfferInstructionAsync({
    tenant,
    payer: feePayer,
    lease,
    mint: MINT,
    tenantToken: await ata(tenant.address),
    treasuryToken: await ata(config.treasury),
  }),
]);
const tenantAfterAccept = await balance(tenant.address);

await send("landlord proposes 3000 back (with evidence)", [
  getProposeSettlementInstruction({ landlord, lease, toTenant: OFFER, evidence: hash(2) }),
]);
await send("tenant opens dispute (5% bond)", [
  await getOpenDisputeInstructionAsync({
    tenant,
    lease,
    mint: MINT,
    tenantToken: await ata(tenant.address),
    evidence: hash(3),
  }),
]);
let state = (await fetchLease(rpc, lease)).data;
console.log("  status", state.status, "bond", state.disputeBond);
await send("landlord adds a statement", [
  getSubmitEvidenceInstruction({ signer: landlord, lease, evidence: hash(4) }),
]);

const treasuryBefore = await balance(config.treasury);
const [tenantPassport] = await findPassportPda({ owner: tenant.address });
const [landlordPassport] = await findPassportPda({ owner: landlord.address });
await send("arbiter awards 5000 to tenant", [
  await getResolveDisputeInstructionAsync({
    arbiter: feePayer,
    lease,
    mint: MINT,
    tenantToken: await ata(tenant.address),
    landlordToken: await ata(landlord.address),
    treasuryToken: await ata(config.treasury),
    tenantPassport,
    landlordPassport,
    rentReceiver: feePayer.address,
    toTenant: AWARD,
  }),
]);

state = (await fetchLease(rpc, lease)).data;
const bond = (DEPOSIT * 500n) / 10_000n;
const tenantGot = (await balance(tenant.address)) - tenantAfterAccept + bond; // bond left before
const landlordBal = (await balance(landlord.address)) - 20_000_000_000n;
const treasuryGot = (await balance(config.treasury)) - treasuryBefore;
console.log({ status: state.status, outcome: state.outcome, amountToTenant: state.amountToTenant });
console.log({ tenantGot, landlordGot: landlordBal, treasuryGot });
const ok =
  state.amountToTenant === AWARD &&
  tenantGot === AWARD + bond &&
  landlordBal === DEPOSIT - AWARD - bond &&
  treasuryGot === bond;
console.log(ok ? "\nALL CHECKS PASSED" : "\nMISMATCH");
console.log(`lease: http://localhost:3000/offers/${lease}`);
if (!ok) process.exit(1);
