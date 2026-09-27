import assert from "node:assert/strict";
import { none } from "@solana/kit";
import { LeaseStatus, DepositOutcome, type LeaseRecord } from "../app/lib/chain.ts";

const DAY = 86400n;
const MONTH = 30n * DAY;
const startTs = 1_700_000_000n;

// Mock lease closed after only 1 day (e.g. mutual agreement / early release).
const oneDayLease: LeaseRecord = {
  discriminator: new Uint8Array(8),
  address: "11111111111111111111111111111111" as never,
  landlord: "Landlord1111111111111111111111111111111111" as never,
  tenant: "Tenant111111111111111111111111111111111111" as never,
  payer: "Landlord1111111111111111111111111111111111" as never,
  mint: "Mint111111111111111111111111111111111111111" as never,
  offerId: 1n,
  depositAmount: 3_000_000_000n,
  monthlyRent: 0n,
  feeAmount: 30_000_000n,
  startTs,
  endTs: startTs + 12n * MONTH,
  acceptDeadline: startTs + DAY,
  returnTimeout: 60n,
  status: LeaseStatus.Closed,
  outcome: DepositOutcome.FullReturn,
  settlementOffer: none(),
  amountToTenant: 3_000_000_000n,
  createdAt: startTs,
  acceptedAt: startTs,
  closedAt: startTs + DAY,
  bump: 255,
  vaultBump: 255,
  area: "Warsaw · Mokotów",
  checkinHash: new Uint8Array(32),
  proposedAt: 0n,
  disputeBond: 0n,
  disputedAt: 0n,
  tenantEvidence: new Uint8Array(32),
  landlordEvidence: new Uint8Array(32),
};

// Mock lease closed after 6 full months.
const sixMonthLease: LeaseRecord = {
  ...oneDayLease,
  address: "22222222222222222222222222222222" as never,
  closedAt: startTs + 6n * MONTH,
};

const effectiveEnd = (l: LeaseRecord) =>
  l.status === LeaseStatus.Closed && l.closedAt > 0n && l.closedAt < l.endTs
    ? l.closedAt
    : l.endTs;

const effectiveMonths = (l: LeaseRecord) =>
  Math.max(0, Number((effectiveEnd(l) - l.startTs) / MONTH));

assert.equal(effectiveMonths(oneDayLease), 0, "1-day lease must count as 0 completed months");
assert.equal(effectiveEnd(oneDayLease) - oneDayLease.startTs >= 3n * MONTH, false, "1-day lease must not pass 3-month filter");

assert.equal(effectiveMonths(sixMonthLease), 6, "6-month lease must count as 6 completed months");
assert.equal(effectiveEnd(sixMonthLease) - sixMonthLease.startTs >= 3n * MONTH, true, "6-month lease must pass 3-month filter");

console.log("early termination unit calculations OK");
