"use client";

import { useCallback, useMemo, useState } from "react";
import { getAccessToken, usePrivy, useSigners } from "@privy-io/react-auth";

const SIGNER_ID = process.env.NEXT_PUBLIC_PRIVY_SIGNER_ID;
// Limits the server signer to Proof of Rent transactions (scripts/privy-policy.ts).
const POLICY_ID = process.env.NEXT_PUBLIC_PRIVY_POLICY_ID;

type SolanaWalletAccount = {
  type: "wallet";
  address: string;
  chainType?: string;
  walletClientType?: string;
  delegated?: boolean;
};

/** The logged-in user's embedded Solana wallet, as seen by the browser. */
export function useAccount() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { addSigners } = useSigners();
  const [enabling, setEnabling] = useState(false);

  const wallet = useMemo(() => {
    const account = user?.linkedAccounts.find(
      (a) =>
        a.type === "wallet" &&
        (a as SolanaWalletAccount).chainType === "solana" &&
        (a as SolanaWalletAccount).walletClientType === "privy"
    ) as SolanaWalletAccount | undefined;
    return account ?? null;
  }, [user]);

  /** One-time consent: lets our server sign on the user's behalf. */
  const enableSigning = useCallback(async () => {
    if (!wallet || !SIGNER_ID || !POLICY_ID) throw new Error("Signing is not configured");
    setEnabling(true);
    try {
      await addSigners({
        address: wallet.address,
        signers: [{ signerId: SIGNER_ID, policyIds: [POLICY_ID] }],
      });
    } finally {
      setEnabling(false);
    }
  }, [addSigners, wallet]);

  return {
    ready,
    authenticated,
    address: wallet?.address ?? null,
    signingEnabled: Boolean(wallet?.delegated),
    signingConfigured: Boolean(SIGNER_ID && POLICY_ID),
    enabling,
    enableSigning,
    login,
    logout,
  };
}

export class ApiError extends Error {}

/** POST to our API with the Privy access token. */
export async function callApi<T>(path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError("Please log in first.");
  const res = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.error ?? "Something went wrong.");
  return json as T;
}
