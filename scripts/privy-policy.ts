// Creates the Privy policy that limits what OUR SERVER can sign with a
// user's embedded wallet. Run once: npx tsx scripts/privy-policy.ts
//
// Rule: every top-level instruction in a transaction must target either the
// Proof of Rent program or the Associated Token Account program. Anything
// else (a plain SOL/token transfer out of the user's wallet, a call to any
// other program) is denied inside Privy's enclave, before a signature exists.
// Token moves done by our program via CPI are not top-level instructions;
// they are bounded by the program's own on-chain rules instead.
//
// Prints NEXT_PUBLIC_PRIVY_POLICY_ID for .env. The browser passes it to
// addSigners(), so the signer grant is only valid together with this policy.
import { readFileSync } from "node:fs";

const PROGRAM_ID = "AqMUqWYHuFNdY5s78wX52BF3fKkaQVTPT4UsAvcgsuba";
const ATA_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [
      l.slice(0, l.indexOf("=")),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ])
);
const appId = env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = env.PRIVY_APP_SECRET;
if (!appId || !appSecret) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID / PRIVY_APP_SECRET missing");

const policy = {
  version: "1.0",
  name: "Proof of Rent server signer",
  chain_type: "solana",
  rules: [
    {
      name: "Only Proof of Rent and ATA program",
      method: "signTransaction",
      action: "ALLOW",
      conditions: [
        {
          field_source: "solana_program_instruction",
          field: "programId",
          operator: "in",
          value: [PROGRAM_ID, ATA_PROGRAM_ID],
        },
      ],
    },
  ],
};

const res = await fetch("https://api.privy.io/v1/policies", {
  method: "POST",
  headers: {
    Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString("base64")}`,
    "privy-app-id": appId,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(policy),
});
const json = (await res.json()) as { id?: string; error?: string };
if (!res.ok || !json.id) {
  console.error(res.status, json);
  process.exit(1);
}
console.log("policy created:", json.id);
console.log(`\nAdd to .env:\nNEXT_PUBLIC_PRIVY_POLICY_ID=${json.id}`);
