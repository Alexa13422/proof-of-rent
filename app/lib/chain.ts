// Read-only access to on-chain state. Safe on the server and in the browser.
import {
  address,
  createSolanaRpc,
  getAddressDecoder,
  getBase58Decoder,
  getBase64Encoder,
  isSome,
  type Address,
  type Base58EncodedBytes,
} from "@solana/kit";
import {
  DepositOutcome,
  LEASE_DISCRIMINATOR,
  LeaseStatus,
  PROOF_OF_RENT_PROGRAM_ADDRESS,
  fetchMaybeConfig,
  fetchMaybeLease,
  fetchMaybePassport,
  findConfigPda,
  findPassportPda,
  getLeaseDecoder,
  type Lease,
  type Passport,
} from "@/app/generated/proof_of_rent";

export const DEVNET_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";
export const rpc = createSolanaRpc(DEVNET_RPC_URL);

export const DEPOSIT_MINT = process.env.NEXT_PUBLIC_DEPOSIT_MINT
  ? address(process.env.NEXT_PUBLIC_DEPOSIT_MINT)
  : null;
export const TOKEN_SYMBOL = "tUSDC";
export const TOKEN_DECIMALS = 6;

/** Lease field offsets (after the 8-byte discriminator). */
const LANDLORD_OFFSET = 8n;
const TENANT_OFFSET = 40n;

export type LeaseRecord = Lease & { address: Address };

export function isValidAddress(value: string): value is Address {
  try {
    address(value);
    return true;
  } catch {
    return false;
  }
}

export async function getPassport(owner: Address): Promise<Passport | null> {
  const [pda] = await findPassportPda({ owner });
  const account = await fetchMaybePassport(rpc, pda);
  return account.exists ? account.data : null;
}

export async function getLease(lease: Address): Promise<LeaseRecord | null> {
  const account = await fetchMaybeLease(rpc, lease);
  return account.exists ? { ...account.data, address: lease } : null;
}

export async function getConfig() {
  const [pda] = await findConfigPda();
  const account = await fetchMaybeConfig(rpc, pda);
  return account.exists ? account.data : null;
}

export async function getLeasesFor(
  user: Address,
  role: "landlord" | "tenant"
): Promise<LeaseRecord[]> {
  const base58 = getBase58Decoder();
  const accounts = await rpc
    .getProgramAccounts(PROOF_OF_RENT_PROGRAM_ADDRESS, {
      encoding: "base64",
      filters: [
        {
          memcmp: {
            offset: 0n,
            bytes: base58.decode(LEASE_DISCRIMINATOR) as Base58EncodedBytes,
            encoding: "base58",
          },
        },
        {
          memcmp: {
            offset: role === "landlord" ? LANDLORD_OFFSET : TENANT_OFFSET,
            bytes: user as unknown as Base58EncodedBytes,
            encoding: "base58",
          },
        },
      ],
    })
    .send();

  const decoder = getLeaseDecoder();
  const b64 = getBase64Encoder();
  return accounts
    .map(({ pubkey, account }) => ({
      ...decoder.decode(b64.encode(account.data[0])),
      address: pubkey,
    }))
    .sort((a, b) => Number(b.createdAt - a.createdAt));
}

// ---------------------------------------------------------------- formatting

export function formatAmount(raw: bigint): string {
  const whole = raw / 10n ** BigInt(TOKEN_DECIMALS);
  const frac = raw % 10n ** BigInt(TOKEN_DECIMALS);
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const fracStr = frac
    ? "," + frac.toString().padStart(TOKEN_DECIMALS, "0").replace(/0+$/, "")
    : "";
  return `${wholeStr}${fracStr} ${TOKEN_SYMBOL}`;
}

export function parseAmount(value: string): bigint {
  const clean = value.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,6})?$/.test(clean)) throw new Error("Invalid amount");
  const [whole, frac = ""] = clean.split(".");
  return (
    BigInt(whole) * 10n ** BigInt(TOKEN_DECIMALS) +
    BigInt(frac.padEnd(TOKEN_DECIMALS, "0"))
  );
}

export function formatDate(ts: bigint): string {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function shortAddress(value: string, chars = 4) {
  return `${value.slice(0, chars)}…${value.slice(-chars)}`;
}

export const STATUS_LABEL: Record<LeaseStatus, string> = {
  [LeaseStatus.Offered]: "Awaiting tenant",
  [LeaseStatus.Rejected]: "Rejected",
  [LeaseStatus.Cancelled]: "Withdrawn",
  [LeaseStatus.Active]: "Active · deposit in escrow",
  [LeaseStatus.Closed]: "Closed",
};

export const OUTCOME_LABEL: Record<DepositOutcome, string> = {
  [DepositOutcome.None]: "",
  [DepositOutcome.FullReturn]: "Returned in full",
  [DepositOutcome.Settled]: "Partly returned",
  [DepositOutcome.TimeoutClaim]: "Claimed after timeout",
};

export function settlementOffer(lease: Lease): bigint | null {
  return isSome(lease.settlementOffer) ? lease.settlementOffer.value : null;
}

export { DepositOutcome, LeaseStatus, getAddressDecoder };
export type { Lease, Passport };
