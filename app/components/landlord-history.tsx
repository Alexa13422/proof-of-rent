import type { LandlordRecord } from "@/app/lib/mock/passport";

const OUTCOME_LABEL = {
  "returned-in-full": "Returned in full",
  "partly-returned": "Partly returned",
  arbiter: "Arbiter ruled",
} as const;

/** How this user behaves as a landlord: deposits returned, rent confirmed. */
export function LandlordHistory({ record }: { record: LandlordRecord }) {
  const facts = [
    ["Leases closed", record.leasesClosed],
    ["Deposit back in full", `${record.fullReturns} of ${record.leasesClosed}`],
    ["Disputes", record.disputes],
    ["Rent confirmed", record.rentConfirmed],
    ["Rent rejected", record.rentRejected],
    ["Left unanswered", record.rentSilent],
  ] as const;

  return (
    <section aria-labelledby="landlord-history-title">
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
          As a landlord
        </p>
        <h2 id="landlord-history-title" className="mt-2 text-2xl font-medium">
          Landlord record
        </h2>
      </div>

      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3">
        {facts.map(([label, value]) => (
          <div key={label} className="border-b border-r border-border px-4 py-4 sm:px-5">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-2 font-mono text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {record.leases.length > 0 && (
        <ol className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
          {record.leases.map((l) => (
            <li
              key={l.id}
              className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-7 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
            >
              <div>
                <p className="font-medium">{l.area}</p>
                <p className="mt-1 text-sm text-muted">{l.period}</p>
              </div>
              <div className="text-sm sm:text-right">
                <p className="font-semibold uppercase tracking-[0.06em] text-xs">
                  {OUTCOME_LABEL[l.outcome]}
                </p>
                <p className="mt-1 font-mono tabular-nums">
                  {l.returned} <span className="text-muted">of {l.deposit}</span>
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
