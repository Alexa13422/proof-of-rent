"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  formatAmount,
  formatDateTime,
  getDisputedLeases,
  settlementOffer,
  shortAddress,
} from "../lib/chain";
import { eyebrow } from "../components/site-header";

export function DisputeList() {
  const { data, isLoading, error } = useSWR("disputes", getDisputedLeases, {
    refreshInterval: 30_000,
  });

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-6">
        <p className={eyebrow}>Deposit disputes</p>
        <h1 className="mt-2 text-3xl font-medium sm:text-4xl">Open disputes</h1>
        <p className="mt-3 max-w-2xl leading-7 text-muted">
          Tenant and landlord could not agree on the deposit. Anyone can read both
          sides; the arbiter decides.
        </p>
      </div>
      {isLoading ? (
        <p className="text-muted">Loading…</p>
      ) : error ? (
        <p className="text-destructive">Could not load disputes.</p>
      ) : !data?.length ? (
        <p className="text-muted">No open disputes.</p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border bg-card">
          {[...data]
            .sort((a, b) => Number(a.disputedAt - b.disputedAt))
            .map((l) => (
              <li
                key={l.address}
                className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
              >
                <Link
                  href={`/offers/${l.address}`}
                  className="grid gap-2 px-5 py-4 hover:bg-cream/50 sm:grid-cols-[1fr_auto] sm:items-center sm:px-7"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{l.area}</p>
                    <p className="mt-1 text-sm text-muted">
                      Opened {formatDateTime(l.disputedAt)} · landlord{" "}
                      <span className="font-mono">{shortAddress(l.landlord)}</span> · tenant{" "}
                      <span className="font-mono">{shortAddress(l.tenant)}</span>
                    </p>
                  </div>
                  <div className="font-mono text-sm tabular-nums sm:text-right">
                    <p>deposit {formatAmount(l.depositAmount)}</p>
                    <p className="text-muted">
                      offered {formatAmount(settlementOffer(l) ?? 0n)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
