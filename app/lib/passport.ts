// Builds the view model for a real, on-chain passport.
import "server-only";
import { address } from "@solana/kit";
import { getMaskedEmailByWallet } from "./server/privy";
import {
  DepositOutcome,
  LeaseStatus,
  RentStatus,
  formatDate,
  getLeasesFor,
  getPassport,
  getRentForLandlord,
  getRentForTenant,
  periodLabel,
  rentAutoAccepted,
  rentOnTime,
  shortAddress,
  type LeaseRecord,
  type RentRecord,
} from "./chain";
import { depositReturnBand } from "./mock/passport";
import type {
  DepositOutcome as UiOutcome,
  LandlordRecord,
  RentPassport,
  RentPayment,
} from "./mock/passport";

const MONTH = 30n * 24n * 60n * 60n;

const OUTCOME: Record<DepositOutcome, UiOutcome | null> = {
  [DepositOutcome.None]: null,
  [DepositOutcome.FullReturn]: "returned-in-full",
  [DepositOutcome.Settled]: "partly-returned",
  [DepositOutcome.TimeoutClaim]: "returned-in-full",
  [DepositOutcome.ArbiterResolved]: "arbiter",
};

function monthYear(ts: bigint) {
  return new Date(Number(ts) * 1000).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

const effectiveEnd = (l: LeaseRecord) =>
  l.status === LeaseStatus.Closed && l.closedAt > 0n && l.closedAt < l.endTs
    ? l.closedAt
    : l.endTs;

const effectiveMonths = (l: LeaseRecord) =>
  Math.max(0, Number((effectiveEnd(l) - l.startTs) / MONTH));

const period = (l: LeaseRecord) => `${monthYear(l.startTs)} – ${monthYear(effectiveEnd(l))}`;

/** Only months that count: confirmed, or claimed and left unanswered. */
function toPayments(records: RentRecord[], now: bigint): RentPayment[] {
  return records
    .filter((r) => r.status === RentStatus.Confirmed || rentAutoAccepted(r, now))
    .sort((a, b) => b.period - a.period)
    .map((r) => ({
      month: periodLabel(r.period),
      paidAt: formatDate(r.status === RentStatus.Confirmed ? r.receivedAt : r.paidAt),
      timing: rentOnTime(r) ? "on-time" : "late",
      confirmation: r.status === RentStatus.Confirmed ? "landlord-confirmed" : "no-objection",
    }));
}

export async function getChainPassport(owner: string): Promise<RentPassport | null> {
  const ownerAddress = address(owner);
  const [passport, maskedEmail] = await Promise.all([
    getPassport(ownerAddress),
    getMaskedEmailByWallet(owner),
  ]);
  if (!passport) return null;
  const now = BigInt(Math.floor(Date.now() / 1000));

  // Sequential: the public devnet RPC rate-limits bursts.
  const asTenant = await getLeasesFor(ownerAddress, "tenant");
  const asLandlord = await getLeasesFor(ownerAddress, "landlord");
  const tenantRent = await getRentForTenant(ownerAddress);
  const landlordRent = asLandlord.length ? await getRentForLandlord(ownerAddress) : [];

  const closed = asTenant.filter(
    (l) => l.status === LeaseStatus.Closed && effectiveEnd(l) - l.startTs >= 3n * MONTH
  );

  // Landlord track record, for the anti-fake "landlord with N leases" line.
  const landlordCounts = new Map<string, number>();
  for (const landlord of new Set(closed.map((l) => l.landlord))) {
    const p = await getPassport(landlord);
    landlordCounts.set(landlord, p?.landlordLeasesClosed ?? 0);
  }

  const rentByLease = new Map<string, RentRecord[]>();
  for (const r of tenantRent) rentByLease.set(r.lease, [...(rentByLease.get(r.lease) ?? []), r]);
  const rentLease = asTenant
    .filter((l) => l.status !== LeaseStatus.Offered)
    .find((l) => toPayments(rentByLease.get(l.address) ?? [], now).length);

  const landlordClosed = asLandlord.filter((l) => l.status === LeaseStatus.Closed);
  const landlord: LandlordRecord | undefined =
    asLandlord.some((l) => l.status !== LeaseStatus.Offered && l.status !== LeaseStatus.Rejected && l.status !== LeaseStatus.Cancelled)
      ? {
          leasesClosed: passport.landlordLeasesClosed,
          fullReturns: passport.landlordFullReturns,
          disputes: asLandlord.filter(
            (l) => l.status === LeaseStatus.Disputed || l.outcome === DepositOutcome.ArbiterResolved
          ).length,
          rentConfirmed: landlordRent.filter((r) => r.status === RentStatus.Confirmed).length,
          rentRejected: landlordRent.reduce((n, r) => n + r.rejections, 0),
          rentSilent: landlordRent.filter((r) => rentAutoAccepted(r, now)).length,
          leases: landlordClosed.map((l) => ({
            id: l.address,
            area: l.area,
            period: period(l),
            depositReturn: depositReturnBand(l.amountToTenant, l.depositAmount),
            outcome: OUTCOME[l.outcome] ?? "returned-in-full",
          })),
        }
      : undefined;

  return {
    id: owner,
    tenantLabel: maskedEmail ?? "Tenant",
    tenantReference: shortAddress(owner),
    verifiedSince: new Date(Number(passport.createdAt) * 1000).toLocaleDateString(
      "en-GB",
      { month: "long", year: "numeric" }
    ),
    leases: closed.map((l) => ({
      id: l.address,
      area: l.area,
      period: period(l),
      months: effectiveMonths(l),
      depositReturn: depositReturnBand(l.amountToTenant, l.depositAmount),
      outcome: OUTCOME[l.outcome] ?? "returned-in-full",
      outcomeNote:
        l.outcome === DepositOutcome.TimeoutClaim
          ? "Landlord did not respond; the tenant claimed the deposit after the return window."
          : l.outcome === DepositOutcome.ArbiterResolved
            ? "Disputed; the deposit return was decided by an arbiter."
            : undefined,
      landlordLeases: landlordCounts.get(l.landlord) ?? 0,
      payments: toPayments(rentByLease.get(l.address) ?? [], now),
    })),
    rentLog: rentLease
      ? {
          area: rentLease.area,
          payments: toPayments(rentByLease.get(rentLease.address) ?? [], now),
        }
      : undefined,
    landlord,
  };
}
