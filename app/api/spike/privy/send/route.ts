import { NextRequest, NextResponse } from "next/server";
import { createPrivySigner } from "@solana/keychain-privy";
import { getAddMemoInstruction } from "@solana-program/memo";
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
} from "@solana/kit";
import { resolveTenantWallet } from "@/app/spike/privy/privy-user";
import { getFeePayerSigner } from "@/app/spike/privy/fee-payer";

// Hardcoded devnet, on purpose: this route only ever exists for the spike.
const DEVNET_RPC_URL = "https://api.devnet.solana.com";
const DEVNET_RPC_WS_URL = "wss://api.devnet.solana.com";

// No PII: fixed, static memo content — never derived from user input.
const MEMO_TEXT = "proof-of-rent:privy-spike";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, accessToken] = authHeader.split(" ");
  if (scheme !== "Bearer" || !accessToken) {
    return NextResponse.json(
      { error: "Missing Bearer access token" },
      { status: 401 }
    );
  }

  try {
    const tenantWallet = await resolveTenantWallet(accessToken);

    const [tenantSigner, feePayerSigner] = await Promise.all([
      createPrivySigner({
        appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
        appSecret: process.env.PRIVY_APP_SECRET!,
        walletId: tenantWallet.walletId,
      }),
      getFeePayerSigner(),
    ]);

    const rpc = createSolanaRpc(DEVNET_RPC_URL);
    const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();

    const memoInstruction = getAddMemoInstruction({
      memo: MEMO_TEXT,
      signers: [tenantSigner],
    });

    const transactionMessage = pipe(
      createTransactionMessage({ version: "legacy" }),
      (m) => setTransactionMessageFeePayerSigner(feePayerSigner, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
      (m) => appendTransactionMessageInstructions([memoInstruction], m)
    );

    // Signs with both the fee payer (server) and the tenant (Privy) signer.
    const signedTransaction =
      await signTransactionMessageWithSigners(transactionMessage);

    const base64Transaction =
      getBase64EncodedWireTransaction(signedTransaction);
    const simulation = await rpc
      .simulateTransaction(base64Transaction, {
        encoding: "base64",
        sigVerify: true,
      })
      .send();
    if (simulation.value.err) {
      console.error("Privy spike simulation failed", simulation.value.err);
      return NextResponse.json(
        { error: "Transaction simulation failed" },
        { status: 400 }
      );
    }

    // Our lifetime always comes from setTransactionMessageLifetimeUsingBlockhash
    // above, never a durable nonce — narrow the type accordingly.
    assertIsTransactionWithBlockhashLifetime(signedTransaction);

    const rpcSubscriptions = createSolanaRpcSubscriptions(DEVNET_RPC_WS_URL);
    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
      rpc,
      rpcSubscriptions,
    });
    await sendAndConfirmTransaction(signedTransaction, {
      commitment: "confirmed",
    });

    return NextResponse.json({
      signature: getSignatureFromTransaction(signedTransaction),
    });
  } catch (error) {
    console.error("Privy spike transaction failed", error);
    return NextResponse.json(
      { error: "Unable to send the test transaction" },
      { status: 500 }
    );
  }
}
