// Public, verifiable history of a passport: every transaction that touched
// the passport account on-chain, oldest first. Anyone can re-check each entry
// on Solana Explorer, so the page never asks to be trusted.
import type { Address, Signature } from "@solana/kit";
import { PROOF_OF_RENT_PROGRAM_ADDRESS, findPassportPda } from "@/app/generated/proof_of_rent";
import { rpc } from "./chain";

export const EXPLORER_CLUSTER = "devnet";

export function explorerTx(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=${EXPLORER_CLUSTER}`;
}

export function explorerAddress(value: string) {
  return `https://explorer.solana.com/address/${value}?cluster=${EXPLORER_CLUSTER}`;
}

/** Anchor logs "Instruction: <PascalCaseName>" for every program instruction. */
const LABELS: Record<string, string> = {
  CreatePassport: "Passport created",
  ReleaseFull: "Deposit returned in full",
  AcceptSettlement: "Deposit settled by agreement",
  ClaimAfterTimeout: "Deposit claimed after the return window",
};

export type PassportEvent = {
  signature: Signature;
  label: string;
  /** Unix seconds; null if the cluster has not indexed block time yet. */
  blockTime: number | null;
  slot: bigint;
  ok: boolean;
};

const MAX_EVENTS = 25;

export async function getPassportActivity(owner: Address): Promise<{
  passportAddress: Address;
  events: PassportEvent[];
}> {
  const [passportAddress] = await findPassportPda({ owner });
  const signatures = await rpc
    .getSignaturesForAddress(passportAddress, { limit: MAX_EVENTS })
    .send();

  const programPrefix = `Program ${PROOF_OF_RENT_PROGRAM_ADDRESS} invoke`;
  const events: PassportEvent[] = [];

  // Sequential on purpose: the public devnet RPC rate-limits bursts.
  for (const entry of signatures) {
    const tx = await rpc
      .getTransaction(entry.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
        encoding: "json",
      })
      .send();
    const logs = tx?.meta?.logMessages ?? [];

    // Only our program's instructions, not the token program's.
    let label: string | null = null;
    for (let i = 0; i < logs.length; i++) {
      if (!logs[i].startsWith(programPrefix)) continue;
      const name = logs[i + 1]?.match(/^Program log: Instruction: (\w+)/)?.[1];
      if (name && LABELS[name]) {
        label = LABELS[name];
        break;
      }
    }
    if (!label) continue;

    events.push({
      signature: entry.signature,
      label,
      blockTime: entry.blockTime === null ? null : Number(entry.blockTime),
      slot: entry.slot,
      ok: entry.err === null,
    });
  }

  // RPC returns newest first; show the record as it grew.
  return { passportAddress, events: events.reverse() };
}
