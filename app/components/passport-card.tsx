import { HoloSeal } from "@/app/components/brand/holo-seal";
import { Guilloche } from "@/app/components/guilloche";
import { Stamp } from "@/app/components/stamp";
import { passportFacts, type RentPassport } from "@/app/lib/mock/passport";

type PassportCardProps = {
  passport: RentPassport;
  compact?: boolean;
};

export function PassportCard({ passport, compact = false }: PassportCardProps) {
  const { completedLeases, returnedInFull, documentedMonths } =
    passportFacts(passport);
  // The headline fact a landlord looks for first: did deposits come back?
  const facts = [
    { label: "Deposit back in full", value: `${returnedInFull} of ${completedLeases}`, key: true },
    { label: "Completed leases", value: completedLeases, key: false },
    { label: "Months on record", value: documentedMonths, key: false },
  ];

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <div
        className={`relative overflow-hidden border-b border-border px-5 sm:px-8 ${compact ? "pb-24 pt-6" : "pb-32 pt-7"}`}
      >
        <Guilloche className="pointer-events-none absolute inset-0 size-full text-primary opacity-25" />
        <div className={compact ? "relative pr-24" : "relative pr-28 sm:pr-44"}>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            Tenant passport
          </p>
          <h2
            className={`mt-3 break-all font-medium leading-tight ${compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl"}`}
          >
            {passport.tenantLabel}
          </h2>
          <p className="mt-2 font-mono text-sm text-muted">
            {passport.tenantReference}
            <span aria-hidden="true"> · </span>
            <span className="whitespace-nowrap">since {passport.verifiedSince}</span>
          </p>
        </div>
        {!compact && (
          <HoloSeal
            size={148}
            hash={passport.tenantReference}
            className="absolute -right-10 top-1/2 -translate-y-1/2 sm:right-4"
          />
        )}
        <Stamp
          size={compact ? "sm" : "md"}
          className={`absolute ${compact ? "bottom-4 right-4 sm:right-6" : "bottom-5 left-5 sm:left-8"}`}
        />
      </div>

      <dl className="grid grid-cols-[1.25fr_1fr_1fr] divide-x divide-border">
        {facts.map((f) => (
          <div
            key={f.label}
            className={`px-4 py-5 sm:px-6 sm:py-6 ${f.key ? "bg-primary/[0.06]" : ""}`}
          >
            <dt className="text-xs leading-tight text-muted sm:text-sm">{f.label}</dt>
            <dd
              className={`mt-2 font-mono font-semibold tabular-nums ${
                f.key ? "text-2xl text-primary-ink sm:text-4xl" : "text-2xl sm:text-3xl"
              }`}
            >
              {f.value}
            </dd>
          </div>
        ))}
      </dl>

      {!compact && (
        <div className="border-t border-border bg-cream/50 px-5 py-4 text-sm leading-6 text-muted sm:px-8">
          Shows how finished leases ended and how rent was confirmed. Not a
          credit score; no personal details are published.
        </div>
      )}
    </article>
  );
}
