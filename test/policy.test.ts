import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateRefundEligibility,
  daysSince,
  MAX_AUTO_REFUND_AMOUNT,
  MAX_ORDER_AGE_DAYS,
  MAX_RISK_SCORE,
  type RefundEligibilityContext,
} from "../src/policy.js";

function baseContext(overrides: Partial<RefundEligibilityContext> = {}): RefundEligibilityContext {
  return {
    orderAmount: 49.99,
    paidAmount: 49.99,
    paymentStatus: "paid",
    orderAgeDays: 2,
    riskScore: 20,
    carrierStatus: "exception",
    hasExistingRefund: false,
    ...overrides,
  };
}

test("all rules pass => auto-refund allowed", () => {
  const { canAutoRefund, reasons } = evaluateRefundEligibility(baseContext());
  assert.equal(canAutoRefund, true);
  assert.deepEqual(reasons, []);
});

test("amount over the limit is rejected", () => {
  const { canAutoRefund, reasons } = evaluateRefundEligibility(baseContext({ orderAmount: MAX_AUTO_REFUND_AMOUNT + 1 }));
  assert.equal(canAutoRefund, false);
  assert.ok(reasons.some((r) => r.includes("auto-refund limit")));
});

test("amount over the paid amount is rejected", () => {
  const { canAutoRefund, reasons } = evaluateRefundEligibility(baseContext({ orderAmount: 60, paidAmount: 50 }));
  assert.equal(canAutoRefund, false);
  assert.ok(reasons.some((r) => r.includes("exceeds the paid amount")));
});

test("order older than the limit is rejected", () => {
  const { canAutoRefund, reasons } = evaluateRefundEligibility(baseContext({ orderAgeDays: MAX_ORDER_AGE_DAYS + 1 }));
  assert.equal(canAutoRefund, false);
  assert.ok(reasons.some((r) => r.includes("days old")));
});

test("high-risk customer is rejected", () => {
  const { canAutoRefund, reasons } = evaluateRefundEligibility(baseContext({ riskScore: MAX_RISK_SCORE }));
  assert.equal(canAutoRefund, false);
  assert.ok(reasons.some((r) => r.includes("risk score")));
});

test("unverified carrier exception is rejected", () => {
  const { canAutoRefund, reasons } = evaluateRefundEligibility(baseContext({ carrierStatus: "delivered" }));
  assert.equal(canAutoRefund, false);
  assert.ok(reasons.some((r) => r.includes("Carrier exception not verified")));
});

test("uncaptured payment is rejected", () => {
  const { canAutoRefund, reasons } = evaluateRefundEligibility(baseContext({ paymentStatus: "pending" }));
  assert.equal(canAutoRefund, false);
  assert.ok(reasons.some((r) => r.includes("Payment not captured")));
});

test("existing refund blocks another refund", () => {
  const { canAutoRefund, reasons } = evaluateRefundEligibility(baseContext({ hasExistingRefund: true }));
  assert.equal(canAutoRefund, false);
  assert.ok(reasons.some((r) => r.includes("already exists")));
});

test("multiple failures are all reported", () => {
  const { canAutoRefund, reasons } = evaluateRefundEligibility(
    baseContext({ orderAmount: 200, orderAgeDays: 45, riskScore: 80, carrierStatus: "delivered" })
  );
  assert.equal(canAutoRefund, false);
  assert.equal(reasons.length, 5);
});

test("daysSince computes elapsed days", () => {
  const now = new Date("2026-07-31T12:00:00Z");
  assert.equal(daysSince("2026-07-29T00:00:00Z", now), 2);
  assert.equal(daysSince("2026-06-10T00:00:00Z", now), 51);
});
