"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { address as toAddress } from "@solana/kit";
import {
  LeaseStatus,
  RENT_CLAIM_OPENS,
  RENT_REVIEW_WINDOW,
  RentStatus,
  formatAmount,
  formatDate,
  getRentForLease,
  leasePeriods,
  periodBounds,
  periodLabel,
  rentAutoAccepted,
  rentOnTime,
  type LeaseRecord,
  type RentRecord,
} from "../lib/chain";
import { sendAction } from "../lib/hooks";
import { dangerButton, eyebrow, inputClass, primaryButton } from "./site-header";

const today = () => new Date().toISOString().slice(0, 10);

/** Monthly rent log of one lease: tenant marks paid, landlord confirms. */
export function RentMonths({
  lease,
  role,
}: {
  lease: LeaseRecord;
  role: "landlord" | "tenant" | null;
}) {
  const { data: records, mutate } = useSWR(["rent", lease.address], () =>
    getRentForLease(toAddress(lease.address))
  );
  const [now] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const live = lease.status === LeaseStatus.Active || lease.status === LeaseStatus.Disputed;
  if (!live && lease.status !== LeaseStatus.Closed) return null;

  const byPeriod = new Map((records ?? []).map((r) => [r.period, r]));
  // Months already open for claiming, or already recorded.
  const periods = leasePeriods(lease).filter(
    (p) => byPeriod.has(p) || periodBounds(p)[1] - RENT_CLAIM_OPENS <= now
  );

  return (
    <section className="space-y-4">
      <div>
        <p className={eyebrow}>Rent log</p>
        <h2 className="mt-2 text-xl font-medium">
          Monthly rent · {formatAmount(lease.monthlyRent)}
        </h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Rent for a month is due by its last day. The tenant marks it paid (from 10
          days before the month ends); the landlord confirms or rejects within 7
          days, otherwise it counts as accepted.
        </p>
      </div>
      {periods.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-4 text-sm text-muted">
          {leasePeriods(lease).length
            ? `The first month (${periodLabel(leasePeriods(lease)[0])}) opens 10 days before it ends.`
            : "This lease has no monthly payments to record."}
        </p>
      ) : (
        <ol className="overflow-hidden rounded-lg border border-border bg-card">
          {periods.map((p) => (
            <Month
              key={p}
              lease={lease}
              period={p}
              record={byPeriod.get(p)}
              role={live ? role : null}
              now={now}
              onDone={() => mutate()}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function Month({
  lease,
  period,
  record,
  role,
  now,
  onDone,
}: {
  lease: LeaseRecord;
  period: number;
  record?: RentRecord;
  role: "landlord" | "tenant" | null;
  now: bigint;
  onDone: () => void;
}) {
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: string, body: Record<string, unknown>, ok: string) {
    setBusy(action);
    try {
      await sendAction(action, { lease: lease.address, period: String(period), ...body });
      toast.success(ok);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const status = monthStatus(record, now);
  const reviewOpen = record?.status === RentStatus.Claimed && !status.auto;
  const canClaim = role === "tenant" && (!record || record.status === RentStatus.Rejected);
  const canReview = role === "landlord" && reviewOpen;

  return (
    <li className="space-y-3 px-5 py-4 sm:px-7 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-medium">{periodLabel(period)}</p>
        <span className={`text-sm ${status.tone}`}>{status.label}</span>
      </div>
      {record && (
        <p className="text-sm text-muted">
          Tenant paid {formatDate(record.paidAt)}
          {record.status === RentStatus.Confirmed &&
            ` · landlord received ${formatDate(record.receivedAt)}`}
          {record.status === RentStatus.Claimed &&
            !status.auto &&
            ` · landlord can respond until ${formatDate(record.claimedAt + RENT_REVIEW_WINDOW)}`}
          {record.rejections > 0 && ` · rejected ${record.rejections}×`}
        </p>
      )}

      {canClaim && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            className={`${inputClass} w-44`}
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Payment date"
          />
          <button
            className={primaryButton}
            disabled={!!busy || !date}
            onClick={() => run("claim_rent", { paidAt: `${date}T12:00:00Z` }, "Marked as paid")}
          >
            {busy ? "Sending…" : record ? "Submit again" : "I paid"}
          </button>
        </div>
      )}

      {canReview && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            className={`${inputClass} w-44`}
            value={date}
            max={today()}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date received"
          />
          <button
            className={primaryButton}
            disabled={!!busy || !date}
            onClick={() =>
              run("confirm_rent", { receivedAt: `${date}T12:00:00Z` }, "Payment confirmed")
            }
          >
            {busy === "confirm_rent" ? "Confirming…" : "Confirm received"}
          </button>
          <button
            className={dangerButton}
            disabled={!!busy}
            onClick={() => run("reject_rent", {}, "Payment rejected")}
          >
            Not received
          </button>
        </div>
      )}
    </li>
  );
}

function monthStatus(r: RentRecord | undefined, now: bigint) {
  if (!r) return { label: "Not marked yet", tone: "text-muted", auto: false };
  if (r.status === RentStatus.Rejected) {
    return { label: "Rejected by landlord", tone: "text-destructive", auto: false };
  }
  const auto = rentAutoAccepted(r, now);
  if (r.status === RentStatus.Claimed && !auto) {
    return { label: "Waiting for landlord", tone: "text-muted", auto };
  }
  const how = auto ? "no objection" : "confirmed";
  return rentOnTime(r)
    ? { label: `Paid on time · ${how}`, tone: "text-primary-ink", auto }
    : { label: `Paid late · ${how}`, tone: "text-caution", auto };
}

