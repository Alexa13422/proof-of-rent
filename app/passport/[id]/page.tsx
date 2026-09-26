import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LeaseHistory } from "@/app/components/lease-history";
import { PassportCard } from "@/app/components/passport-card";
import { PaymentTimeline } from "@/app/components/payment-timeline";
import { SharePassportButton } from "@/app/components/share-passport-button";
import { SiteHeader } from "@/app/components/site-header";
import { isValidAddress } from "@/app/lib/chain";
import { getMockPassport, passportFacts } from "@/app/lib/mock/passport";
import { getChainPassport } from "@/app/lib/passport";

// On-chain data changes; never serve a stale passport.
export const dynamic = "force-dynamic";

async function loadPassport(id: string) {
  if (id === "demo") return getMockPassport(id);
  if (!isValidAddress(id)) return null;
  return getChainPassport(id);
}

type PassportPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PassportPageProps): Promise<Metadata> {
  const { id } = await params;
  const passport = await loadPassport(id);

  if (!passport) return {};

  const { completedLeases, returnedInFull } = passportFacts(passport);
  return {
    title: `${passport.tenantLabel} · Rent passport`,
    description: `${completedLeases} completed leases, deposit returned in full in ${returnedInFull}.`,
  };
}

export default async function PassportPage({ params }: PassportPageProps) {
  const { id } = await params;
  const passport = await loadPassport(id);

  if (!passport) notFound();
  const latest = passport.leases[0];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <SiteHeader extra={<SharePassportButton />} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-7 flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-sm border border-border px-3 py-1.5 text-xs font-medium">
              <span className="size-1.5 rounded-full bg-primary" />
              Public record
            </div>
            <h1 className="text-3xl font-medium sm:text-4xl">Rent passport</h1>
          </div>
          <p className="max-w-xs text-sm leading-6 text-muted sm:text-right">
            How this tenant’s leases ended and how rent was paid. No private
            details are shown.
          </p>
        </div>

        <PassportCard passport={passport} />

        <div className="mt-12">
          {passport.leases.length > 0 ? (
            <LeaseHistory leases={passport.leases} />
          ) : (
            <p className="rounded-lg border border-dashed border-border px-5 py-6 text-sm text-muted">
              No completed leases yet. A lease appears here once its deposit
              is settled.
            </p>
          )}
        </div>

        {latest && latest.payments.length > 0 && (
          <div className="mt-12">
            <PaymentTimeline
              payments={latest.payments}
              leaseArea={latest.area}
            />
          </div>
        )}

        <aside className="mt-8 rounded-lg border border-border bg-cream/50 px-5 py-5 text-sm leading-6 text-muted sm:px-7">
          <strong className="font-medium text-foreground">
            How records are confirmed:
          </strong>{" "}
          a deposit outcome is written when escrow releases the deposit, by the
          landlord, by agreement or by an arbiter. A rent payment is confirmed
          by the landlord, or counts as unchallenged once the landlord’s
          objection window has passed. Leases shorter than three months are not
          counted.
        </aside>
      </main>

      <footer className="mx-auto flex max-w-4xl items-center justify-between gap-4 border-t border-border px-4 py-7 text-xs text-muted sm:px-6">
        <span>Proof of Rent</span>
        <span className="font-mono">Record ID: {passport.id}</span>
      </footer>
    </div>
  );
}
