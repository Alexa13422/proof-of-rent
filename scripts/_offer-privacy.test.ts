import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const form = readFileSync("app/offers/new/new-offer-form.tsx", "utf8");
const route = readFileSync("app/api/tx/[action]/route.ts", "utf8");
const offer = readFileSync("app/offers/[id]/offer-view.tsx", "utf8");
const rentLog = readFileSync("app/components/rent-months.tsx", "utf8");

assert.ok(!form.includes('rent: ""'), "offer form still stores monthly rent");
assert.ok(!form.includes('set("rent")'), "offer form still renders monthly rent input");
assert.ok(!form.includes("DEPOSIT_CAP_MONTHS"), "offer form still derives a cap from monthly rent");
assert.ok(route.includes("monthlyRent: 0n"), "API must redact monthly rent before writing on-chain");
assert.ok(!route.includes('str(body, "rent")'), "API still accepts an exact monthly rent");
assert.ok(!offer.includes('["Monthly rent"'), "lease details still expose monthly rent");
assert.ok(!rentLog.includes("formatAmount(lease.monthlyRent)"), "rent log still exposes monthly rent");

console.log("offer monthly-rent privacy OK");
