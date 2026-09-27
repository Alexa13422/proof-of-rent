import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./brand/logo";
import { ThemeToggle } from "./theme-toggle";
import { AccountButton } from "./account-button";

export function SiteHeader({
  width = "max-w-5xl",
  extra,
}: {
  width?: string;
  extra?: ReactNode;
}) {
  return (
    <header className="border-b border-border bg-background/95">
      <div
        className={`mx-auto flex ${width} items-center justify-between gap-3 px-4 py-4 sm:px-6`}
      >
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Logo size={32} mark className="inline-flex sm:hidden" />
          <Logo size={32} className="hidden sm:inline-flex" />
        </Link>
        <div className="flex items-center gap-2">
          {extra}
          <ThemeToggle />
          <AccountButton />
        </div>
      </div>
    </header>
  );
}

export const primaryButton =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50";

export const secondaryButton =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-input bg-card px-5 text-sm font-medium transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50";

export const dangerButton =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-destructive px-5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50";

export const inputClass =
  "min-h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export const eyebrow =
  "text-xs font-semibold uppercase tracking-[0.06em] text-muted";
