"use client";

// Demo notifications. Nothing is actually emailed or texted: after an action
// lands we only show what the other party *would* receive.
import { toast } from "sonner";

type Who = "tenant" | "landlord" | "both parties";

const MESSAGES: Record<string, { title: string; who: Who; text: string }> = {
  create_offer: {
    title: "Invitation sent",
    who: "tenant",
    text: "was invited to review the lease offer.",
  },
  accept_offer: {
    title: "Landlord notified",
    who: "landlord",
    text: "was told the offer is accepted and the deposit is in escrow.",
  },
  reject_offer: {
    title: "Landlord notified",
    who: "landlord",
    text: "was told you rejected the offer.",
  },
  cancel_offer: {
    title: "Tenant notified",
    who: "tenant",
    text: "was told the offer was withdrawn.",
  },
  claim_rent: {
    title: "Landlord asked to confirm",
    who: "landlord",
    text: "got a request to confirm this month’s rent.",
  },
  confirm_rent: {
    title: "Result recorded · tenant notified",
    who: "tenant",
    text: "was told the payment is confirmed and added to their passport.",
  },
  reject_rent: {
    title: "Tenant notified",
    who: "tenant",
    text: "was told the payment was not received.",
  },
  release_full: {
    title: "Result recorded · tenant notified",
    who: "tenant",
    text: "was told the full deposit is returned.",
  },
  propose_settlement: {
    title: "Tenant notified",
    who: "tenant",
    text: "got your proposal and can accept or dispute it.",
  },
  accept_settlement: {
    title: "Result recorded · landlord notified",
    who: "landlord",
    text: "was told you accepted the settlement.",
  },
  finalize_settlement: {
    title: "Result recorded · tenant notified",
    who: "tenant",
    text: "was told the deposit is settled.",
  },
  claim_after_timeout: {
    title: "Result recorded · landlord notified",
    who: "landlord",
    text: "was told you claimed the deposit after the deadline.",
  },
  open_dispute: {
    title: "Landlord notified",
    who: "landlord",
    text: "was told a dispute is open and the arbiter will review it.",
  },
  submit_evidence: {
    title: "Other party notified",
    who: "both parties",
    text: "can now read your statement in the dispute file.",
  },
  resolve_dispute: {
    title: "Ruling recorded",
    who: "both parties",
    text: "were told the arbiter’s ruling.",
  },
};

export function notifyCounterparty(action: string, email?: string) {
  const m = MESSAGES[action];
  if (!m) return;
  const who = email ?? `The ${m.who}`;
  toast(m.title, {
    description: (
      <>
        {who} {m.text}
        <span className="mt-1 block text-xs opacity-70">
          Sent by email and SMS · demo, nothing actually sent
        </span>
      </>
    ),
    icon: <EnvelopeIcon />,
    duration: 7000,
  });
}

function EnvelopeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-4 text-primary"
    >
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}
