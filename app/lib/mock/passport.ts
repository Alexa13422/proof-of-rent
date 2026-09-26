export type PaymentVerification = "usdc" | "landlord" | "email";
export type PaymentTiming = "on-time" | "late";

export type RentPayment = {
  month: string;
  paidAt: string;
  amount: string;
  timing: PaymentTiming;
  verification: PaymentVerification;
};

export type RentPassport = {
  id: string;
  tenantLabel: string;
  tenantReference: string;
  verifiedSince: string;
  documentedMonths: number;
  onTimePercentage: number;
  completedLeases: number;
  payments: RentPayment[];
};

const demoPassport: RentPassport = {
  id: "demo",
  tenantLabel: "Demo tenant",
  tenantReference: "7xKp…2mQa",
  verifiedSince: "September 2025",
  documentedMonths: 6,
  onTimePercentage: 100,
  completedLeases: 1,
  payments: [
    {
      month: "February 2026",
      paidAt: "02 Feb 2026",
      amount: "3,200 PLN",
      timing: "on-time",
      verification: "usdc",
    },
    {
      month: "January 2026",
      paidAt: "03 Jan 2026",
      amount: "3,200 PLN",
      timing: "on-time",
      verification: "usdc",
    },
    {
      month: "December 2025",
      paidAt: "01 Dec 2025",
      amount: "3,200 PLN",
      timing: "on-time",
      verification: "landlord",
    },
    {
      month: "November 2025",
      paidAt: "04 Nov 2025",
      amount: "3,200 PLN",
      timing: "on-time",
      verification: "landlord",
    },
    {
      month: "October 2025",
      paidAt: "02 Oct 2025",
      amount: "3,200 PLN",
      timing: "on-time",
      verification: "email",
    },
    {
      month: "September 2025",
      paidAt: "03 Sep 2025",
      amount: "3,200 PLN",
      timing: "on-time",
      verification: "email",
    },
  ],
};

const passports: Record<string, RentPassport> = {
  [demoPassport.id]: demoPassport,
};

export function getMockPassport(id: string) {
  return passports[id];
}
