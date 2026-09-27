"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "../lib/auth/use-account";
import { sendAction, useLeases, usePassport } from "../lib/hooks";
import {
  LeaseStatus,
  OUTCOME_LABEL,
  STATUS_LABEL,
  formatAmount,
  formatDate,
  shortAddress,
  type LeaseRecord,
} from "../lib/chain";
import {
  eyebrow,
  primaryButton,
  secondaryButton,
} from "../components/site-header";
import { CopyButton } from "../components/copy-button";
import { PayoutPanel } from "../components/payout-panel";

export function Dashboard() {
  const account = useAccount();
  const passport = usePassport(account.address);
  const leases = useLeases(passport.data ? account.address : null);
  const [busy, setBusy] = useState(false);

  if (!account.ready) return <p className="text-muted">Loading…</p>;

  if (!account.authenticated) {
    return (
      <Panel title="Sign in to get your passport">
        <p className="text-muted">
          One Google account, one passport. No crypto wallet, no fees for
          signing up.
        </p>
        <button className={`${primaryButton} mt-5`} onClick={account.login}>
          Sign in with Google
        </button>
      </Panel>
    );
  }

  if (!account.address) {
    return <p className="text-muted">Creating your wallet…</p>;
  }

  if (!account.signingEnabled) {
    return (
      <Panel title="Allow Proof of Rent to sign for you">
        <p className="text-muted">
          We sign lease actions on your behalf and pay the network fees, so you
          never need crypto. You approve this once; you can revoke it any time
          in your Privy account.
        </p>
        {!account.signingConfigured && (
          <p className="mt-3 text-sm text-destructive">
            Server signing is not configured yet (NEXT_PUBLIC_PRIVY_SIGNER_ID).
          </p>
        )}
        <button
          className={`${primaryButton} mt-5`}
          disabled={account.enabling || !account.signingConfigured}
          onClick={async () => {
            try {
              await account.enableSigning();
              toast.success("Signing enabled");
            } catch {
              toast.error("Could not enable signing");
            }
          }}
        >
          {account.enabling ? "Waiting for approval…" : "Allow signing"}
        </button>
      </Panel>
    );
  }

  if (passport.isLoading) return <p className="text-muted">Loading…</p>;

  if (!passport.data) {
    return (
      <Panel title="Create your rent passport">
        <p className="text-muted">
          Your passport collects how each lease ended. It holds no names,
          addresses or documents, only the outcome of each deposit. Test
          tokens for the demo are added to your account.
        </p>
        <button
          className={`${primaryButton} mt-5`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await sendAction("create_passport");
              toast.success("Passport created");
              await passport.mutate();
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating…" : "Create passport"}
        </button>
      </Panel>
    );
  }

  const incoming = leases.data?.asTenant ?? [];
  const outgoing = leases.data?.asLandlord ?? [];

  return (
    <div className="space-y-12">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <p className={eyebrow}>Your passport ID</p>
          <p className="mt-2 break-all font-mono text-sm">{account.address}</p>
          <p className="mt-1 text-sm text-muted">
            Give this ID to a landlord so they can send you a lease offer.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <CopyButton value={account.address} label="Copy ID" />
          <Link href={`/passport/${account.address}`} className={secondaryButton}>
            View passport
          </Link>
        </div>
      </section>

      {outgoing.length > 0 && (
        <PayoutPanel address={account.address} asLandlord={outgoing} />
      )}

      <LeaseList
        title="Offers to you"
        hint="As a tenant"
        leases={incoming}
        loading={leases.isLoading}
        empty="No offers yet. Share your passport ID with a landlord."
        counterparty="landlord"
      />

      <LeaseList
        title="Offers you sent"
        hint="As a landlord"
        leases={outgoing}
        loading={leases.isLoading}
        empty="You have not offered a lease yet."
        counterparty="tenant"
        action={
          <Link href="/offers/new" className={primaryButton}>
            New lease offer
          </Link>
        }
      />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-xl rounded-lg border border-border bg-card p-6 sm:p-8">
      <h2 className="text-2xl font-medium">{title}</h2>
      <div className="mt-3 leading-7">{children}</div>
    </section>
  );
}

function LeaseList({
  title,
  hint,
  leases,
  loading,
  empty,
  counterparty,
  action,
}: {
  title: string;
  hint: string;
  leases: LeaseRecord[];
  loading: boolean;
  empty: string;
  counterparty: "landlord" | "tenant";
  action?: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className={eyebrow}>{hint}</p>
          <h2 className="mt-2 text-3xl font-medium">{title}</h2>
        </div>
        {action}
      </div>
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : leases.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-6 text-sm text-muted">
          {empty}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-card">
          {leases.map((lease) => (
            <li
              key={lease.address}
              className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
            >
              <Link
                href={`/offers/${lease.address}`}
                className="grid gap-2 px-5 py-5 transition-colors hover:bg-cream/50 sm:grid-cols-[1fr_auto] sm:items-center sm:px-8"
              >
                <div className="min-w-0">
                  <p className="text-lg font-medium">{lease.area}</p>
                  <p className="mt-1 text-sm text-muted">
                    {formatDate(lease.startTs)} –{" "}
                    {formatDate(
                      lease.status === LeaseStatus.Closed &&
                        lease.closedAt > 0n &&
                        lease.closedAt < lease.endTs
                        ? lease.closedAt
                        : lease.endTs
                    )}{" "}
                    · {counterparty}{" "}
                    <span className="font-mono">
                      {shortAddress(lease[counterparty])}
                    </span>
                  </p>
                </div>
                <div className="sm:text-right">
                  <StatusBadge lease={lease} />
                  <p className="mt-2 font-mono font-semibold tabular-nums">
                    {formatAmount(lease.depositAmount)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StatusBadge({ lease }: { lease: LeaseRecord }) {
  const label =
    lease.status === LeaseStatus.Closed
      ? OUTCOME_LABEL[lease.outcome]
      : STATUS_LABEL[lease.status];
  const tone =
    lease.status === LeaseStatus.Disputed
      ? "border-destructive text-destructive"
      : lease.status === LeaseStatus.Offered || lease.status === LeaseStatus.Active
      ? "border-primary text-primary-ink"
      : lease.status === LeaseStatus.Closed
        ? "border-foreground text-foreground"
        : "border-border text-muted";
  return (
    <span
      className={`inline-block rounded-sm border-[1.5px] px-2 py-1 text-xs font-semibold uppercase tracking-[0.06em] ${tone}`}
    >
      {label}
    </span>
  );
}
