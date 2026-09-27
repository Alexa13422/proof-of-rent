import type { Address } from "@solana/kit";
import { explorerAddress, explorerTx, getPassportActivity } from "@/app/lib/activity";

function when(ts: number | null) {
  if (ts === null) return "Pending";
  return new Date(ts * 1000).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

function short(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-8)}`;
}

export async function PassportActivity({ owner }: { owner: Address }) {
  let data: Awaited<ReturnType<typeof getPassportActivity>>;
  try {
    data = await getPassportActivity(owner);
  } catch {
    return (
      <p className="rounded-lg border border-dashed border-border px-5 py-6 text-sm text-muted">
        The on-chain history could not be loaded right now. Refresh to try again.
      </p>
    );
  }
  const { passportAddress, events } = data;

  return (
    <section aria-labelledby="activity-title">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
            On-chain record
          </p>
          <h2 id="activity-title" className="mt-2 text-2xl font-medium">
            Transaction history
          </h2>
        </div>
        <a
          href={explorerAddress(passportAddress)}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-muted underline-offset-4 hover:text-foreground hover:underline"
        >
          Passport account {short(passportAddress)} ↗
        </a>
      </div>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-5 py-6 text-sm text-muted">
          No transactions indexed yet.
        </p>
      ) : (
        <ol className="overflow-hidden rounded-lg border border-border bg-card">
          {events.map((event) => (
            <li
              key={event.signature}
              className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-7 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {event.label}
                  {!event.ok && (
                    <span className="ml-2 text-sm font-normal text-destructive">failed</span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {when(event.blockTime)} · slot{" "}
                  <span className="font-mono tabular-nums">{event.slot.toString()}</span>
                </p>
              </div>
              <a
                href={explorerTx(event.signature)}
                target="_blank"
                rel="noreferrer"
                className="justify-self-start font-mono text-sm underline-offset-4 hover:underline sm:justify-self-end"
              >
                {short(event.signature)} ↗
              </a>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-3 text-sm leading-6 text-muted">
        Each entry is a Solana transaction that changed this passport. Open it
        on Solana Explorer to check who signed it, when, and what it changed.
        Proof of Rent cannot edit or delete these records.
      </p>
    </section>
  );
}
