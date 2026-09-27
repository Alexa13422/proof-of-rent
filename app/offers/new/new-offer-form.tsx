"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { sendAction } from "../../lib/hooks";
import { useAccount } from "../../lib/auth/use-account";
import { isValidAddress, TOKEN_SYMBOL } from "../../lib/chain";
import { eyebrow, inputClass, primaryButton } from "../../components/site-header";
import { EvidenceInput } from "../../components/evidence";
import { uploadEvidence } from "../../lib/evidence";

function isoDate(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function NewOfferForm() {
  const router = useRouter();
  const account = useAccount();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [form, setForm] = useState({
    tenant: "",
    area: "",
    deposit: "",
    startDate: isoDate(1),
    endDate: isoDate(366),
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const tenantInvalid = form.tenant.length > 0 && !isValidAddress(form.tenant.trim());

  if (!account.authenticated) {
    return <p className="text-muted">Sign in to create a lease offer.</p>;
  }

  return (
    <form
      className="max-w-xl space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          let checkin: string | undefined;
          if (notes.trim() || photos.length) {
            setBusy("Uploading photos…");
            checkin = await uploadEvidence({ kind: "checkin", text: notes, photos });
          }
          setBusy("Sending…");
          const { lease } = await sendAction("create_offer", {
            ...form,
            checkin,
            startDate: `${form.startDate}T00:00:00Z`,
            endDate: `${form.endDate}T00:00:00Z`,
          });
          toast.success("Offer sent to the tenant");
          router.push(lease ? `/offers/${lease}` : "/dashboard");
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(null);
        }
      }}
    >
      <Field label="Tenant passport ID" hint="The tenant finds it in My leases.">
        <input
          required
          className={`${inputClass} font-mono`}
          value={form.tenant}
          onChange={set("tenant")}
          placeholder="7xKp…2mQa"
          aria-invalid={tenantInvalid}
        />
        {tenantInvalid && (
          <p className="mt-1 text-sm text-destructive">Not a valid passport ID.</p>
        )}
      </Field>

      <Field
        label="Area"
        hint="City and district only, never a street address. It is public."
      >
        <input
          required
          maxLength={40}
          className={inputClass}
          value={form.area}
          onChange={set("area")}
          placeholder="Warsaw · Mokotów"
        />
      </Field>

      <Field
        label={`Deposit (${TOKEN_SYMBOL})`}
        hint="Held in escrow until the lease ends."
      >
        <input
          required
          inputMode="decimal"
          className={`${inputClass} font-mono tabular-nums`}
          value={form.deposit}
          onChange={set("deposit")}
          placeholder="6400"
        />
      </Field>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Start date">
          <input
            required
            type="date"
            className={inputClass}
            value={form.startDate}
            onChange={set("startDate")}
          />
        </Field>
        <Field label="End date">
          <input
            required
            type="date"
            className={inputClass}
            value={form.endDate}
            onChange={set("endDate")}
          />
        </Field>
      </div>

      <div>
        <span className={eyebrow}>Move-in condition</span>
        <p className="mt-1 text-sm text-muted">
          Photos of the flat at move-in. They are stored off-chain; their
          fingerprint goes on-chain, so nobody can swap them later. The arbiter
          sees them if there is a dispute.
        </p>
        <div className="mt-3">
          <EvidenceInput
            text={notes}
            photos={photos}
            onText={setNotes}
            onPhotos={setPhotos}
            placeholder="Optional notes: existing scratches, meter readings, inventory…"
          />
        </div>
      </div>

      <p className="rounded-lg border border-border bg-cream/50 px-4 py-3 text-sm leading-6 text-muted">
        The tenant has 7 days to accept. When they accept, they pay the deposit
        by BLIK straight into escrow, plus a 1% platform fee. If they want
        different terms, they reject the offer and you send a new one. What the
        escrow pays you at the end you withdraw for free.
      </p>

      <button type="submit" className={primaryButton} disabled={!!busy || tenantInvalid}>
        {busy ?? "Send offer"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className={eyebrow}>{label}</span>
      <div className="mt-2">{children}</div>
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}
