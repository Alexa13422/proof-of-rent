// Builds the view model for a real, on-chain passport.
import { address } from "@solana/kit";
import {
  DepositOutcome,
  LeaseStatus,
  formatAmount,
  getLeasesFor,
  getPassport,
  shortAddress,
} from "./chain";
import type { DepositOutcome as UiOutcome, RentPassport } from "./mock/passport";

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

export async function getChainPassport(owner: string): Promise<RentPassport | null> {
  const ownerAddress = address(owner);
  const passport = await getPassport(ownerAddress);
  if (!passport) return null;

  const leases = await getLeasesFor(ownerAddress, "tenant");
  const closed = leases.filter(
    (l) => l.status === LeaseStatus.Closed && l.endTs - l.startTs >= 3n * MONTH
  );

  // Landlord track record, for the anti-fake "landlord with N leases" line.
  const landlordCounts = new Map<string, number>();
  await Promise.all(
    [...new Set(closed.map((l) => l.landlord))].map(async (landlord) => {
      const p = await getPassport(landlord);
      landlordCounts.set(landlord, p?.landlordLeasesClosed ?? 0);
    })
  );

  return {
    id: owner,
    tenantLabel: "Tenant",
    tenantReference: shortAddress(owner),
    verifiedSince: new Date(Number(passport.createdAt) * 1000).toLocaleDateString(
      "en-GB",
      { month: "long", year: "numeric" }
    ),
    leases: closed.map((l) => ({
      id: l.address,
      area: l.area,
      period: `${monthYear(l.startTs)} – ${monthYear(l.endTs)}`,
      months: Number((l.endTs - l.startTs) / MONTH),
      rent: formatAmount(l.monthlyRent),
      deposit: formatAmount(l.depositAmount),
      returned: formatAmount(l.amountToTenant),
      outcome: OUTCOME[l.outcome] ?? "returned-in-full",
      outcomeNote:
        l.outcome === DepositOutcome.TimeoutClaim
          ? "Landlord did not respond; the tenant claimed the deposit after the return window."
          : l.outcome === DepositOutcome.ArbiterResolved
            ? `Disputed; the arbiter awarded ${formatAmount(l.amountToTenant)} of ${formatAmount(l.depositAmount)}.`
            : undefined,
      landlordLeases: landlordCounts.get(l.landlord) ?? 0,
      payments: [],
    })),
  };
}
