"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount } from "../lib/auth/use-account";
import { shortAddress } from "../lib/chain";

const buttonClass =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50";

export function AccountButton() {
  const { ready, authenticated, address, login, logout } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!ready) {
    return (
      <span className={`${buttonClass} border border-border text-muted`}>
        …
      </span>
    );
  }

  if (!authenticated) {
    return (
      <button
        type="button"
        onClick={login}
        className={`${buttonClass} bg-primary text-primary-foreground hover:bg-primary/90`}
      >
        Sign in with Google
      </button>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${buttonClass} gap-2 border border-border bg-card hover:border-foreground`}
      >
        <span className="size-2 rounded-sm bg-primary" />
        <span className="font-mono text-xs">
          {address ? shortAddress(address) : "Account"}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card p-2 text-sm">
          <Link
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center rounded-md px-3 hover:bg-cream"
          >
            My leases
          </Link>
          {address && (
            <Link
              href={`/passport/${address}`}
              onClick={() => setOpen(false)}
              className="flex min-h-11 items-center rounded-md px-3 hover:bg-cream"
            >
              My passport
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void logout();
            }}
            className="flex min-h-11 w-full cursor-pointer items-center rounded-md px-3 text-left text-destructive hover:bg-cream"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
