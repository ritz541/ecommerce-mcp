export const MAX_AUTO_REFUND_AMOUNT = 150;
export const MAX_ORDER_AGE_DAYS = 30;
export const MAX_RISK_SCORE = 70;

export interface RefundEligibilityContext {
  orderAmount: number;
  paidAmount: number | null;
  paymentStatus: string;
  orderAgeDays: number;
  riskScore: number;
  carrierStatus: string;
  hasExistingRefund: boolean;
}

export interface RefundEligibility {
  canAutoRefund: boolean;
  reasons: string[];
}

export function daysSince(dateStr: string, now: Date = new Date()): number {
  const created = new Date(dateStr);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

export function evaluateRefundEligibility(ctx: RefundEligibilityContext): RefundEligibility {
  const reasons: string[] = [];

  if (ctx.paymentStatus !== "paid") {
    reasons.push(`Payment not captured (status: ${ctx.paymentStatus})`);
  }
  if (ctx.hasExistingRefund) {
    reasons.push("A refund already exists for this order");
  }
  if (ctx.orderAmount > MAX_AUTO_REFUND_AMOUNT) {
    reasons.push(`Amount $${ctx.orderAmount.toFixed(2)} exceeds the $${MAX_AUTO_REFUND_AMOUNT} auto-refund limit`);
  }
  if (ctx.paidAmount !== null && ctx.orderAmount > ctx.paidAmount) {
    reasons.push(`Amount $${ctx.orderAmount.toFixed(2)} exceeds the paid amount $${ctx.paidAmount.toFixed(2)}`);
  }
  if (ctx.orderAgeDays > MAX_ORDER_AGE_DAYS) {
    reasons.push(`Order is ${ctx.orderAgeDays} days old, exceeds the ${MAX_ORDER_AGE_DAYS}-day limit`);
  }
  if (ctx.riskScore >= MAX_RISK_SCORE) {
    reasons.push(`Customer risk score ${ctx.riskScore} is at or above ${MAX_RISK_SCORE}`);
  }
  if (ctx.carrierStatus !== "exception") {
    reasons.push(`Carrier exception not verified (carrier status: ${ctx.carrierStatus})`);
  }

  return { canAutoRefund: reasons.length === 0, reasons };
}
