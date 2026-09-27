// Sets config.arbiter (keeps treasury and fee). Signed by the config admin;
// the fee payer pays the network fee.
// Run: npx tsx scripts/set-arbiter.ts <admin-keypair.json> <arbiter-address>
import { readFileSync } from "node:fs";
import {
  address,
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { fetchConfig } from "../app/generated/proof_of_rent/accounts/config.ts";
import { findConfigPda } from "../app/generated/proof_of_rent/pdas/config.ts";
import { getUpdateConfigInstructionAsync } from "../app/generated/proof_of_rent/instructions/updateConfig.ts";

const [adminPath, arbiterArg] = process.argv.slice(2);
if (!adminPath || !arbiterArg) throw new Error("usage: set-arbiter.ts <admin.json> <arbiter>");

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
const admin = await createKeyPairSignerFromBytes(
  new Uint8Array(JSON.parse(readFileSync(adminPath, "utf8")))
);
const arbiter = address(arbiterArg);

const [configPda] = await findConfigPda();
const before = (await fetchConfig(rpc, configPda)).data;
if (before.admin !== admin.address) throw new Error(`admin is ${before.admin}`);

const ix = await getUpdateConfigInstructionAsync({
  admin,
  treasury: before.treasury,
  arbiter,
  feeBps: before.feeBps,
});
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
console.log("tx:", getSignatureFromTransaction(signed));
const after = (await fetchConfig(rpc, configPda)).data;
console.log({ admin: after.admin, arbiter: after.arbiter, treasury: after.treasury, feeBps: after.feeBps });
if (after.arbiter !== arbiter) throw new Error("arbiter not updated");
