"use client";

// Landlord payouts. There is no top-up and no free balance: tenants pay a
// deposit straight into a lease's escrow, and only money a closed lease paid
// the landlord can be withdrawn. Demo: forms validate, show a short
// "processing" state and a receipt, and move no funds.
import { useState } from "react";
import { toast } from "sonner";
import { formatAmount, type LeaseRecord } from "../lib/chain";
import { useBalance } from "../lib/hooks";
import { earnedAsLandlord } from "../lib/payments";
import { eyebrow, inputClass, primaryButton, secondaryButton } from "./site-header";

type Method = "blik" | "bank";

export function PayoutPanel({
  address,
  asLandlord,
}: {
  address: string;
  asLandlord: LeaseRecord[];
}) {
  const { data: balance } = useBalance(address);
  const [open, setOpen] = useState(false);
  const earned = earnedAsLandlord(asLandlord);
  // Tokens that did not come from a lease payout (e.g. devnet test tokens)
  // are not withdrawable.
  const available = balance === undefined ? undefined : balance < earned ? balance : earned;

  return (
    <section id="payouts" className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <p className={eyebrow}>Payouts · as a landlord</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
            {available === undefined ? "…" : formatAmount(available)}
          </p>
          <p className="mt-1 max-w-md text-sm text-muted">
            What your closed leases paid you out of escrow. Withdraw to BLIK or a
            bank account, free of charge.
          </p>
        </div>
        <button
          className={open ? primaryButton : secondaryButton}
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          disabled={!available}
        >
          Withdraw
        </button>
      </div>
      {open && available ? (
        <WithdrawForm available={available} onClose={() => setOpen(false)} />
      ) : null}
    </section>
  );
}

function WithdrawForm({ available, onClose }: { available: bigint; onClose: () => void }) {
  const [method, setMethod] = useState<Method>("blik");
  const [amount, setAmount] = useState(() => (Number(available) / 1e6).toString());
  const [phone, setPhone] = useState("");
  const [iban, setIban] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<string | null>(null);

  const value = Number(amount.replace(",", ".").replace(/\s/g, ""));
  const amountOk = Number.isFinite(value) && value > 0;
  const over = amountOk && BigInt(Math.round(value * 1e6)) > available;
  const amountLabel = amountOk ? formatPln(value) : "";
  const cleanIban = iban.replace(/\s/g, "");
  const methodOk =
    method === "blik"
      ? /^\+?[\d\s]{9,15}$/.test(phone)
      : cleanIban.length >= 15 && name.trim().length > 1;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1400));
    setBusy(false);
    setReceipt(
      method === "blik"
        ? `${amountLabel} would be sent by BLIK to ${phone.trim()} within a minute. Fee: 0 PLN.`
        : `${amountLabel} would be sent by bank transfer to ${cleanIban.slice(0, 4)}…${cleanIban.slice(-4)} within one business day. Fee: 0 PLN.`
    );
    toast.success(`Withdrawal by ${method === "blik" ? "BLIK" : "bank transfer"} requested`, {
      description: "Demo only: no real money moved.",
    });
  }

  const tab = (m: Method, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={method === m}
      onClick={() => {
        setMethod(m);
        setReceipt(null);
      }}
      className={`min-h-11 flex-1 cursor-pointer border-b-2 px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
        method === m ? "border-primary text-foreground" : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-7">
        <p className="font-medium">Withdraw to your bank</p>
        <DemoBadge />
      </div>

      <div role="tablist" className="mx-5 mt-4 flex border-b border-border sm:mx-7">
        {tab("blik", "BLIK")}
        {tab("bank", "Bank transfer")}
      </div>

      {receipt ? (
        <div className="space-y-4 px-5 py-6 sm:px-7">
          <Receipt text={receipt} />
          <p className="text-sm text-muted">This is a preview of the flow. Nothing is withdrawn.</p>
          <div className="flex gap-2">
            <button className={secondaryButton} onClick={() => setReceipt(null)}>
              New withdrawal
            </button>
            <button className={secondaryButton} onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5 px-5 py-6 sm:px-7">
          <label className="block">
            <span className={`block ${eyebrow}`}>Amount (PLN)</span>
            <input
              required
              inputMode="decimal"
              className={`${inputClass} mt-2 font-mono tabular-nums sm:w-56`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {over && (
              <span className="mt-1 block text-sm text-destructive">
                More than you can withdraw ({formatAmount(available)}).
              </span>
            )}
          </label>

          {method === "blik" ? (
            <label className="block">
              <span className={`block ${eyebrow}`}>Phone number linked to BLIK</span>
              <input
                required
                type="tel"
                className={`${inputClass} mt-2 font-mono sm:w-72`}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+48 600 000 000"
              />
              <span className="mt-1 block text-sm text-muted">
                Money arrives as a BLIK phone transfer, usually within a minute.
              </span>
            </label>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className={`block ${eyebrow}`}>Account holder</span>
                <input
                  required
                  className={`${inputClass} mt-2`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jan Kowalski"
                  autoComplete="name"
                />
              </label>
              <label className="block">
                <span className={`block ${eyebrow}`}>IBAN</span>
                <input
                  required
                  className={`${inputClass} mt-2 font-mono`}
                  value={iban}
                  onChange={(e) => setIban(e.target.value.toUpperCase())}
                  placeholder="PL00 0000 0000 0000 0000 0000 0000"
                />
              </label>
            </div>
          )}

          <p className="text-sm text-muted">Fee: 0 PLN. Proof of Rent covers the transfer cost.</p>

          <button type="submit" className={primaryButton} disabled={busy || !amountOk || !methodOk || over}>
            {busy ? "Processing…" : `Withdraw ${amountLabel}`.trim()}
          </button>
        </form>
      )}
    </div>
  );
}

/** "3 200 PLN": pl-PL skips grouping below 10 000, so group by hand. */
export function formatPln(value: number): string {
  return `${value.toFixed(value % 1 ? 2 : 0).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, " ")} PLN`;
}

export function DemoBadge() {
  return (
    <span className="shrink-0 rounded-sm border border-border px-2 py-1 text-xs font-semibold uppercase tracking-[0.06em] text-muted">
      Demo · no real payments
    </span>
  );
}

export function Receipt({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-3.5">
          <path d="m5 12 4 4L19 6" />
        </svg>
      </span>
      <p className="text-sm leading-6">{text}</p>
    </div>
  );
}
