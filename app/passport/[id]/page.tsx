import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PassportCard } from "@/app/components/passport-card";
import { PaymentTimeline } from "@/app/components/payment-timeline";
import { SharePassportButton } from "@/app/components/share-passport-button";
import { ThemeToggle } from "@/app/components/theme-toggle";
import { getMockPassport } from "@/app/lib/mock/passport";

type PassportPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: PassportPageProps): Promise<Metadata> {
  const { id } = await params;
  const passport = getMockPassport(id);

  if (!passport) return {};

  return {
    title: `${passport.tenantLabel} · Rent passport`,
    description: `${passport.documentedMonths} documented rent payments with ${passport.onTimePercentage}% paid on time.`,
  };
}

export default async function PassportPage({ params }: PassportPageProps) {
  const { id } = await params;
  const passport = getMockPassport(id);

  if (!passport) notFound();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Mark />
            <span className="hidden sm:inline">Proof of Rent</span>
            <span className="sm:hidden">PoR</span>
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
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium">
              <span className="size-1.5 rounded-full bg-blue-500" />
              Public record · Devnet
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Rent passport
            </h1>
          </div>
          <p className="max-w-xs text-sm leading-6 text-muted sm:text-right">
            A factual summary of documented rental payments. No private tenant
            details are shown.
          </p>
        </div>

        <PassportCard passport={passport} />

        <div className="mt-12">
          <PaymentTimeline payments={passport.payments} />
        </div>

        <aside className="mt-8 rounded-xl border border-border bg-cream/50 px-5 py-5 text-sm leading-6 text-muted sm:px-7">
          <strong className="font-medium text-foreground">
            Verification levels:
          </strong>{" "}
          USDC records are verified from payment activity; landlord records are
          confirmed by the counterparty; email records use bank notification
          evidence. An unconfirmed record would not mean an unpaid record.
        </aside>
      </main>

      <footer className="mx-auto flex max-w-4xl items-center justify-between gap-4 border-t border-border px-4 py-7 text-xs text-muted sm:px-6">
        <span>Proof of Rent</span>
        <span className="font-mono">Record ID: {passport.id}</span>
      </footer>
    </div>
  );
}

function Mark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="size-4"
      >
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v5h5M10 13h6M10 17h4" />
      </svg>
    </span>
  );
}
