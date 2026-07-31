import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "..", "data", "orders.db");

interface OrderRow {
  id: string;
  customer: string;
  email: string;
  status: string;
  items: string;
  total: number;
  created: string;
  tracking: string | null;
  notes: string | null;
}

function getDb() { return new Database(DB_PATH, { readonly: true }); }

function createMcpServer() {
  const server = new Server(
    { name: "ecommerce-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: "get_order",
        description: "Look up a single order by ID (e.g. ORD-001). Returns the order as structured JSON: id, customer, email, status, items, total, created, tracking, notes. Example call {orderId: 'ORD-004'} returns {id: 'ORD-004', customer: 'Dave Wilson', status: 'pending', items: [...]}. If the order is not found, returns {ok: false, message} with isError set to true.",
        inputSchema: {
          type: "object",
          properties: {
            orderId: { type: "string", description: "Order ID like ORD-001", pattern: "^ORD-\\d{3}$" },
          },
          required: ["orderId"],
        },
      },
      {
        name: "search_orders",
        description: "Search orders by status, customer, email, date range. Returns a JSON array of matching orders, newest first; an empty array [] if nothing matches. Paginate with limit (max 10) and offset. Example call {status: 'delivered', limit: 5} returns [{id: 'ORD-010', customer: 'Jack Taylor', status: 'delivered', ...}]. If the request itself is invalid, returns {ok: false, message} with isError set to true.",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["pending", "processing", "shipped", "delivered", "cancelled"] },
            customer: { type: "string" },
            email: { type: "string" },
            dateFrom: { type: "string" },
            dateTo: { type: "string" },
            limit: { type: "number", minimum: 1, maximum: 10, default: 10 },
            offset: { type: "number", minimum: 0, default: 0 },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, message: "No arguments provided." }) }],
        isError: true,
      };
    }

    try {
      if (name === "get_order") {
        const orderId = typeof args.orderId === "string" ? args.orderId : String(args.orderId);
        const db = getDb();
        const row = db.prepare(`SELECT id, customer, email, status, items, total, created, tracking, notes FROM orders WHERE id = ?`).get(orderId) as OrderRow | undefined;
        db.close();

        if (!row) {
          return {
            content: [{ type: "text", text: JSON.stringify({ ok: false, message: `Order ${orderId} not found.` }) }],
            isError: true,
          };
        }

        const order = {
          id: row.id,
          customer: row.customer,
          email: row.email,
          status: row.status,
          items: JSON.parse(row.items) as Array<{ name: string; qty: number; price: number }>,
          total: row.total,
          created: row.created,
          tracking: row.tracking ?? null,
          notes: row.notes ?? null,
        };
        return { content: [{ type: "text", text: JSON.stringify(order, null, 2) }] };
      }

      if (name === "search_orders") {
        const db = getDb();
        const clauses: string[] = [];
        const params: any[] = [];

        if (typeof args.status === "string") { clauses.push("status = ?"); params.push(args.status); }
        if (typeof args.customer === "string") { clauses.push("customer LIKE ?"); params.push(`%${args.customer}%`); }
        if (typeof args.email === "string") { clauses.push("email LIKE ?"); params.push(`%${args.email}%`); }
        if (typeof args.dateFrom === "string") { clauses.push("created >= ?"); params.push(args.dateFrom); }
        if (typeof args.dateTo === "string") { clauses.push("created <= ?"); params.push(args.dateTo); }

        const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
        const limit = Math.min(Math.max(typeof args.limit === "number" ? args.limit : 10, 1), 10);
        const offset = typeof args.offset === "number" ? Math.max(args.offset, 0) : 0;
        const sql = `SELECT id, customer, email, status, total, created, tracking FROM orders ${where} ORDER BY created DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = db.prepare(sql).all(...params) as Array<{ id: string; customer: string; email: string; status: string; total: number; created: string; tracking: string | null }>;
        db.close();

        const orders = rows.map(r => ({
          id: r.id,
          customer: r.customer,
          email: r.email,
          status: r.status,
          total: r.total,
          created: r.created,
          tracking: r.tracking,
        }));
        return { content: [{ type: "text", text: JSON.stringify(orders, null, 2) }] };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, message: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: JSON.stringify({ ok: false, message: `Error: ${msg}` }) }],
        isError: true,
      };
    }
  });

  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = Number(process.env.PORT ?? 8003);
app.listen(PORT, "127.0.0.1", () => console.error(`MCP server on http://localhost:${PORT}/mcp`));
