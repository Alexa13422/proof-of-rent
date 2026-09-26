import type {
  PaymentConfirmation,
  PaymentTiming,
  RentPayment,
} from "@/app/lib/mock/passport";

const confirmationLabels: Record<PaymentConfirmation, string> = {
  "landlord-confirmed": "Landlord confirmed",
  "no-objection": "No objection",
};

const timingLabels: Record<PaymentTiming, string> = {
  "on-time": "Paid on time",
  late: "Paid late",
};

export function PaymentTimeline({
  payments,
  leaseArea,
}: {
  payments: RentPayment[];
  leaseArea: string;
}) {
  return (
    <section aria-labelledby="payment-history-title">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            Rent log · {leaseArea}
          </p>
          <h2 id="payment-history-title" className="mt-2 text-2xl font-medium">
            Rent payments
          </h2>
        </div>
        <p className="font-mono text-xs text-muted">{payments.length} months</p>
      </div>

      <ol className="overflow-hidden rounded-lg border border-border bg-card">
        {payments.map((payment) => (
          <li
            key={payment.month}
            className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-7 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
          >
            <div className="flex min-w-0 gap-3">
              <span
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border ${
                  payment.timing === "on-time"
                    ? "border-primary/40 bg-primary/10 text-primary-ink"
                    : "border-caution/40 bg-caution/10 text-caution"
                }`}
              >
                {payment.timing === "on-time" ? <CheckIcon /> : <ClockIcon />}
              </span>
              <div className="min-w-0">
                <p className="font-medium">{payment.month}</p>
                <p className="mt-1 text-sm text-muted">
                  {timingLabels[payment.timing]} ·{" "}
                  {confirmationLabels[payment.confirmation]}
                </p>
              </div>
            </div>
            <div className="ml-10 flex items-baseline justify-between gap-5 sm:ml-0 sm:block sm:text-right">
              <p className="font-mono text-sm font-medium tabular-nums">
                {payment.amount}
              </p>
              <p className="mt-1 font-mono text-xs tabular-nums text-muted">
                {payment.paidAt}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
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
      className="size-3.5"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="size-3.5"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}
