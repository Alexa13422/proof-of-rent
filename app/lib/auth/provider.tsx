"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { PropsWithChildren } from "react";

// Google-only login; every user gets an embedded Solana wallet on first login.
// Transactions are built and paid for by our API (fee payer), so the user
// never needs SOL and never sees a wallet popup.
export function AuthProvider({ children }: PropsWithChildren) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <>{children}</>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["google"],
        appearance: { walletChainType: "solana-only" },
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
