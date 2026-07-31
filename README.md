# ecommerce-mcp

MCP server for commerce-operations self-service. Lets an AI agent look up order details and search orders without needing developer or SQL access.

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

Both tools return **structured JSON** (a JSON string in the MCP `text` content block). Tool results are the parsed JSON; never formatted prose.

### Conventions

- **Null contract:** fields are always present. When there is no value (e.g. `tracking`, `notes`), they are `null` — never omitted.
- **Errors:** every error response is `{ "ok": false, "message": "..." }` with the MCP `isError` flag set to `true`. On success `isError` is unset.
- **IDs:** order IDs look like `ORD-001` (`^ORD-\d{3}$`).

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

---

All data is synthetic. The server is exposed over Streamable HTTP (JSON-RPC `POST /mcp`).

## License

ISC
