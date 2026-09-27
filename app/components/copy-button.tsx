"use client";

import { useState } from "react";
import { secondaryButton } from "./site-header";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={secondaryButton}
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // clipboard blocked: leave the label unchanged
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
