import assert from "node:assert/strict";
import { depositReturnBand, getMockPassport } from "../app/lib/mock/passport.ts";

assert.equal(depositReturnBand(0n, 10_000n), "0% returned");
assert.equal(depositReturnBand(1n, 10_000n), "1–49% returned");
assert.equal(depositReturnBand(4_999n, 10_000n), "1–49% returned");
assert.equal(depositReturnBand(5_000n, 10_000n), "50–74% returned");
assert.equal(depositReturnBand(7_500n, 10_000n), "75–99% returned");
assert.equal(depositReturnBand(9_999n, 10_000n), "75–99% returned");
assert.equal(depositReturnBand(10_000n, 10_000n), "100% returned");
assert.equal(depositReturnBand(12_000n, 10_000n), "100% returned");
assert.equal(depositReturnBand(0n, 0n), "Not available");

const demo = getMockPassport("demo")!;
const serialized = JSON.stringify(demo);
for (const privateField of ["rent", "deposit", "returned", "amount"]) {
  assert.ok(!serialized.includes(`\"${privateField}\"`), `demo leaks ${privateField}`);
}
for (const exactAmount of ["3 200 PLN", "6 400 PLN", "4 800 PLN", "4 200 PLN", "600 PLN"]) {
  assert.ok(!serialized.includes(exactAmount), `demo leaks ${exactAmount}`);
}
assert.deepEqual(
  demo.leases.map((l) => l.depositReturn),
  ["100% returned", "75–99% returned"]
);
console.log("passport privacy bands and demo fixture OK");
