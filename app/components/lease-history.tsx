import type { DepositOutcome, Lease } from "@/app/lib/mock/passport";

const outcomes: Record<DepositOutcome, { label: string; className: string }> = {
  "returned-in-full": {
    label: "Returned in full",
    className: "border-primary text-primary-ink",
  },
  "partly-returned": {
    label: "Partly returned",
    className: "border-caution text-caution",
  },
  arbiter: {
    label: "Arbiter ruled",
    className: "border-foreground text-foreground",
  },
};

export function LeaseHistory({ leases }: { leases: Lease[] }) {
  return (
    <section aria-labelledby="lease-history-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            Deposit record
          </p>
          <h2 id="lease-history-title" className="mt-2 text-2xl font-medium">
            Completed leases
          </h2>
        </div>
        <p className="font-mono text-xs text-muted">{leases.length} leases</p>
      </div>

      <ol className="overflow-hidden rounded-lg border border-border bg-card">
        {leases.map((lease) => {
          const outcome = outcomes[lease.outcome];
          return (
            <li
              key={lease.id}
              className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_auto] sm:px-7 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
            >
              <div className="min-w-0">
                <p className="font-medium">{lease.area}</p>
                <p className="mt-1 text-sm text-muted">
                  {lease.period} · {lease.months} months · rent{" "}
                  <span className="font-mono tabular-nums">{lease.rent}</span>
                </p>
                <p className="mt-1 text-sm text-muted">
                  Landlord with {lease.landlordLeases}{" "}
                  {lease.landlordLeases === 1 ? "lease" : "leases"} on record
                </p>
                {lease.outcomeNote && (
                  <p className="mt-3 text-sm leading-6">{lease.outcomeNote}</p>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                <span
                  className={`inline-block rounded-sm border-[1.5px] px-2 py-1 text-xs font-semibold uppercase tracking-[0.06em] ${outcome.className}`}
                >
                  {outcome.label}
                </span>
                <p className="font-mono text-sm tabular-nums sm:mt-2">
                  {lease.returned}{" "}
                  <span className="text-muted">of {lease.deposit}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
