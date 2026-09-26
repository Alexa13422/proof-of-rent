import type { RentPassport } from "@/app/lib/mock/passport";

type PassportCardProps = {
  passport: RentPassport;
  compact?: boolean;
};

export function PassportCard({ passport, compact = false }: PassportCardProps) {
  const facts = [
    ["Documented months", passport.documentedMonths],
    ["Paid on time", `${passport.onTimePercentage}%`],
    ["Completed leases", passport.completedLeases],
  ] as const;

  return (
    <article className="overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-[0_18px_50px_-40px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-5 sm:px-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Tenant passport
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
            {passport.tenantLabel}
          </h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {passport.tenantReference}
          </p>
        </div>
        <div className="-rotate-2 rounded-md border border-dashed border-emerald-700 px-2.5 py-2 text-center text-[10px] font-bold uppercase leading-tight tracking-[0.14em] text-emerald-700 dark:border-emerald-400 dark:text-emerald-400">
          Verified
          <br />
          record
        </div>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {facts.map(([label, value]) => (
          <div key={label} className="px-3 py-4 sm:px-5 sm:py-5">
            <dt className="text-[11px] leading-tight text-muted sm:text-xs">
              {label}
            </dt>
            <dd className="mt-2 font-mono text-xl font-semibold tabular-nums sm:text-2xl">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center gap-3 px-5 py-4 text-sm sm:px-7">
        <CheckIcon />
        <p>
          Verified rental records since{" "}
          <span className="font-mono">{passport.verifiedSince}</span>
        </p>
      </div>

      {!compact && (
        <div className="border-t border-border bg-cream/50 px-5 py-4 text-sm leading-6 text-muted sm:px-7">
          This passport reports documented rent records. It does not use a
          hidden credit score or expose personal information on-chain.
        </div>
      )}
    </article>
  );
}

function CheckIcon() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="size-3.5"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    </span>
  );
}
