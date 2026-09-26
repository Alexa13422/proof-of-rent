"use client";

import { useState } from "react";

export function SharePassportButton() {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus("copied");
    } catch {
      setStatus("error");
    }

    setTimeout(() => setStatus("idle"), 2000);
  };

  return (
    <button
      type="button"
      onClick={copyLink}
      className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium transition-colors hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      aria-live="polite"
    >
      {status === "copied" ? <CheckIcon /> : <ShareIcon />}
      {status === "copied"
        ? "Link copied"
        : status === "error"
          ? "Copy failed"
          : "Share passport"}
    </button>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}
