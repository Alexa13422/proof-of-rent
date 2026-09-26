"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "../../lib/auth/use-account";
import { sendAction, useLease } from "../../lib/hooks";
import {
  LeaseStatus,
  formatAmount,
  formatDate,
  parseAmount,
  settlementOffer,
  TOKEN_SYMBOL,
  type LeaseRecord,
} from "../../lib/chain";
import {
  dangerButton,
  eyebrow,
  inputClass,
  primaryButton,
  secondaryButton,
} from "../../components/site-header";
import { StatusBadge } from "../../dashboard/dashboard";

export function OfferView({ id }: { id: string }) {
  const { data: lease, isLoading, mutate } = useLease(id);
  const account = useAccount();

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (!lease) return <p className="text-muted">This offer does not exist.</p>;

  const role =
    account.address === lease.landlord
      ? "landlord"
      : account.address === lease.tenant
        ? "tenant"
        : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={eyebrow}>Lease offer</p>
          <h1 className="mt-2 text-3xl font-medium sm:text-4xl">{lease.area}</h1>
        </div>
        <StatusBadge lease={lease} />
      </div>

      <Terms lease={lease} />

      {role ? (
        <Actions lease={lease} role={role} onDone={() => mutate()} />
      ) : (
        <p className="text-sm text-muted">
          {account.authenticated
            ? "You are not a party to this lease."
            : "Sign in to respond to this offer."}
        </p>
      )}
    </div>
  );
}

function Terms({ lease }: { lease: LeaseRecord }) {
  const total = lease.depositAmount + lease.feeAmount;
  const rows: [string, React.ReactNode][] = [
    ["Period", `${formatDate(lease.startTs)} – ${formatDate(lease.endTs)}`],
    ["Monthly rent", <Mono key="r">{formatAmount(lease.monthlyRent)}</Mono>],
    ["Deposit (escrow)", <Mono key="d">{formatAmount(lease.depositAmount)}</Mono>],
    ["Platform fee", <Mono key="f">{formatAmount(lease.feeAmount)}</Mono>],
    ["Tenant pays on accept", <Mono key="t">{formatAmount(total)}</Mono>],
    ["Offer valid until", formatDate(lease.acceptDeadline)],
    ["Landlord", <Mono key="l">{lease.landlord}</Mono>],
    ["Tenant", <Mono key="tn">{lease.tenant}</Mono>],
  ];
  return (
    <dl className="overflow-hidden rounded-lg border border-border bg-card">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 px-5 py-3 sm:grid-cols-[12rem_1fr] sm:px-7 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
        >
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="min-w-0 break-all text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}

function Actions({
  lease,
  role,
  onDone,
}: {
  lease: LeaseRecord;
  role: "landlord" | "tenant";
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [settle, setSettle] = useState("");
  const [now] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const offer = settlementOffer(lease);

  async function run(action: string, body: Record<string, unknown> = {}, ok = "Done") {
    setBusy(action);
    try {
      await sendAction(action, { lease: lease.address, ...body });
      toast.success(ok);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const wrap = (children: React.ReactNode, note?: string) => (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-7">
      {note && <p className="mb-4 leading-7 text-muted">{note}</p>}
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );

  if (lease.status === LeaseStatus.Offered) {
    if (role === "tenant") {
      const expired = now > lease.acceptDeadline;
      return wrap(
        <>
          <button
            className={primaryButton}
            disabled={!!busy || expired}
            onClick={() => run("accept_offer", {}, "Offer accepted, deposit in escrow")}
          >
            {busy === "accept_offer"
              ? "Paying…"
              : `Accept and pay ${formatAmount(lease.depositAmount + lease.feeAmount)}`}
          </button>
          <button
            className={dangerButton}
            disabled={!!busy}
            onClick={() => run("reject_offer", {}, "Offer rejected")}
          >
            Reject
          </button>
        </>,
        expired
          ? "This offer has expired. Ask the landlord for a new one."
          : "Accepting locks the deposit in escrow: neither side can take it alone. Want different terms? Reject it and the landlord can send a new offer."
      );
    }
    return wrap(
      <button
        className={dangerButton}
        disabled={!!busy}
        onClick={() => run("cancel_offer", {}, "Offer withdrawn")}
      >
        Withdraw offer
      </button>,
      "Waiting for the tenant to accept or reject."
    );
  }

  if (lease.status === LeaseStatus.Rejected && role === "landlord") {
    return wrap(
      <Link href="/offers/new" className={primaryButton}>
        Send a revised offer
      </Link>,
      "The tenant rejected these terms."
    );
  }

  if (lease.status !== LeaseStatus.Active) return null;

  const unlockAt = lease.endTs + lease.returnTimeout;

  if (role === "landlord") {
    return wrap(
      <>
        <button
          className={primaryButton}
          disabled={!!busy}
          onClick={() => run("release_full", {}, "Deposit returned")}
        >
          Return full deposit
        </button>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <input
            className={`${inputClass} w-40 font-mono`}
            inputMode="decimal"
            placeholder={`to tenant, ${TOKEN_SYMBOL}`}
            value={settle}
            onChange={(e) => setSettle(e.target.value)}
          />
          <button
            className={secondaryButton}
            disabled={!!busy || !settle}
            onClick={() => {
              try {
                parseAmount(settle);
              } catch {
                toast.error("Invalid amount");
                return;
              }
              void run("propose_settlement", { toTenant: settle }, "Proposal sent to tenant");
            }}
          >
            Propose partial return
          </button>
        </div>
      </>,
      offer !== null
        ? `You proposed returning ${formatAmount(offer)}. Waiting for the tenant.`
        : `Deposit of ${formatAmount(lease.depositAmount)} is in escrow. If you do nothing, the tenant can claim it in full after ${formatDate(unlockAt)}.`
    );
  }

  return wrap(
    <>
      {offer !== null && (
        <button
          className={primaryButton}
          disabled={!!busy}
          onClick={() =>
            run("accept_settlement", { expected: offer.toString() }, "Settlement accepted")
          }
        >
          Accept {formatAmount(offer)}
        </button>
      )}
      <button
        className={secondaryButton}
        disabled={!!busy || now <= unlockAt}
        onClick={() => run("claim_after_timeout", {}, "Deposit claimed")}
      >
        Claim full deposit
      </button>
    </>,
    offer !== null
      ? `The landlord proposes returning ${formatAmount(offer)} of ${formatAmount(lease.depositAmount)}.`
      : `Your deposit is in escrow. If the landlord does not respond, you can claim it in full after ${formatDate(unlockAt)}.`
  );
}
