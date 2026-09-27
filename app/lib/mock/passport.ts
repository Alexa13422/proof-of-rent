export type DepositOutcome = "returned-in-full" | "partly-returned" | "arbiter";
export type PaymentConfirmation = "landlord-confirmed" | "no-objection";
export type PaymentTiming = "on-time" | "late";

export type RentPayment = {
  month: string;
  paidAt: string;
  amount: string;
  timing: PaymentTiming;
  confirmation: PaymentConfirmation;
};

export type Lease = {
  id: string;
  area: string;
  period: string;
  months: number;
  rent: string;
  deposit: string;
  returned: string;
  outcome: DepositOutcome;
  outcomeNote?: string;
  landlordLeases: number;
  payments: RentPayment[];
};

export type LandlordLease = {
  id: string;
  area: string;
  period: string;
  deposit: string;
  returned: string;
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
  tenantLabel: "Demo tenant",
  tenantReference: "7xKp…2mQa",
  verifiedSince: "October 2023",
  leases: [
    {
      id: "waw-mokotow",
      area: "Warsaw · Mokotów",
      period: "Mar 2025 – Feb 2026",
      months: 12,
      rent: "3 200 PLN",
      deposit: "6 400 PLN",
      returned: "6 400 PLN",
      outcome: "returned-in-full",
      landlordLeases: 3,
      payments: [
        {
          month: "February 2026",
          paidAt: "02 Feb 2026",
          amount: "3 200 PLN",
          timing: "on-time",
          confirmation: "landlord-confirmed",
        },
        {
          month: "January 2026",
          paidAt: "03 Jan 2026",
          amount: "3 200 PLN",
          timing: "on-time",
          confirmation: "landlord-confirmed",
        },
        {
          month: "December 2025",
          paidAt: "01 Dec 2025",
          amount: "3 200 PLN",
          timing: "on-time",
          confirmation: "no-objection",
        },
        {
          month: "November 2025",
          paidAt: "12 Nov 2025",
          amount: "3 200 PLN",
          timing: "late",
          confirmation: "landlord-confirmed",
        },
        {
          month: "October 2025",
          paidAt: "02 Oct 2025",
          amount: "3 200 PLN",
          timing: "on-time",
          confirmation: "no-objection",
        },
        {
          month: "September 2025",
          paidAt: "03 Sep 2025",
          amount: "3 200 PLN",
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
      rent: "2 400 PLN",
      deposit: "4 800 PLN",
      returned: "4 200 PLN",
      outcome: "partly-returned",
      outcomeNote:
        "600 PLN kept for a damaged countertop, agreed by both sides.",
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
