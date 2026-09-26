import "server-only";

// Verifies a Privy access token and resolves the caller's embedded Solana
// wallet, then builds a server-side signer for it.
//
// Server signing requires, in the Privy dashboard:
//   Wallet infrastructure → Authorization keys → "Create new key"
//   → PRIVY_SIGNER_ID (key quorum id, also exposed as NEXT_PUBLIC_PRIVY_SIGNER_ID)
//   → PRIVY_AUTHORIZATION_KEY (the private key shown once, "wallet-auth:..." )
// The user then grants consent once in the browser (useSigners().addSigners).
//
// ponytail: @privy-io/server-auth is deprecated in favour of @privy-io/node,
// whose @solana/kit peer range conflicts with kit 6.x.
import { PrivyClient } from "@privy-io/server-auth";
import { createPrivySigner } from "@solana/keychain-privy";
import type { TransactionSigner } from "@solana/kit";

let cachedClient: PrivyClient | null = null;

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function getPrivyClient(): PrivyClient {
  if (!cachedClient) {
    cachedClient = new PrivyClient(
      env("NEXT_PUBLIC_PRIVY_APP_ID"),
      env("PRIVY_APP_SECRET")
    );
  }
  return cachedClient;
}

export type UserWallet = {
  address: string;
  /** Null until the user has granted the server signer. */
  walletId: string | null;
  delegated: boolean;
};

export class AuthError extends Error {}

export async function resolveUserWallet(
  authorization: string | null
): Promise<UserWallet> {
  const [scheme, token] = (authorization ?? "").split(" ");
  if (scheme !== "Bearer" || !token) throw new AuthError("Missing token");

  const privy = getPrivyClient();
  let userId: string;
  try {
    ({ userId } = await privy.verifyAuthToken(token));
  } catch {
    throw new AuthError("Invalid token");
  }
  const user = await privy.getUserById(userId);

  const wallet = user.linkedAccounts.find(
    (account): account is Extract<typeof account, { type: "wallet" }> =>
      account.type === "wallet" &&
      "chainType" in account &&
      account.chainType === "solana" &&
      "walletClientType" in account &&
      account.walletClientType === "privy"
  );
  if (!wallet) throw new AuthError("No embedded Solana wallet");

  return {
    address: wallet.address,
    walletId: wallet.id ?? null,
    delegated: Boolean(wallet.delegated),
  };
}

export async function getUserSigner(
  wallet: UserWallet
): Promise<TransactionSigner> {
  if (!wallet.delegated || !wallet.walletId) {
    throw new AuthError("Signing is not enabled for this wallet");
  }
  const signer = await createPrivySigner({
    appId: env("NEXT_PUBLIC_PRIVY_APP_ID"),
    appSecret: env("PRIVY_APP_SECRET"),
    walletId: wallet.walletId,
    authorizationContext: {
      authorization_private_keys: [env("PRIVY_AUTHORIZATION_KEY")],
    },
  });
  return signer as unknown as TransactionSigner;
}
