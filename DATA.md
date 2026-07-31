# Data model & seed design

This document explains the schema, the synthetic seed data, and why some records are shaped the way they are. It is meant to answer questions that come up when reviewing the refund workflow.

## Schema at a glance

| Table | Purpose | Key constraints |
|---|---|---|
| `customers` | `email` + `risk_score` (used by the refund policy) | `email` PK |
| `orders` | Commerce orders, incl. `carrier_status` | `id` PK |
| `payments` | Per-order payment with `status` and `amount` | `order_id` PK → orders |
| `refunds` | Issued refunds, one per order | `order_id` UNIQUE → orders (blocks duplicates) |
| `escalations` | Manager-approval cases, one per order | `order_id` UNIQUE → orders (blocks duplicates) |
| `audit_log` | Durable before/after trail of every action | — |

The `UNIQUE` constraint on `refunds.order_id` and `escalations.order_id` is what makes `refund_order` idempotent: a second call for the same order cannot create a duplicate, it reports `already_refunded` (or the existing escalation) instead.

## Dataset

24 customers, 39 orders, 39 payments, 4 refunds, 0 escalations, 6 audit entries.

Escalations are **not** seeded — they are created at runtime by `refund_order` when an order is not auto-refundable. Same for post-refund audit entries. That is why `escalations = 0` in a fresh seed.

## Why some records look inconsistent

Two seeded patterns can look like bugs on a first pass. Both are intentional.

### Partial captures: ORD-301, ORD-302, ORD-303

- Order totals: $120.00 / $130.00 / $140.00
- Payment status: `paid`, amounts $100.00 / $110.00 / $125.00

The payment is `paid` but captures less than the order total. That is a real payment-gateway state (partial capture, deposit, or a part-settled card). Its purpose here is to exercise the policy rule *"Amount exceeds the paid amount"* in isolation: the order passes every other check and fails exactly this one, so `reasons` contains a single, predictable entry.

### Refunded but still `processing`: ORD-701, ORD-702, ORD-703

These orders have a refund record and a `refunded` payment, yet `orders.status` is `processing`. This mirrors the server's actual runtime behavior: `refund_order` flips the payment to `refunded` and writes a refund, but never changes the order lifecycle status. Order status and financial status are separate concerns — a refund can be issued while an order still shows `processing`.

Compare `ORD-014`: its payment is `refunded` and its order is `cancelled`, but for a different business reason ("Out of stock"). The two patterns are not meant to be uniform.

## Scenario families → policy rules

Each escalation family is crafted to fail exactly one rule, so the `reasons` array it produces is predictable.

| Orders | Scenario | Fails rule | Example `reasons` entry | Real-world plausibility |
|---|---|---|---|---|
| `ORD-101…103` | Auto-eligible | none | — (auto-refund) | Recent, fully paid, low-risk order with verified carrier damage. |
| `ORD-201…203` | Over auto-refund limit | `orderAmount > $150` | `Amount $199.99 exceeds the $150 auto-refund limit` | High-value items are routed to a human. |
| `ORD-301…303` | Payment captures less than total | `orderAmount > paidAmount` | `Amount $120.00 exceeds the paid amount $100.00` | Partial capture / deposit / part-settled card. |
| `ORD-401…403` | Older than 30 days | `orderAgeDays > 30` | `Order is 78 days old, exceeds the 30-day limit` | Refund requests after the policy window are denied. |
| `ORD-501…503` | High-risk customer | `riskScore >= 70` | `Customer risk score 88 is at or above 70` | Fraud-scored customers are flagged for review. |
| `ORD-601…603` | Carrier exception not verified | `carrierStatus != "exception"` | `Carrier exception not verified (carrier status: delivered)` | Customer claims damage but the carrier shows delivered; must be verified before refunding. |
| `ORD-701…703` | Already refunded | existing refund | — (short-circuits to `already_refunded`) | Refund history is retained; the idempotency guard prevents a second refund. |

## Auto-refund policy

A refund is issued automatically only when **all** of these hold; otherwise the request is escalated to a manager:

- amount ≤ $150
- amount ≤ the paid amount
- payment captured (`paid`)
- order within the last 30 days
- customer risk score below 70
- carrier exception verified (`carrier_status` = `exception`)
- no existing refund for the order

All data is synthetic.
