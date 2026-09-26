import "server-only";

import {
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
} from "@solana/kit";
import { getFeePayerSigner } from "./fee-payer";

// Devnet only, on purpose: the fee payer key must never touch mainnet.
export const RPC_URL = "https://api.devnet.solana.com";
const WS_URL = "wss://api.devnet.solana.com";

export const rpc = createSolanaRpc(RPC_URL);
const rpcSubscriptions = createSolanaRpcSubscriptions(WS_URL);
const sendAndConfirm = sendAndConfirmTransactionFactory({
  rpc,
  rpcSubscriptions,
});

export class SimulationError extends Error {
  constructor(public logs: readonly string[] | null) {
    super("Transaction simulation failed");
  }
}

/**
 * Fee payer pays; every other signer is embedded in the instructions
 * (user signers come from Privy). Simulates before broadcasting.
 */
export async function sendWithFeePayer(
  instructions: readonly Instruction[]
): Promise<string> {
  const feePayer = await getFeePayerSigner();
  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m)
  );
  const signed = await signTransactionMessageWithSigners(message);

  const simulation = await rpc
    .simulateTransaction(getBase64EncodedWireTransaction(signed), {
      encoding: "base64",
      sigVerify: true,
    })
    .send();
  if (simulation.value.err) {
    console.error("simulation failed", simulation.value.err);
    throw new SimulationError(simulation.value.logs);
  }

  assertIsTransactionWithBlockhashLifetime(signed);
  await sendAndConfirm(signed, { commitment: "confirmed" });
  return getSignatureFromTransaction(signed);
}

/** Maps a program error in simulation logs to a user-facing message. */
export function programErrorFromLogs(logs: readonly string[] | null) {
  const line = logs?.find((l) => l.includes("Error Message:"));
  return line ? line.split("Error Message:")[1].trim().replace(/\.$/, "") : null;
}
