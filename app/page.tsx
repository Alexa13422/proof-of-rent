import Link from "next/link";
import { ClusterSelect } from "./components/cluster-select";
import { PassportCard } from "./components/passport-card";
import { ThemeToggle } from "./components/theme-toggle";
import { WalletButton } from "./components/wallet-button";
import { getMockPassport } from "./lib/mock/passport";

const steps = [
  {
    number: "01",
    title: "Create a lease",
    description: "Both sides agree on rent, deposit, and key dates.",
  },
  {
    number: "02",
    title: "Build the record",
    description: "Each verified rent payment becomes a portable fact.",
  },
  {
    number: "03",
    title: "Share the passport",
    description: "A future landlord can review the history from one link.",
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
          <Mark />
          Proof of Rent
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
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-12 sm:px-6 md:grid-cols-[0.9fr_1.1fr] md:items-center md:pb-28 md:pt-20">
          <div className="max-w-xl">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Built for renters in Poland
            </div>
            <h1 className="text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              Your rent history. Your proof.
            </h1>
            <p className="mt-6 max-w-lg text-pretty text-base leading-7 text-muted sm:text-lg sm:leading-8">
              A portable record of verified rent payments that helps renters
              prove reliability without exposing private documents.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/passport/demo"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-reduce:transform-none"
              >
                View sample passport
              </Link>
              <span className="inline-flex min-h-12 items-center justify-center rounded-lg border border-border px-5 text-sm text-muted">
                Create passport · coming soon
              </span>
            </div>
            <p className="mt-5 text-xs leading-5 text-muted">
              Devnet preview · No personal data stored on-chain
            </p>
          </div>

          <div className="relative md:pl-6">
            <div
              aria-hidden="true"
              className="absolute -left-3 -top-3 size-16 border-l border-t border-border md:left-3"
            />
            <PassportCard passport={passport} compact />
            <p className="mt-3 text-right font-mono text-[11px] uppercase tracking-[0.15em] text-muted">
              Sample public record · 01/01
            </p>
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
            <div className="grid gap-10 md:grid-cols-[0.75fr_1.25fr]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  How it works
                </p>
                <h2 className="mt-3 max-w-sm text-3xl font-semibold tracking-tight sm:text-4xl">
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
          <div className="grid gap-8 rounded-2xl border border-border p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Trust without oversharing
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
                Verifiable facts, not an invented score.
              </h2>
              <p className="mt-4 leading-7 text-muted">
                Proof of Rent shows what was documented, how it was verified,
                and when it happened. Names, addresses, bank details, and photos
                stay off-chain.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:max-w-xs md:justify-end">
              {["USDC verified", "Landlord confirmed", "Email proof"].map(
                (label) => (
                  <span
                    key={label}
                    className="rounded-full border border-border bg-cream px-3 py-1.5 text-xs font-medium"
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
          <p>Solana devnet · Not a credit score</p>
        </div>
      </footer>
    </div>
  );
}

function Mark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg border border-foreground bg-foreground text-primary-foreground">
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
