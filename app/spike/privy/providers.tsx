"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { PropsWithChildren } from "react";

// Scoped to /spike/privy only — not the app-wide wallet provider.
// Google-only login + an embedded Solana wallet created on first login.
export function PrivySpikeProviders({ children }: PropsWithChildren) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return (
      <div className="p-6 text-sm text-red-500">
        Sign-in is currently unavailable.
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google"],
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
