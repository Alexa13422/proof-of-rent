// Minimal runnable self-check for the FEE_PAYER_SECRET_KEY parser.
// Run with: node app/spike/privy/fee-payer.test.ts  (Node 24 strips types natively)
import assert from "node:assert/strict";
import { parseFeePayerSecretKey } from "./parse-fee-payer-secret.ts";

const valid = JSON.stringify(Array.from({ length: 64 }, (_, i) => i));
const bytes = parseFeePayerSecretKey(valid);
assert.equal(bytes.length, 64);
assert.equal(bytes[0], 0);
assert.equal(bytes[63], 63);

assert.throws(() => parseFeePayerSecretKey("not json"));
assert.throws(() => parseFeePayerSecretKey("[1,2,3]"), /64 integers/);
assert.throws(
  () => parseFeePayerSecretKey(JSON.stringify(Array(64).fill(256))),
  /\[0, 255\]/
);
assert.throws(
  () => parseFeePayerSecretKey(JSON.stringify(Array(64).fill(1.5))),
  /integer/
);

console.log("fee-payer.test.ts: all assertions passed");
