import assert from "node:assert/strict";
import { leasePeriods, rentClaimAvailability } from "../app/lib/chain.ts";

const utc = (value: string) => BigInt(Date.parse(value) / 1000);
const lease = {
  startTs: utc("2026-09-28T00:00:00Z"),
  endTs: utc("2027-09-27T00:00:00Z"),
};

assert.equal(leasePeriods(lease as never)[0], 202609, "signing month must be included");
assert.deepEqual(
  rentClaimAvailability(202609, utc("2026-09-27T12:00:00Z"), lease.startTs),
  { open: false, opensAt: utc("2026-09-28T00:00:00Z") }
);
assert.deepEqual(
  rentClaimAvailability(202609, utc("2026-09-28T12:00:00Z"), lease.startTs),
  { open: true, opensAt: utc("2026-09-28T00:00:00Z") }
);
assert.deepEqual(
  rentClaimAvailability(202610, utc("2026-09-27T12:00:00Z")),
  { open: false, opensAt: utc("2026-10-22T00:00:00Z") }
);
console.log("rent period and claim availability OK");
