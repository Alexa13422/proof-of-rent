export type DepositOutcome = "returned-in-full" | "partly-returned" | "arbiter";
export type PaymentConfirmation = "landlord-confirmed" | "no-objection";
export type PaymentTiming = "on-time" | "late";

export type RentPayment = {
  month: string;
  paidAt: string;
  timing: PaymentTiming;
  confirmation: PaymentConfirmation;
};

export type DepositReturnBand =
  | "100% returned"
  | "75–99% returned"
  | "50–74% returned"
  | "1–49% returned"
  | "0% returned"
  | "Not available";

/** Public passports expose only a broad deposit-return band, never amounts. */
export function depositReturnBand(returned: bigint, deposit: bigint): DepositReturnBand {
  if (deposit <= 0n) return "Not available";
  if (returned >= deposit) return "100% returned";
  if (returned <= 0n) return "0% returned";
  const basisPoints = (returned * 10_000n) / deposit;
  if (basisPoints >= 7_500n) return "75–99% returned";
  if (basisPoints >= 5_000n) return "50–74% returned";
  return "1–49% returned";
}

export type Lease = {
  id: string;
  area: string;
  period: string;
  months: number;
  depositReturn: DepositReturnBand;
  outcome: DepositOutcome;
  outcomeNote?: string;
  landlordLeases: number;
  payments: RentPayment[];
};

export type LandlordLease = {
  id: string;
  area: string;
  period: string;
  depositReturn: DepositReturnBand;
  outcome: DepositOutcome;
};

export type LandlordRecord = {
  leasesClosed: number;
  fullReturns: number;
  disputes: number;
  /** Rent months the landlord confirmed / rejected / let pass without answer. */
  rentConfirmed: number;
  rentRejected: number;
  rentSilent: number;
  leases: LandlordLease[];
};

export type RentPassport = {
  id: string;
  /** Rent log shown under the history: newest lease that has payments. */
  rentLog?: { area: string; payments: RentPayment[] };
  /** Present if this user has rented out at least once. */
  landlord?: LandlordRecord;
  tenantLabel: string;
  tenantReference: string;
  verifiedSince: string;
  /** Completed leases, newest first. Leases shorter than 3 months are never listed. */
  leases: Lease[];
};

const demoPassport: RentPassport = {
  id: "demo",
  tenantLabel: "de••••••@gmail.com",
  tenantReference: "7xKp…2mQa",
  verifiedSince: "October 2023",
  leases: [
    {
      id: "waw-mokotow",
      area: "Warsaw · Mokotów",
      period: "Mar 2025 – Feb 2026",
      months: 12,
      depositReturn: "100% returned",
      outcome: "returned-in-full",
      landlordLeases: 3,
      payments: [
        {
          month: "February 2026",
          paidAt: "02 Feb 2026",
          timing: "on-time",
          confirmation: "landlord-confirmed",
        },
        {
          month: "January 2026",
          paidAt: "03 Jan 2026",
          timing: "on-time",
          confirmation: "landlord-confirmed",
        },
        {
          month: "December 2025",
          paidAt: "01 Dec 2025",
          timing: "on-time",
          confirmation: "no-objection",
        },
        {
          month: "November 2025",
          paidAt: "12 Nov 2025",
          timing: "late",
          confirmation: "landlord-confirmed",
        },
        {
          month: "October 2025",
          paidAt: "02 Oct 2025",
          timing: "on-time",
          confirmation: "no-objection",
        },
        {
          month: "September 2025",
          paidAt: "03 Sep 2025",
          timing: "on-time",
          confirmation: "no-objection",
        },
      ],
    },
    {
      id: "krk-podgorze",
      area: "Kraków · Podgórze",
      period: "Oct 2023 – Jan 2025",
      months: 16,
      depositReturn: "75–99% returned",
      outcome: "partly-returned",
      outcomeNote: "Part of the deposit was kept for damage, agreed by both sides.",
      landlordLeases: 1,
      payments: [],
    },
  ],
};

const passports: Record<string, RentPassport> = {
  [demoPassport.id]: demoPassport,
};

export function getMockPassport(id: string) {
  return passports[id];
}

export function passportFacts(passport: RentPassport) {
  const { leases } = passport;
  return {
    completedLeases: leases.length,
    returnedInFull: leases.filter((l) => l.outcome === "returned-in-full")
      .length,
    documentedMonths: leases.reduce((sum, l) => sum + l.months, 0),
  };
}
