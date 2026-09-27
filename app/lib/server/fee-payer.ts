import "server-only";

import { createKeyPairSignerFromBytes, type KeyPairSigner } from "@solana/kit";
import { parseFeePayerSecretKey } from "./parse-fee-payer-secret";

let cachedSigner: Promise<KeyPairSigner> | null = null;

export function getFeePayerSigner(): Promise<KeyPairSigner> {
  if (!cachedSigner) {
    const raw = process.env.FEE_PAYER_SECRET_KEY;
    if (!raw) throw new Error("FEE_PAYER_SECRET_KEY is not set");
    cachedSigner = createKeyPairSignerFromBytes(parseFeePayerSecretKey(raw));
  }
  return cachedSigner;
}
