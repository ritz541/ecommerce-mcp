# ecommerce-mcp

MCP server for commerce-operations self-service. Lets an AI agent look up order details, search orders, and process refunds (with manager-approval escalation) without needing developer or SQL access.

**Endpoint:** `https://mcp.chavanpatil.com/mcp`

The server is already hosted. Point an MCP client at the endpoint above and it will discover and call the tools below.

## Connecting an agent harness

### Claude Code CLI

```bash
claude mcp add --transport http ecommerce-mcp https://mcp.chavanpatil.com/mcp
```

Verify the connection:

```bash
claude mcp list
```

Then ask Claude to use the tools, e.g.:

> Use the ecommerce-mcp tools to look up order ORD-001 and summarize it.

## MCP Tools

All tools return **structured JSON** (a JSON string in the MCP `text` content block). Tool results are the parsed JSON; never formatted prose.

### Conventions

- **Null contract:** fields are always present. When there is no value (e.g. `tracking`, `notes`), they are `null` — never omitted.
- **Errors:** every error response is `{ "ok": false, "message": "..." }` with the MCP `isError` flag set to `true`. On success `isError` is unset.
- **Unknown parameters:** unrecognized arguments are silently ignored (never an error).
- **Sort order:** `search_orders` results are sorted by `created` descending, with `id` descending as a tiebreaker — the sort is deterministic and stable for pagination.
- **IDs:** order IDs look like `ORD-001` (`^ORD-\d{3}$`); refund IDs `REF-<hex>` and escalation IDs `ESC-<hex>` are generated per action.

### `get_order(orderId)`

Look up a single order by ID.

| Param | Type | Required | Notes |
|---|---|---|---|
| `orderId` | string | yes | e.g. `ORD-001`, matches `^ORD-\d{3}$` |

Response — a single order object:

| Field | Type |
|---|---|
| `id` | string |
| `customer` | string |
| `email` | string |
| `status` | string — `pending` / `processing` / `shipped` / `delivered` / `cancelled` |
| `items` | array of `{ name: string, qty: number, price: number }` |
| `total` | number |
| `created` | string (YYYY-MM-DD) |
| `tracking` | string \| null |
| `notes` | string \| null |

Example request → response:

```json
{ "orderId": "ORD-004" }
```

```json
{
  "id": "ORD-004",
  "customer": "Dave Wilson",
  "email": "dave@example.com",
  "status": "pending",
  "items": [{ "name": "Laptop Stand", "qty": 1, "price": 44.99 }],
  "total": 44.99,
  "created": "2026-07-10",
  "tracking": null,
  "notes": "Awaiting payment"
}
```

Error example — `get_order({ "orderId": "ORD-999" })`:

```json
{ "ok": false, "message": "Order ORD-999 not found." }
```

### `search_orders(filters)`

Search orders, newest first. All filters are optional and combined with AND.

| Param | Type | Required | Notes |
|---|---|---|---|
| `status` | string | no | enum: `pending` / `processing` / `shipped` / `delivered` / `cancelled` |
| `customer` | string | no | substring match |
| `email` | string | no | substring match |
| `dateFrom` | string | no | `created >= date` (YYYY-MM-DD) |
| `dateTo` | string | no | `created <= date` (YYYY-MM-DD) |
| `limit` | number | no | 1–10, default 10 (silently clamped) |
| `offset` | number | no | default 0, for pagination |

Response — a JSON array of order objects (list view: no `items`/`notes`):

| Field | Type |
|---|---|
| `id` | string |
| `customer` | string |
| `email` | string |
| `status` | string |
| `total` | number |
| `created` | string |
| `tracking` | string \| null |

Example — page 2 of shipped orders:

```json
{ "status": "shipped", "limit": 2, "offset": 2 }
```

```json
[]
```

No matches returns an empty array (not an error).

### `refund_order(orderId, reason)`

Process a refund request against the client's refund policy. Idempotent: retries never issue a duplicate refund or a duplicate escalation.

| Param | Type | Required | Notes |
|---|---|---|---|
| `orderId` | string | yes | e.g. `ORD-016`, matches `^ORD-\d{3}$` |
| `reason` | string | yes | non-empty; recorded in the audit log |

The order is checked against the refund policy **automatically**. A refund is issued immediately only when **all** of these hold:

- amount ≤ $150
- amount ≤ the paid amount (payment captured as `paid`)
- order created within the last 30 days
- customer risk score below 70
- the carrier exception is verified (`carrier_status` is `exception`)
- no refund already exists for the order

Otherwise the request is flagged for **manager approval** (an escalation is created) with the failing conditions listed as `reasons`.

Response — `mode` is one of:

| Field | Type | Notes |
|---|---|---|
| `ok` | boolean | always `true` on a handled outcome |
| `mode` | string | `automatic` \| `escalated` \| `already_refunded` |
| `refundId` / `escalationId` | string | only for `automatic` / `escalated` |
| `amount` | number | only for `automatic` |
| `refundedAt` | string | only for `automatic` (ISO timestamp) |
| `reasons` | string[] | only for `escalated` — why auto-refund was denied |
| `status` | string | only for `escalated` — `pending_approval` |
| `refund` | object | only for `already_refunded` — the existing refund |

Example — eligible order refunded automatically:

```json
{ "orderId": "ORD-016", "reason": "Damaged on delivery; carrier exception confirmed" }
```

```json
{
  "ok": true,
  "mode": "automatic",
  "orderId": "ORD-016",
  "refundId": "REF-3f9a1c2d",
  "amount": 49.99,
  "refundedAt": "2026-07-31T14:02:11.000Z",
  "message": "Refund issued automatically."
}
```

Example — order too old, escalated to a manager:

```json
{ "orderId": "ORD-017", "reason": "Customer requests refund" }
```

```json
{
  "ok": true,
  "mode": "escalated",
  "orderId": "ORD-017",
  "escalationId": "ESC-7b4e209a",
  "status": "pending_approval",
  "reasons": ["Order is older than the 30-day window", "Carrier exception is not verified"],
  "message": "Refund requires manager approval."
}
```

Re-running `refund_order` on the same order returns the existing outcome (`mode: "already_refunded"` or the same escalation) instead of creating a second record.

### `get_audit_log(orderId)`

Return the durable audit trail for an order — every refund/escalation action with before/after snapshots.

| Param | Type | Required | Notes |
|---|---|---|---|
| `orderId` | string | yes | e.g. `ORD-016`, matches `^ORD-\d{3}$` |

Response — a JSON array of audit entries, newest first:

| Field | Type |
|---|---|
| `ts` | string (ISO timestamp) |
| `orderId` | string |
| `action` | string — `refund.automatic` / `refund.escalated` |
| `actor` | string |
| `reason` | string |
| `before` | JSON string — payment snapshot before the action |
| `after` | JSON string — outcome snapshot (e.g. `refundId`, amount, escalation reasons) |
| `outcome` | string — `refunded` / `escalated` |

Example — after refunding `ORD-016`:

```json
{ "orderId": "ORD-016" }
```

```json
[
  {
    "ts": "2026-07-31T14:02:11.000Z",
    "orderId": "ORD-016",
    "action": "refund.automatic",
    "actor": "ops_agent",
    "reason": "Damaged on delivery; carrier exception confirmed",
    "before": "{\"status\":\"paid\",\"amount\":49.99,\"method\":\"credit_card\"}",
    "after": "{\"paymentStatus\":\"refunded\",\"refundId\":\"REF-3f9a1c2d\",\"amount\":49.99}",
    "outcome": "refunded"
  }
]
```

## Demo order map

The seed ships several orders that exercise each refund outcome, three per scenario. Use a fresh order each time you want to re-demo a path (no reset needed).

| Scenario | Orders | `refund_order` result |
|---|---|---|
| Auto-eligible | `ORD-101` … `ORD-103` | `automatic` |
| Over the $150 auto-refund limit | `ORD-201` … `ORD-203` | `escalated` (amount limit) |
| Amount exceeds the paid amount | `ORD-301` … `ORD-303` | `escalated` (paid amount) |
| Older than 30 days | `ORD-401` … `ORD-403` | `escalated` (age) |
| High-risk customer | `ORD-501` … `ORD-503` | `escalated` (risk score) |
| Carrier exception not verified | `ORD-601` … `ORD-603` | `escalated` (carrier status) |
| Already refunded | `ORD-701` … `ORD-703` | `already_refunded` |

Each escalation order fails exactly one rule, so `reasons` contains a single entry. See [`DATA.md`](DATA.md) for the schema, seed rationale, and why certain records look inconsistent.

---

All data is synthetic. The server is exposed over Streamable HTTP (JSON-RPC `POST /mcp`).

## License

ISC
