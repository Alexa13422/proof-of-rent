"use client";

import { useState } from "react";
import {
  getAccessToken,
  getEmbeddedConnectedWallet,
  useDelegatedActions,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";

// Spike: Google login via Privy (embedded Solana wallet), tenant signs,
// server fee-payer pays and sends. No PII leaves the browser — the API
// route only ever sees a Privy access token and produces a memo tx.
export default function PrivySpikePage() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  const { delegateWallet } = useDelegatedActions();
  const [status, setStatus] = useState<string>("");
  const [signature, setSignature] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const embeddedSolanaWallet = getEmbeddedConnectedWallet(wallets);
  const isDelegated =
    user?.linkedAccounts.some(
      (account) =>
        account.type === "wallet" &&
        "address" in account &&
        account.address === embeddedSolanaWallet?.address &&
        "delegated" in account &&
        account.delegated === true
    ) ?? false;

  async function handleDelegate() {
    if (!embeddedSolanaWallet) return;

    setBusy(true);
    setStatus("Requesting wallet access…");
    try {
      await delegateWallet({
        address: embeddedSolanaWallet.address,
        chainType: "solana",
      });
      setStatus("Wallet access granted.");
    } catch {
      setStatus("Unable to grant wallet access.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    setBusy(true);
    setStatus("Fetching access token…");
    setSignature(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        setStatus("No access token — are you logged in?");
        return;
      }

      setStatus("Preparing test transaction…");
      const res = await fetch("/api/spike/privy/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await res.json();
      if (!res.ok) {
        setStatus("Unable to send the test transaction.");
        return;
      }
      setSignature(body.signature);
      setStatus("Sent.");
    } catch {
      setStatus("Unable to send the test transaction.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <main className="p-8">Loading sign-in…</main>;

  return (
    <main className="mx-auto max-w-lg space-y-4 p-8">
      <h1 className="text-xl font-semibold">Wallet spike (devnet only)</h1>

      {!authenticated ? (
        <button
          className="rounded bg-black px-4 py-2 text-white"
          onClick={() => login()}
        >
          Log in with Google
        </button>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-neutral-500">Logged in with Google</p>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded border px-4 py-2 disabled:opacity-50"
              onClick={handleDelegate}
              disabled={busy || !embeddedSolanaWallet || isDelegated}
            >
              {isDelegated ? "Wallet access granted" : "Allow wallet access"}
            </button>
            <button
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
              onClick={handleSend}
              disabled={busy || !isDelegated}
            >
              Sign + send test memo
            </button>
            <button className="rounded border px-4 py-2" onClick={logout}>
              Log out
            </button>
          </div>
          {!isDelegated && (
            <p className="text-sm text-neutral-500">
              Allow wallet access before sending.
            </p>
          )}
        </div>
      )}

      {status && <p className="text-sm">{status}</p>}
      {signature && (
        <p className="break-all font-mono text-xs">
          Signature: {signature}
        </p>
      )}
    </main>
  );
}
