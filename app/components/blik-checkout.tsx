"use client";

// Demo BLIK checkout: the tenant pays a deposit (or a dispute bond) straight
// into one lease's escrow. The BLIK part is simulated; after the code
// "clears", the real on-chain action runs (devnet test tokens stand in for
// the PLN the payment provider would convert).
import { useState } from "react";
import { eyebrow, inputClass, primaryButton, secondaryButton } from "./site-header";
import { DemoBadge } from "./payout-panel";

export function BlikCheckout({
  amountLabel,
  purpose,
  cta,
  disabled,
  onPaid,
  onCancel,
}: {
  amountLabel: string;
  purpose: string;
  cta: string;
  disabled?: boolean;
  /** Runs the on-chain action; throws to show an error. */
  onPaid: () => Promise<void>;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"code" | "bank" | "chain">("code");
  const busy = stage !== "code";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStage("bank");
    await new Promise((r) => setTimeout(r, 1400));
    setStage("chain");
    try {
      await onPaid();
    } finally {
      setStage("code");
      setCode("");
    }
  }

  return (
    <form onSubmit={submit} className="w-full space-y-4 rounded-md border border-border p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">Pay {amountLabel} with BLIK</p>
          <p className="mt-1 text-sm text-muted">{purpose}</p>
        </div>
        <DemoBadge />
      </div>
      <label className="block">
        <span className={`block ${eyebrow}`}>BLIK code</span>
        <input
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          disabled={busy}
          className={`${inputClass} mt-2 font-mono text-lg tracking-[0.06em] tabular-nums sm:w-56`}
          value={code.length > 3 ? `${code.slice(0, 3)} ${code.slice(3)}` : code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="123 456"
        />
        <span className="mt-1 block text-sm text-muted">
          Generate a 6-digit code in your banking app, then confirm the payment there.
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={primaryButton} disabled={busy || disabled || code.length !== 6}>
          {stage === "bank" ? "Confirm in your bank app…" : stage === "chain" ? "Locking in escrow…" : cta}
        </button>
        <button type="button" className={secondaryButton} disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
