"use client";

import useSWR, { mutate } from "swr";
import { address as toAddress } from "@solana/kit";
import {
  getLease,
  getLeasesFor,
  getPassport,
  getTokenBalance,
  type LeaseRecord,
  type Passport,
} from "./chain";
import { callApi } from "./auth/use-account";

export function usePassport(owner: string | null) {
  return useSWR<Passport | null>(owner ? ["passport", owner] : null, () =>
    getPassport(toAddress(owner!))
  );
}

export function useLeases(owner: string | null) {
  return useSWR<{ asLandlord: LeaseRecord[]; asTenant: LeaseRecord[] }>(
    owner ? ["leases", owner] : null,
    async () => {
      const addr = toAddress(owner!);
      const [asLandlord, asTenant] = await Promise.all([
        getLeasesFor(addr, "landlord"),
        getLeasesFor(addr, "tenant"),
      ]);
      return { asLandlord, asTenant };
    },
    { refreshInterval: 15_000 }
  );
}

export function useLease(lease: string) {
  return useSWR<LeaseRecord | null>(["lease", lease], () =>
    getLease(toAddress(lease))
  );
}

export function useBalance(owner: string | null) {
  return useSWR<bigint>(
    owner ? ["balance", owner] : null,
    () => getTokenBalance(toAddress(owner!)),
    { refreshInterval: 15_000 }
  );
}

export type TxResult = { signature: string; lease?: string };

export async function sendAction(action: string, body?: Record<string, unknown>) {
  const result = await callApi<TxResult>(`/api/tx/${action}`, body);
  // Deposits, refunds and the starter mint all move tokens.
  void mutate((key) => Array.isArray(key) && key[0] === "balance");
  return result;
}
