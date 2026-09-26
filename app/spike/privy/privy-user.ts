import "server-only";

// Verifies a Privy access token and resolves the caller's embedded Solana
// wallet id (needed by @solana/keychain-privy).
//
// ponytail: uses the (deprecated but dependency-clean) @privy-io/server-auth
// SDK — @privy-io/node is the recommended replacement but its @solana/kit
// peer range (^5.1.0) conflicts with this repo's kit 6.x without
// --legacy-peer-deps. Revisit if @privy-io/node bumps its kit peer range.
import { PrivyClient } from "@privy-io/server-auth";

let cachedClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;
  if (!appId) throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set");
  if (!appSecret) throw new Error("PRIVY_APP_SECRET is not set");
  if (!cachedClient) cachedClient = new PrivyClient(appId, appSecret);
  return cachedClient;
}

export type TenantWallet = {
  /** Privy wallet id, required by @solana/keychain-privy's createPrivySigner. */
  walletId: string;
  address: string;
};

/**
 * Verifies the access token server-side and returns the caller's embedded
 * Solana wallet. Throws if the token is invalid or no such wallet exists.
 */
export async function resolveTenantWallet(
  accessToken: string
): Promise<TenantWallet> {
  const privy = getPrivyClient();
  const { userId } = await privy.verifyAuthToken(accessToken);
  const user = await privy.getUserById(userId);

  const embeddedSolanaWallet = user.linkedAccounts.find(
    (account): account is Extract<typeof account, { type: "wallet" }> =>
      account.type === "wallet" &&
      "chainType" in account &&
      account.chainType === "solana" &&
      "walletClientType" in account &&
      account.walletClientType === "privy"
  );

  if (!embeddedSolanaWallet || !embeddedSolanaWallet.id) {
    throw new Error("No embedded Solana wallet found for this user");
  }

  if (!embeddedSolanaWallet.delegated) {
    throw new Error("Embedded Solana wallet is not delegated");
  }

  return {
    walletId: embeddedSolanaWallet.id,
    address: embeddedSolanaWallet.address,
  };
}
