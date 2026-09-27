import Link from "next/link";
import { AccountButton } from "./components/account-button";
import { Logo } from "./components/brand/logo";
import { PassportCard } from "./components/passport-card";
import { SealRosette } from "./components/seal-rosette";
import { ThemeToggle } from "./components/theme-toggle";
import { getMockPassport } from "./lib/mock/passport";

const steps = [
  { number: "01", title: "Deposit held in escrow" },
  { number: "02", title: "Handover securely recorded" },
  { number: "03", title: "Outcome added to your passport" },
];

function HolographicLines() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-36 w-full"
      viewBox="0 0 1440 180"
      preserveAspectRatio="none"
      fill="none"
    >
      <defs>
        <linearGradient id="holo-line-a" x1="0" y1="0" x2="1440" y2="0">
          <stop offset="0" stopColor="#ff4a1c" stopOpacity="0" />
          <stop offset="0.22" stopColor="#ff4a1c" stopOpacity="0.78" />
          <stop offset="0.46" stopColor="#ffd08a" stopOpacity="0.72" />
          <stop offset="0.65" stopColor="#8adfff" stopOpacity="0.62" />
          <stop offset="0.82" stopColor="#a99aff" stopOpacity="0.58" />
          <stop offset="1" stopColor="#ff9ae0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="holo-line-b" x1="1440" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#ff4a1c" stopOpacity="0" />
          <stop offset="0.3" stopColor="#ff9ae0" stopOpacity="0.42" />
          <stop offset="0.55" stopColor="#8affb8" stopOpacity="0.52" />
          <stop offset="0.75" stopColor="#ffd08a" stopOpacity="0.48" />
          <stop offset="1" stopColor="#ff4a1c" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M-80 137C179 51 350 164 608 91C846 24 1025 133 1520 38"
        stroke="url(#holo-line-a)"
        strokeWidth="1.5"
      />
      <path
        d="M-60 158C222 83 387 173 663 111C931 51 1165 116 1500 60"
        stroke="url(#holo-line-b)"
      />
      <path
        d="M-100 172C186 111 442 176 709 132C1013 82 1192 135 1540 92"
        stroke="url(#holo-line-a)"
        strokeOpacity="0.55"
      />
      <path
        d="M95 180C369 94 556 164 769 105C1020 36 1214 104 1424 54"
        stroke="url(#holo-line-b)"
        strokeOpacity="0.5"
      />
    </svg>
  );
}

export default function Home() {
  const passport = getMockPassport("demo");

  if (!passport) return null;

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:py-6">
        <Link
          href="/"
          aria-label="Proof of Rent home"
          className="flex min-h-11 items-center font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo size={36} />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AccountButton />
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <SealRosette className="pointer-events-none absolute left-[74%] top-[34%] size-[680px] -translate-x-1/2 -translate-y-1/2 text-primary opacity-20 sm:size-[900px] lg:left-[70%] lg:size-[1120px]" />
          <div className="relative mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6 sm:pb-32 sm:pt-28 lg:pb-40 lg:pt-36">
            <div className="max-w-5xl">
              <p className="mb-6 flex items-center gap-3 text-sm font-medium text-primary-ink sm:mb-8">
                <span className="h-px w-8 bg-primary" aria-hidden="true" />
                Built for renters in Poland
              </p>
              <h1 className="max-w-5xl text-balance text-[clamp(4.25rem,10vw,6rem)] font-medium leading-[0.91] tracking-[-0.035em]">
                Your rent history.
                <br />
                <span className="text-primary-ink">Your proof.</span>
              </h1>
              <p className="mt-8 max-w-2xl text-pretty text-lg leading-8 text-muted sm:mt-10 sm:text-xl sm:leading-9">
                A portable record of deposits returned and leases completed —
                without exposing private documents.
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:mt-12 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Create your passport
                </Link>
                <Link
                  href="/passport/demo"
                  className="inline-flex min-h-12 items-center justify-center rounded-md border border-input bg-card px-6 text-sm font-medium transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  View sample
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid max-w-6xl gap-16 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-20 lg:py-36">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-primary-ink">
                Proof, not a score
              </p>
              <h2 className="mt-4 text-balance text-4xl font-medium leading-[1.04] tracking-[-0.02em] sm:text-5xl">
                One clear record for your next home.
              </h2>
              <p className="mt-6 text-lg leading-8 text-muted">
                Verifiable lease outcomes. No names, addresses, bank details, or
                photos published.
              </p>
            </div>
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -left-3 -top-3 size-16 border-l border-t border-primary/60"
              />
              <PassportCard passport={passport} compact />
              <p className="mt-4 text-right font-mono text-xs uppercase tracking-[0.06em] text-muted">
                Sample public record · 01/01
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-36">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-xl text-balance text-4xl font-medium leading-[1.05] tracking-[-0.02em] sm:text-5xl">
              From deposit to trusted record.
            </h2>
            <ol className="w-full max-w-2xl border-t border-border">
              {steps.map((step) => (
                <li
                  key={step.number}
                  className="grid grid-cols-[3rem_1fr] items-center border-b border-border py-6 sm:grid-cols-[4rem_1fr] sm:py-7"
                >
                  <span className="font-mono text-xs text-primary-ink">
                    {step.number}
                  </span>
                  <h3 className="text-lg font-medium sm:text-xl">
                    {step.title}
                  </h3>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-border bg-card">
          <div className="relative z-10 mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-36 pt-20 sm:px-6 sm:pb-40 sm:pt-28 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold text-primary-ink">
                Ready for the next lease?
              </p>
              <h2 className="mt-4 text-balance text-4xl font-medium leading-[1.03] tracking-[-0.02em] sm:text-6xl">
                Let your history speak for you.
              </h2>
            </div>
            <Link
              href="/dashboard"
              className="inline-flex min-h-12 shrink-0 items-center justify-center self-start rounded-md bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:self-auto"
            >
              Get started
            </Link>
          </div>
          <HolographicLines />
        </section>
      </main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-7 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>Proof of Rent · Warsaw hackathon prototype</p>
          <p>Private by design · Not a credit score</p>
        </div>
      </footer>
    </div>
  );
}
