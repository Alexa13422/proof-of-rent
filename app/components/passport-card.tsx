import { HoloSeal } from "@/app/components/brand/holo-seal";
import { Guilloche } from "@/app/components/guilloche";
import { passportFacts, type RentPassport } from "@/app/lib/mock/passport";

type PassportCardProps = {
  passport: RentPassport;
  compact?: boolean;
};

export function PassportCard({ passport, compact = false }: PassportCardProps) {
  const { completedLeases, returnedInFull, documentedMonths } =
    passportFacts(passport);
  const facts = [
    ["Completed leases", completedLeases],
    ["Deposit back in full", `${returnedInFull} of ${completedLeases}`],
    ["Months on record", documentedMonths],
  ] as const;

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <div
        className={`relative overflow-hidden border-b border-border px-5 py-5 sm:px-7 ${compact ? "min-h-40" : "min-h-52"}`}
      >
        <Guilloche className="pointer-events-none absolute inset-0 size-full text-primary opacity-25" />
        <div className={compact ? "relative pr-20" : "relative pr-24 sm:pr-36"}>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            Tenant passport
          </p>
          <h2 className="mt-3 text-xl font-medium sm:text-2xl">
            {passport.tenantLabel}
          </h2>
          <p className="mt-1 font-mono text-sm text-muted">
            {passport.tenantReference}
          </p>
        </div>
        {!compact && (
          <HoloSeal
            size={132}
            hash={passport.tenantReference}
            className="absolute -right-8 top-1/2 -translate-y-1/2 sm:right-2"
          />
        )}
        <div
          className={`absolute bottom-4 -rotate-3 rounded-sm bg-primary px-2.5 py-2 text-center text-[11px] font-semibold uppercase leading-tight tracking-[0.06em] text-primary-foreground ${compact ? "right-4 sm:right-6" : "left-5 sm:left-7"}`}
        >
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
          Lease records since{" "}
          <span className="font-mono">{passport.verifiedSince}</span>
        </p>
      </div>

      {!compact && (
        <div className="border-t border-border bg-cream/50 px-5 py-4 text-sm leading-6 text-muted sm:px-7">
          This passport shows how finished leases ended and how rent was
          confirmed. It is not a credit score and publishes no personal details.
        </div>
      )}
    </article>
  );
}

function CheckIcon() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="size-3.5"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    </span>
  );
}
