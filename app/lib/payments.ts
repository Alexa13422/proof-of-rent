// Money in / money out model. There is no free-floating balance:
// - the tenant pays each deposit (and dispute bond) straight into that
//   lease's escrow, by BLIK;
// - whatever the escrow returns to the tenant goes back to the same BLIK
//   bank account as a refund of the original payment (no off-ramp, no fee);
// - only a landlord can withdraw, and only what a closed lease paid them.
//   We cover the off-ramp fee: one withdrawal per lease, paid from the
//   platform fee that lease already earned.
// The fiat side is a demo: no real payment, refund or payout happens.
import {
  DepositOutcome,
  LeaseStatus,
  settlementOffer,
  type LeaseRecord,
} from "./chain";

/** Stripe: a BLIK payment can be refunded up to 13 months after it was made. */
export const REFUND_WINDOW_MONTHS = 13;
const MONTH = 30.44 * 24 * 3600;
const REFUND_WINDOW_SECONDS = BigInt(Math.floor(REFUND_WINDOW_MONTHS * MONTH));

/** Polish law (ustawa o ochronie praw lokatorów, art. 6): the deposit may not
 *  exceed 12 × monthly rent (6 × for najem okazjonalny / instytucjonalny) and
 *  must be returned within one month after the tenant moves out. */
export const DEPOSIT_CAP_MONTHS = 12;
export const DEPOSIT_CAP_MONTHS_OCCASIONAL = 6;

/** What a closed lease paid the landlord (mirrors the program's `pay_out`). */
export function landlordPayout(lease: LeaseRecord): bigint {
  if (lease.status !== LeaseStatus.Closed) return 0n;
  const rest = lease.depositAmount - lease.amountToTenant;
  if (rest <= 0n) return 0n;
  const offer = settlementOffer(lease);
  const tenantWon =
    lease.outcome === DepositOutcome.ArbiterResolved &&
    offer !== null &&
    lease.amountToTenant > offer;
  // A tenant who wins a dispute gets the bond back; the landlord pays the
  // same amount to the platform instead.
  if (tenantWon) return rest - (lease.disputeBond < rest ? lease.disputeBond : rest);
  return rest;
}

/** What the tenant got back from escrow (deposit share, plus the bond if they won). */
export function tenantRefund(lease: LeaseRecord): bigint {
  if (lease.status !== LeaseStatus.Closed) return 0n;
  const offer = settlementOffer(lease);
  const won =
    lease.outcome === DepositOutcome.ArbiterResolved &&
    offer !== null &&
    lease.amountToTenant > offer;
  return lease.amountToTenant + (won ? lease.disputeBond : 0n);
}

export type RefundRoute =
  | { kind: "blik"; until: bigint }
  | { kind: "bank"; paidAt: bigint };

/**
 * How money returned to the tenant reaches them: a refund of the original
 * BLIK payment while the provider still allows it, otherwise a transfer to
 * the tenant's bank account (the off-ramp fee is taken from that amount).
 */
export function refundRoute(lease: LeaseRecord, at: bigint): RefundRoute {
  const until = lease.acceptedAt + REFUND_WINDOW_SECONDS;
  return at <= until ? { kind: "blik", until } : { kind: "bank", paidAt: lease.acceptedAt };
}

/** Sum of landlord payouts over closed leases. */
export function earnedAsLandlord(leases: LeaseRecord[]): bigint {
  return leases.reduce((sum, l) => sum + landlordPayout(l), 0n);
}
