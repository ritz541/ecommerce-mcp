# ecommerce-mcp

MCP server for commerce-operations self-service. Lets an AI agent look up order details and search orders without needing developer or SQL access.

**Live endpoint:** `https://mcp.chavanpatil.com/mcp`

Connect any MCP client (Claude Desktop, Claude Code, a custom agent harness, or the [MCP Inspector](https://github.com/modelcontextprotocol/inspector)) to that URL to use the tools below.

## Quick Start

Requires **Node.js >= 22** (better-sqlite3 v13 requirement).

```bash
# Install deps
npm install

# Seed the database
npm run seed

# Run dev (auto-seeds via predev)
npm run dev   # server on http://localhost:8003
```

## MCP Tools

- **`get_order(orderId)`** — Look up a single order by ID (e.g. `ORD-001`). Returns full details including items, tracking, and notes.
- **`search_orders(filters)`** — Search orders by status, customer, email, date range. Optionally limit results.

## Testing

```bash
npm test
```

Brings up the server on a throwaway port and exercises `initialize`, `tools/list`, and both tools (found / not-found / filtered search cases).

## Development

- TypeScript, `@modelcontextprotocol/sdk`, `better-sqlite3`
- SQLite database at `data/orders.db` (synthetic data only; created on first `npm run seed`)
- Streamable HTTP transport (`POST /mcp`), bound to `127.0.0.1`
- `PORT` env var overrides the default port (`8003`)

## What's In / Out of Scope

- In: `get_order`, `search_orders`, synthetic order data, remote hosting
- Out: Auth, frontend, inventory management, fulfillment tools, real payments, Docker

## License

ISC
