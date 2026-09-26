import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/app/components/brand/logo";
import { LeaseHistory } from "@/app/components/lease-history";
import { PassportCard } from "@/app/components/passport-card";
import { PaymentTimeline } from "@/app/components/payment-timeline";
import { SharePassportButton } from "@/app/components/share-passport-button";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { getMockPassport, passportFacts } from "@/app/lib/mock/passport";

type PassportPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PassportPageProps): Promise<Metadata> {
  const { id } = await params;
  const passport = getMockPassport(id);

  if (!passport) return {};

  const { completedLeases, returnedInFull } = passportFacts(passport);
  return {
    title: `${passport.tenantLabel} · Rent passport`,
    description: `${completedLeases} completed leases, deposit returned in full in ${returnedInFull}.`,
  };
}

export default async function PassportPage({ params }: PassportPageProps) {
  const { id } = await params;
  const passport = getMockPassport(id);

  if (!passport) notFound();
  const latest = passport.leases[0];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Logo size={32} mark className="inline-flex sm:hidden" />
            <Logo size={32} className="hidden sm:inline-flex" />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SharePassportButton />
          </div>
        </div>
      </header>

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
          <LeaseHistory leases={passport.leases} />
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
