import Link from "next/link";
import { Logo } from "./components/brand/logo";
import { ClusterSelect } from "./components/cluster-select";
import { Guilloche } from "./components/guilloche";
import { PassportCard } from "./components/passport-card";
import { ThemeToggle } from "./components/theme-toggle";
import { WalletButton } from "./components/wallet-button";
import { getMockPassport } from "./lib/mock/passport";

const steps = [
  {
    number: "01",
    title: "Put the deposit in escrow",
    description:
      "The deposit waits in escrow, not in the landlord’s account, until you move out.",
  },
  {
    number: "02",
    title: "Hand over the flat",
    description:
      "Move-in and move-out photo protocols are fingerprinted, so neither side can swap them later.",
  },
  {
    number: "03",
    title: "Keep the outcome",
    description:
      "Returned in full, partly, or by an arbiter’s ruling: the result joins your passport.",
  },
];

export default function Home() {
  const passport = getMockPassport("demo");

  if (!passport) return null;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo size={32} />
        </Link>
        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ClusterSelect />
          </div>
          <ThemeToggle />
          <WalletButton />
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <Guilloche className="pointer-events-none absolute inset-x-0 top-1/2 h-[480px] w-full -translate-y-1/2 text-primary opacity-35" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-12 sm:px-6 md:grid-cols-[0.9fr_1.1fr] md:items-center md:pb-28 md:pt-20">
            <div className="max-w-xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-sm border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted">
                <span className="size-1.5 rounded-full bg-primary" />
                Built for renters in Poland
              </div>
              <h1 className="text-balance text-5xl font-medium leading-[1.02] tracking-[-0.01em] sm:text-6xl lg:text-7xl">
                Your rent history. Your proof.
              </h1>
              <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-muted sm:text-lg sm:leading-8">
                A portable record of how your leases ended: deposits returned,
                rent paid on time. Show it to your next landlord without handing
                over private documents.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/passport/demo"
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  View sample passport
                </Link>
                <span className="inline-flex min-h-12 items-center justify-center rounded-md border border-border bg-card px-5 text-sm text-muted">
                  Create passport · coming soon
                </span>
              </div>
              <p className="mt-5 text-xs leading-5 text-muted">
                Hackathon prototype · No personal data is published
              </p>
            </div>

            <div className="relative md:pl-6">
              <div
                aria-hidden="true"
                className="absolute -left-3 -top-3 size-16 border-l border-t border-border md:left-3"
              />
              <PassportCard passport={passport} compact />
              <p className="mt-3 text-right font-mono text-[11px] uppercase tracking-[0.06em] text-muted">
                Sample public record · 01/01
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <div className="grid gap-10 md:grid-cols-[0.75fr_1.25fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                  How it works
                </p>
                <h2 className="mt-3 max-w-sm text-3xl font-medium sm:text-4xl">
                  A record that grows with every lease.
                </h2>
              </div>
              <ol className="border-t border-border">
                {steps.map((step) => (
                  <li
                    key={step.number}
                    className="grid grid-cols-[3rem_1fr] gap-3 border-b border-border py-6 sm:grid-cols-[4rem_0.8fr_1.2fr] sm:items-baseline"
                  >
                    <span className="font-mono text-xs text-muted">
                      {step.number}
                    </span>
                    <h3 className="font-medium">{step.title}</h3>
                    <p className="col-start-2 mt-1 text-sm leading-6 text-muted sm:col-start-auto sm:mt-0">
                      {step.description}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="grid gap-8 rounded-lg border border-border p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                Trust without oversharing
              </p>
              <h2 className="mt-3 text-2xl font-medium sm:text-3xl">
                Verifiable facts, not an invented score.
              </h2>
              <p className="mt-4 leading-7 text-muted">
                Proof of Rent shows how each lease ended, how rent was
                confirmed, and when. Names, addresses, bank details and photos
                are never published.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:max-w-xs md:justify-end">
              {["Deposit outcome", "Landlord confirmed", "No objection"].map(
                (label) => (
                  <span
                    key={label}
                    className="rounded-sm border border-border bg-cream px-3 py-1.5 text-xs font-medium"
                  >
                    {label}
                  </span>
                )
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Proof of Rent · Warsaw hackathon prototype</p>
          <p>Not a credit score</p>
        </div>
      </footer>
    </div>
  );
}
