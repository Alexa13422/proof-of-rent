// One-time devnet setup: creates the test deposit token ("tUSDC", 6 decimals),
// the treasury token account and the program Config.
// Run: npx tsx scripts/setup-devnet.ts   (reads FEE_PAYER_SECRET_KEY from .env)
// Prints the env lines to add to .env.
import { readFileSync } from "node:fs";
import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  generateKeyPairSigner,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstructionAsync,
  getInitializeMint2Instruction,
  getMintSize,
} from "@solana-program/token";
import { fetchMaybeConfig } from "../app/generated/proof_of_rent/accounts/config.ts";
import { findConfigPda } from "../app/generated/proof_of_rent/pdas/config.ts";
import { getInitConfigInstructionAsync } from "../app/generated/proof_of_rent/instructions/initConfig.ts";

const FEE_BPS = 100; // 1% of the deposit

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
);

const rpc = createSolanaRpc("https://api.devnet.solana.com");
const rpcSubscriptions = createSolanaRpcSubscriptions(
  "wss://api.devnet.solana.com"
);
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

async function send(
  payer: Awaited<ReturnType<typeof createKeyPairSignerFromBytes>>,
  instructions: Instruction[]
) {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const tx = await signTransactionMessageWithSigners(
    pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(payer, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m)
    )
  );
  await sendAndConfirm(tx as Parameters<typeof sendAndConfirm>[0], {
    commitment: "confirmed",
  });
}

const admin = await createKeyPairSignerFromBytes(
  new Uint8Array(JSON.parse(env.FEE_PAYER_SECRET_KEY))
);
console.log("admin / fee payer / treasury:", admin.address);

let mintAddress = env.NEXT_PUBLIC_DEPOSIT_MINT;
if (!mintAddress) {
  const mint = await generateKeyPairSigner();
  const space = BigInt(getMintSize());
  const lamports = await rpc.getMinimumBalanceForRentExemption(space).send();
  await send(admin, [
    getCreateAccountInstruction({
      payer: admin,
      newAccount: mint,
      lamports,
      space,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMint2Instruction({
      mint: mint.address,
      decimals: 6,
      mintAuthority: admin.address,
    }),
  ]);
  mintAddress = mint.address;
  console.log("created mint", mintAddress);
}

const [treasuryAta] = await findAssociatedTokenPda({
  mint: mintAddress as never,
  owner: admin.address,
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
});
await send(admin, [
  await getCreateAssociatedTokenIdempotentInstructionAsync({
    payer: admin,
    mint: mintAddress as never,
    owner: admin.address,
  }),
]);
console.log("treasury token account", treasuryAta);

const [configPda] = await findConfigPda();
const existing = await fetchMaybeConfig(rpc, configPda);
if (!existing.exists) {
  await send(admin, [
    await getInitConfigInstructionAsync({
      admin,
      treasury: admin.address,
      arbiter: admin.address,
      feeBps: FEE_BPS,
    }),
  ]);
  console.log("config initialised", configPda);
} else {
  console.log("config already exists", configPda, existing.data);
}

console.log("\nAdd to .env:\nNEXT_PUBLIC_DEPOSIT_MINT=" + mintAddress);
