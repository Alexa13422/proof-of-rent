"use client";

import useSWR from "swr";
import { address as toAddress } from "@solana/kit";
import {
  getLease,
  getLeasesFor,
  getPassport,
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

export type TxResult = { signature: string; lease?: string };

export function sendAction(action: string, body?: Record<string, unknown>) {
  return callApi<TxResult>(`/api/tx/${action}`, body);
}
