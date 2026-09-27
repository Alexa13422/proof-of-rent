"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "../../lib/auth/use-account";
import { sendAction, useLease } from "../../lib/hooks";
import useSWR from "swr";
import {
  DepositOutcome,
  LeaseStatus,
  disputeBond,
  formatAmount,
  formatDate,
  formatDateTime,
  getConfig,
  parseAmount,
  responseDeadline,
  returnDeadline,
  settlementOffer,
  TOKEN_SYMBOL,
  type LeaseRecord,
} from "../../lib/chain";
import { hashOrNull, uploadEvidence } from "../../lib/evidence";
import { EvidenceInput, EvidenceView } from "../../components/evidence";
import { RentMonths } from "../../components/rent-months";
import {
  dangerButton,
  eyebrow,
  inputClass,
  primaryButton,
  secondaryButton,
} from "../../components/site-header";
import { StatusBadge } from "../../dashboard/dashboard";

export function OfferView({ id }: { id: string }) {
  const { data: lease, isLoading, mutate } = useLease(id);
  const account = useAccount();
  const { data: config } = useSWR("config", getConfig);

  if (isLoading) return <p className="text-muted">Loading…</p>;
  if (!lease) return <p className="text-muted">This offer does not exist.</p>;

  const role =
    account.address === lease.landlord
      ? "landlord"
      : account.address === lease.tenant
        ? "tenant"
        : null;
  const isArbiter =
    !!account.address &&
    !!config &&
    (account.address === config.arbiter || account.address === config.admin);
  const checkin = hashOrNull(lease.checkinHash);
  const landlordEvidence = hashOrNull(lease.landlordEvidence);
  const tenantEvidence = hashOrNull(lease.tenantEvidence);
  const disputed =
    lease.status === LeaseStatus.Disputed ||
    lease.outcome === DepositOutcome.ArbiterResolved;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={eyebrow}>Lease offer</p>
          <h1 className="mt-2 text-3xl font-medium sm:text-4xl">{lease.area}</h1>
        </div>
        <StatusBadge lease={lease} />
      </div>

      <Terms lease={lease} />

      {role ? (
        <Actions lease={lease} role={role} onDone={() => mutate()} />
      ) : isArbiter && lease.status === LeaseStatus.Disputed ? null : (
        <p className="text-sm text-muted">
          {account.authenticated
            ? "You are not a party to this lease."
            : "Sign in to respond to this offer."}
        </p>
      )}

      {isArbiter && lease.status === LeaseStatus.Disputed && (
        <Resolve lease={lease} onDone={() => mutate()} />
      )}

      {(disputed || landlordEvidence) && (
        <div className="space-y-4">
          <h2 className="text-xl font-medium">
            {disputed ? "Dispute file" : "Landlord’s reasons"}
          </h2>
          {disputed && (
            <p className="text-sm leading-6 text-muted">
              Public record. Each statement’s fingerprint is stored on-chain,
              so neither side can change it without it showing.
            </p>
          )}
          <EvidenceView hash={landlordEvidence} title="Landlord" />
          {disputed && <EvidenceView hash={tenantEvidence} title="Tenant" />}
        </div>
      )}

      <RentMonths lease={lease} role={role} />

      {checkin && <EvidenceView hash={checkin} title="Move-in condition" />}
    </div>
  );
}

function Terms({ lease }: { lease: LeaseRecord }) {
  const total = lease.depositAmount + lease.feeAmount;
  const rows: [string, React.ReactNode][] = [
    ["Period", `${formatDate(lease.startTs)} – ${formatDate(lease.endTs)}`],
    ["Monthly rent", <Mono key="r">{formatAmount(lease.monthlyRent)}</Mono>],
    ["Deposit (escrow)", <Mono key="d">{formatAmount(lease.depositAmount)}</Mono>],
    ["Platform fee", <Mono key="f">{formatAmount(lease.feeAmount)}</Mono>],
    ["Tenant pays on accept", <Mono key="t">{formatAmount(total)}</Mono>],
    ["Offer valid until", formatDate(lease.acceptDeadline)],
    ["Landlord", <Mono key="l">{lease.landlord}</Mono>],
    ["Tenant", <Mono key="tn">{lease.tenant}</Mono>],
  ];
  return (
    <dl className="overflow-hidden rounded-lg border border-border bg-card">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 px-5 py-3 sm:grid-cols-[12rem_1fr] sm:px-7 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
        >
          <dt className="text-sm text-muted">{label}</dt>
          <dd className="min-w-0 break-all text-sm">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>;
}

function Actions({
  lease,
  role,
  onDone,
}: {
  lease: LeaseRecord;
  role: "landlord" | "tenant";
  onDone: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [settle, setSettle] = useState("");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [now] = useState(() => BigInt(Math.floor(Date.now() / 1000)));
  const offer = settlementOffer(lease);

  async function run(action: string, body: Record<string, unknown> = {}, ok = "Done") {
    setBusy(action);
    try {
      await sendAction(action, { lease: lease.address, ...body });
      toast.success(ok);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function upload(kind: "proposal" | "dispute") {
    setBusy("upload");
    try {
      return await uploadEvidence({ kind, text, photos });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
      return null;
    }
  }

  const wrap = (children: React.ReactNode, note?: string) => (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-7">
      {note && <p className="mb-4 leading-7 text-muted">{note}</p>}
      <div className="flex flex-wrap gap-3">{children}</div>
    </section>
  );

  if (lease.status === LeaseStatus.Offered) {
    if (role === "tenant") {
      const expired = now > lease.acceptDeadline;
      return wrap(
        <>
          <button
            className={primaryButton}
            disabled={!!busy || expired}
            onClick={() => run("accept_offer", {}, "Offer accepted, deposit in escrow")}
          >
            {busy === "accept_offer"
              ? "Paying…"
              : `Accept and pay ${formatAmount(lease.depositAmount + lease.feeAmount)}`}
          </button>
          <button
            className={dangerButton}
            disabled={!!busy}
            onClick={() => run("reject_offer", {}, "Offer rejected")}
          >
            Reject
          </button>
        </>,
        expired
          ? "This offer has expired. Ask the landlord for a new one."
          : "Accepting locks the deposit in escrow: neither side can take it alone. Want different terms? Reject it and the landlord can send a new offer."
      );
    }
    return wrap(
      <button
        className={dangerButton}
        disabled={!!busy}
        onClick={() => run("cancel_offer", {}, "Offer withdrawn")}
      >
        Withdraw offer
      </button>,
      "Waiting for the tenant to accept or reject."
    );
  }

  if (lease.status === LeaseStatus.Disputed) {
    return <DisputeActions lease={lease} role={role} onDone={onDone} />;
  }

  if (lease.status === LeaseStatus.Rejected && role === "landlord") {
    return wrap(
      <Link href="/offers/new" className={primaryButton}>
        Send a revised offer
      </Link>,
      "The tenant rejected these terms."
    );
  }

  if (lease.status !== LeaseStatus.Active) return null;

  const returnBy = returnDeadline(lease);
  const respondBy = responseDeadline(lease);
  const returnOpen = now <= returnBy;
  const responseOpen = offer !== null && now <= respondBy;

  if (role === "landlord") {
    if (offer !== null) {
      return wrap(
        !responseOpen && (
          <button
            className={primaryButton}
            disabled={!!busy}
            onClick={() => run("finalize_settlement", {}, "Deposit settled")}
          >
            Settle: {formatAmount(offer)} to tenant
          </button>
        ),
        responseOpen
          ? `You proposed returning ${formatAmount(offer)}. The tenant can accept or dispute it until ${formatDateTime(respondBy)}; if they stay silent, it settles automatically.`
          : `The tenant did not respond to your proposal of ${formatAmount(offer)}. Settle it now.`
      );
    }
    if (!returnOpen) {
      return wrap(
        null,
        `The return window ended on ${formatDateTime(returnBy)}. The tenant can now claim the full deposit.`
      );
    }
    return (
      <section className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-7">
        <p className="leading-7 text-muted">
          Deposit of {formatAmount(lease.depositAmount)} is in escrow. Return it or
          propose a partial return by {formatDateTime(returnBy)}. If you do nothing,
          the tenant can claim it in full.
        </p>
        <button
          className={primaryButton}
          disabled={!!busy}
          onClick={() => run("release_full", {}, "Deposit returned")}
        >
          Return full deposit
        </button>
        <div className="space-y-3 border-t border-border pt-6">
          <p className="font-medium">Or propose a partial return</p>
          <p className="text-sm text-muted">
            One proposal only. Explain the deductions and add photos: the tenant can
            dispute it, and then the arbiter decides using this evidence.
          </p>
          <input
            className={`${inputClass} w-48 font-mono`}
            inputMode="decimal"
            placeholder={`to tenant, ${TOKEN_SYMBOL}`}
            value={settle}
            onChange={(e) => setSettle(e.target.value)}
          />
          <EvidenceInput
            text={text}
            photos={photos}
            onText={setText}
            onPhotos={setPhotos}
            placeholder="What is damaged and what does it cost to fix?"
            required
          />
          <button
            className={secondaryButton}
            disabled={!!busy || !settle || !text.trim()}
            onClick={async () => {
              let amount: bigint;
              try {
                amount = parseAmount(settle);
              } catch {
                toast.error("Invalid amount");
                return;
              }
              if (amount >= lease.depositAmount) {
                toast.error("To return everything, use Return full deposit");
                return;
              }
              const evidence = await upload("proposal");
              if (evidence) {
                void run("propose_settlement", { toTenant: settle, evidence }, "Proposal sent to tenant");
              }
            }}
          >
            {busy === "upload" ? "Uploading…" : "Propose partial return"}
          </button>
        </div>
      </section>
    );
  }

  // tenant
  if (offer === null) {
    return wrap(
      <button
        className={primaryButton}
        disabled={!!busy || returnOpen}
        onClick={() => run("claim_after_timeout", {}, "Deposit claimed")}
      >
        Claim full deposit
      </button>,
      returnOpen
        ? `Your deposit is in escrow. The landlord has until ${formatDateTime(returnBy)} to return it or propose a deduction. If they do not respond, you can claim it in full.`
        : "The landlord did not respond in time. You can claim the full deposit."
    );
  }
  if (!responseOpen) {
    return wrap(
      <button
        className={primaryButton}
        disabled={!!busy}
        onClick={() => run("finalize_settlement", {}, "Deposit settled")}
      >
        Receive {formatAmount(offer)}
      </button>,
      `The time to dispute ended on ${formatDateTime(respondBy)}. The landlord’s proposal of ${formatAmount(offer)} stands.`
    );
  }
  const bond = disputeBond(lease.depositAmount);
  return (
    <section className="space-y-6 rounded-lg border border-border bg-card p-5 sm:p-7">
      <p className="leading-7 text-muted">
        The landlord proposes returning <strong>{formatAmount(offer)}</strong> of{" "}
        {formatAmount(lease.depositAmount)}. Their reasons are below. Respond by{" "}
        {formatDateTime(respondBy)}; if you stay silent, the proposal settles.
      </p>
      <button
        className={primaryButton}
        disabled={!!busy}
        onClick={() => run("accept_settlement", { expected: offer.toString() }, "Settlement accepted")}
      >
        Accept {formatAmount(offer)}
      </button>
      <div className="space-y-3 border-t border-border pt-6">
        <p className="font-medium">Disagree? Open a dispute</p>
        <p className="text-sm leading-6 text-muted">
          The arbiter reviews both sides and decides how much you get. You post a
          bond of {formatAmount(bond)}: you get it back if the arbiter awards you more
          than {formatAmount(offer)}, and then the landlord pays the same amount
          instead. Otherwise the bond goes to the platform.
        </p>
        <EvidenceInput
          text={text}
          photos={photos}
          onText={setText}
          onPhotos={setPhotos}
          placeholder="Why is the proposal unfair? Add photos of the flat at move-out."
          required
        />
        <button
          className={dangerButton}
          disabled={!!busy || !text.trim()}
          onClick={async () => {
            const evidence = await upload("dispute");
            if (evidence) void run("open_dispute", { evidence }, "Dispute opened");
          }}
        >
          {busy === "upload" ? "Uploading…" : `Dispute (bond ${formatAmount(bond)})`}
        </button>
      </div>
    </section>
  );
}

function DisputeActions({
  lease,
  role,
  onDone,
}: {
  lease: LeaseRecord;
  role: "landlord" | "tenant";
  onDone: () => void;
}) {
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const mine = hashOrNull(role === "tenant" ? lease.tenantEvidence : lease.landlordEvidence);

  return (
    <section className="space-y-3 rounded-lg border border-destructive/40 bg-card p-5 sm:p-7">
      <p className="leading-7 text-muted">
        This deposit is in dispute since {formatDateTime(lease.disputedAt)}. Nobody can
        move it until the arbiter decides. You can add to your statement below; the
        arbiter sees the full history.
      </p>
      <EvidenceInput
        text={text}
        photos={photos}
        onText={setText}
        onPhotos={setPhotos}
        placeholder="Add an argument or more photos"
      />
      <button
        className={secondaryButton}
        disabled={busy || (!text.trim() && photos.length === 0)}
        onClick={async () => {
          setBusy(true);
          try {
            const evidence = await uploadEvidence({ kind: "statement", text, photos, prev: mine });
            await sendAction("submit_evidence", { lease: lease.address, evidence });
            setText("");
            setPhotos([]);
            toast.success("Statement added");
            onDone();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Saving…" : "Add to my statement"}
      </button>
    </section>
  );
}

function Resolve({ lease, onDone }: { lease: LeaseRecord; onDone: () => void }) {
  const offer = settlementOffer(lease) ?? 0n;
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const bond = lease.disputeBond;

  let parsed: bigint | null = null;
  try {
    parsed = amount ? parseAmount(amount) : null;
  } catch {
    parsed = null;
  }
  const valid = parsed !== null && parsed <= lease.depositAmount;
  const tenantWins = valid && parsed! > offer;

  const preset = (v: bigint) => setAmount((Number(v) / 1e6).toString());

  return (
    <section className="space-y-4 rounded-lg border-2 border-primary bg-card p-5 sm:p-7">
      <p className="font-medium">Arbiter decision</p>
      <p className="text-sm leading-6 text-muted">
        Landlord offered {formatAmount(offer)} of {formatAmount(lease.depositAmount)}.
        Tenant posted a bond of {formatAmount(bond)}. Read both statements below, then
        set how much of the deposit goes to the tenant.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className={secondaryButton} onClick={() => preset(offer)}>
          Landlord&apos;s offer
        </button>
        <button className={secondaryButton} onClick={() => preset(lease.depositAmount)}>
          Full deposit
        </button>
      </div>
      <input
        className={`${inputClass} w-48 font-mono`}
        inputMode="decimal"
        placeholder={`to tenant, ${TOKEN_SYMBOL}`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {valid && (
        <p className="text-sm leading-6">
          {tenantWins
            ? `Tenant wins: gets ${formatAmount(parsed!)} + bond back; landlord gets ${formatAmount(lease.depositAmount - parsed! - (bond < lease.depositAmount - parsed! ? bond : lease.depositAmount - parsed!))} and pays the bond to the platform.`
            : `Landlord wins: tenant gets ${formatAmount(parsed!)}, landlord ${formatAmount(lease.depositAmount - parsed!)}; the tenant’s bond goes to the platform.`}
        </p>
      )}
      <button
        className={primaryButton}
        disabled={busy || !valid}
        onClick={async () => {
          setBusy(true);
          try {
            await sendAction("resolve_dispute", { lease: lease.address, toTenant: amount });
            toast.success("Dispute resolved");
            onDone();
          } catch (e) {
            toast.error((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Resolving…" : "Resolve dispute"}
      </button>
    </section>
  );
}
