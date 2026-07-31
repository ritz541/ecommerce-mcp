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

- **`get_order(orderId)`** — Look up a single order by ID (e.g. `ORD-001`). Returns customer, items, status, tracking, and notes.
- **`search_orders(filters)`** — Search orders by status, customer, email, date range. Optionally limit results.

Example agent prompts:

- "Look up order ORD-003" → `get_order({orderId: "ORD-003"})`
- "How many orders are pending?" → `search_orders({status: "pending"})`

---

All data is synthetic. The server is exposed over Streamable HTTP (JSON-RPC `POST /mcp`).

## License

ISC
