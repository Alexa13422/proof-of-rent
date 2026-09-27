// Splits the platform keys (devnet):
//   1. Config admin (fees, treasury, arbiter): fee payer -> ~/keys/proof-of-rent-admin.json
//   2. Program upgrade authority:               fee payer -> ~/keys/proof-of-rent-upgrade.json
//      (done with `solana program set-upgrade-authority`, see scripts/README)
// After this the hot fee-payer key in .env can only pay fees and mint demo
// tokens. It can no longer change the fee or replace the program code.
//
// Run: npx tsx scripts/split-keys.ts <path-to-admin-keypair.json>
import { readFileSync } from "node:fs";
import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  getSignatureFromTransaction,
} from "@solana/kit";
import { fetchConfig } from "../app/generated/proof_of_rent/accounts/config.ts";
import { findConfigPda } from "../app/generated/proof_of_rent/pdas/config.ts";
import { getSetAdminInstructionAsync } from "../app/generated/proof_of_rent/instructions/setAdmin.ts";

const adminPath = process.argv[2];
if (!adminPath) throw new Error("usage: split-keys.ts <admin-keypair.json>");

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);
const rpc = createSolanaRpc("https://api.devnet.solana.com");
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions: createSolanaRpcSubscriptions("wss://api.devnet.solana.com"),
});

const feePayer = await createKeyPairSignerFromBytes(
  new Uint8Array(JSON.parse(env.FEE_PAYER_SECRET_KEY))
);
const newAdmin = await createKeyPairSignerFromBytes(
  new Uint8Array(JSON.parse(readFileSync(adminPath, "utf8")))
);

const [configPda] = await findConfigPda();
const before = (await fetchConfig(rpc, configPda)).data;
console.log("current admin:", before.admin);

if (before.admin === newAdmin.address) {
  console.log("already handed over, nothing to do");
  process.exit(0);
}
if (before.admin !== feePayer.address) {
  throw new Error("config admin is neither the fee payer nor the new admin");
}

const ix = await getSetAdminInstructionAsync({ admin: feePayer, newAdmin });
const { value: bh } = await rpc.getLatestBlockhash().send();
const signed = await signTransactionMessageWithSigners(
  pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(bh, m),
    (m) => appendTransactionMessageInstructions([ix], m)
  )
);
await sendAndConfirm(signed as Parameters<typeof sendAndConfirm>[0], { commitment: "confirmed" });
console.log("set_admin tx:", getSignatureFromTransaction(signed));

const after = (await fetchConfig(rpc, configPda)).data;
console.log("new admin:   ", after.admin);
if (after.admin !== newAdmin.address) throw new Error("handover did not apply");
