# Product decisions, assumptions, and exclusions

This document captures the why behind the product. It supplements the README (usage) and DATA.md (schema/seed) with the decisions that shaped the solution and what was deliberately left out.

## Problem and user

An online commerce operations team frequently depends on engineers for things a dashboard can't answer: verifying data across systems, investigating inconsistencies, and performing actions like issuing refunds. The target user is an operations team member who wants to resolve a refund request themselves through an AI agent, instead of opening an engineering ticket.

The MCP server turns those engineer-only operations into tools an AI agent can call directly, with the business policy enforced by the server — not left up to whatever model happens to be driving the agent.

## Workflow choice (and how it was made)

I considered several workflows:

- Refund processing
- Stuck-order triage
- Payment reconciliation
- Inventory availability

Rather than guessing which one the client would find most valuable, I asked. The client confirmed the refund direction and supplied the exact policy: an automatic refund is allowed only when the amount is at most $150 and does not exceed the paid amount, the order is no more than 30 days old, the customer risk score is below 70, the carrier exception is verified, and no refund already exists for the order. Otherwise a manager-approval escalation is created, retries must not issue a duplicate refund, and a durable audit history must be preserved.

That reply became the spec. The implementation (`src/policy.ts`, the refund tool, and the audit log) follows it directly.

## The MCP is the product, not a wrapper

- **Policy lives in the server.** The refund rules are code (`src/policy.ts`), evaluated on every request, with the failing conditions returned as `reasons`. A thin wrapper would have described the policy in the tool description and trusted the LLM to apply it.
- **Safety is enforced, not suggested.** Idempotency comes from `UNIQUE` constraints on `refunds.order_id` and `escalations.order_id` plus a transaction-safe retry path, so a duplicate refund is impossible at the database level.
- **Every action is audited.** A durable `audit_log` records before/after snapshots, actor, and reason for every refund and escalation.
- **The tools form a workflow.** `get_order` (investigate) → `search_orders` (find) → `refund_order` (act) → `get_audit_log` (prove). Deleting the MCP would delete the product.

## Assumptions

- **Synthetic data only.** All orders, payments, customers, refunds, and audit entries are self-created. No real customer data or production credentials were used (per the assignment).
- **One refund per order.** The seed and schema model a single refund per order; escalation and refund are mutually exclusive for an order.
- **Order status vs. payment status are separate.** Issuing a refund flips the payment to `refunded` and writes a refund record, but does not change the order lifecycle status. The seeded `ORD-701…703` records mirror this intentionally (see DATA.md).
- **A manager approval is created, not executed.** The assignment's core ask is the agent workflow; approving/rejecting escalations is a human step and is left to existing tooling.
- **A single trusted agent acting on refunds.** The MCP exposes a small, deliberate tool surface. It is not a general SQL interface.

## Technical architecture

- **Runtime:** Node.js (>= 22) + TypeScript, compiled with `tsc`.
- **Transport:** MCP Streamable HTTP (JSON-RPC `POST /mcp`), served via Express.
- **Storage:** SQLite via `better-sqlite3` (synchronous, transactional). DB is reseeded on every server start so fresh scenario records are always available.
- **Hosting:** the server runs on a VPS behind nginx as a subdomain (`mcp.chavanpatil.com`), exposed via a Cloudflare tunnel from `chavanpatil.com`, managed as a systemd service. CI (GitHub Actions) builds, runs tests, and deploys via SSH on push to `master`.
- **Safety controls:** per-IP rate limiting on the MCP endpoint (HTTP 429 + `Retry-After`), input validation with a documented `{ ok: false, message }` error contract, read-only default posture, and no destructive tools.

## Out of scope (deliberate exclusions)

Per the assignment's "what not to overbuild":

- No frontend or design system.
- No authentication, user management, or authorization. The endpoint is public and rate-limited for a synthetic demo; real deployment would require auth.
- No complete commerce backend — only the tables the workflow needs.
- No manager-approval execution tool (create-only escalations).
- No CI/CD beyond a single build-test-deploy pipeline.
- No payment-gateway or carrier integration — those states are represented in the synthetic data.

## Tradeoffs

- **SQLite over a real DB**: simple, zero-ops, transactional. Chosen because the dataset is small and synthetic. Would not scale horizontally.
- **Reseed-on-start over a reset tool**: gives repeatable demos without exposing a destructive endpoint. The cost is that all data is ephemeral by design.
- **Per-IP rate limiting over auth**: matches the public-demo constraint. Clients behind a shared NAT share one budget.
- **Small tool surface over generic querying**: a focused 4-tool MCP is easier for an AI consumer to use correctly and safer than exposing arbitrary SQL.

## Next steps (if this were a real product)

- Add an `approve_escalation` tool (with the same idempotency and audit guarantees) to close the loop on the escalation workflow.
- Add authentication/authorization and per-user audit attribution.
- Replace synthetic data with integration to real order/payment/carrier systems via read replicas or webhooks.
- Move audit data to append-only storage.
