import express, { Request, Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "..", "data", "orders.db");

// Type definitions for database rows
interface OrderRow {
  id: string;
  customer: string;
  email: string;
  status: string;
  items: string; // JSON serialized
  total: number;
  created: string;
  tracking: string | null;
  notes: string | null;
}

function getDb() { return new Database(DB_PATH, { readonly: true }); }

const mcpServer = new Server(
  { name: "ecommerce-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

mcpServer.setRequestHandler(ListToolsRequestSchema, () => ({
  tools: [
    {
      name: "get_order",
      description: "Look up a single order by ID (e.g. ORD-001). Returns customer, items, status, tracking, notes.",
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
      description: "Search orders by status, customer, email, date range. Returns list of matching orders.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "processing", "shipped", "delivered", "cancelled"] },
          customer: { type: "string" },
          email: { type: "string" },
          dateFrom: { type: "string" },
          dateTo: { type: "string" },
          limit: { type: "number", default: 20 },
        },
      },
    },
  ],
}));

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return { content: [{ text: "No arguments provided." }] };
  }

  try {
    if (name === "get_order") {
      const orderId = typeof args.orderId === "string" ? args.orderId : String(args.orderId);
      const db = getDb();
      const row = db.prepare(`SELECT id, customer, email, status, items, total, created, tracking, notes FROM orders WHERE id = ?`).get(orderId) as OrderRow | undefined;
      db.close();

      if (!row) return { content: [{ text: "Order not found." }] };

      const items = JSON.parse(row.items) as Array<{ name: string; qty: number; price: number }>;
      const itemLines = items.map(i => `  - ${i.name} x${i.qty} @ $${i.price.toFixed(2)} = $${(i.qty * i.price).toFixed(2)}`).join("\n");

      let message = `Order: ${row.id}\nCustomer: ${row.customer} (${row.email})\nStatus: ${row.status}\nCreated: ${row.created}\nTracking: ${row.tracking ?? "N/A"}\nItems:\n${itemLines}\nTotal: $${row.total.toFixed(2)}`;
      if (row.notes) message += `\nNotes: ${row.notes}`;
      return { content: [{ text: message }] };
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
      const limit = (typeof args.limit === "number" ? args.limit : 20);
      const sql = `SELECT id, customer, email, status, total, created, tracking FROM orders ${where} ORDER BY created DESC LIMIT ?`;
      params.push(limit);

      const rows = db.prepare(sql).all(...params) as Array<{ id: string; customer: string; email: string; status: string; total: number; created: string; tracking: string | null }>;
      db.close();

      if (rows.length === 0) return { content: [{ text: "No orders found." }] };

      let output = `Found ${rows.length} order(s):\nID          | Customer        | Status      | Total       | Date        | Tracking\n`;
      for (const r of rows) {
        output += `${r.id} | ${r.customer} | ${r.status} | $${r.total.toFixed(2)} | ${r.created} | ${r.tracking ?? "N/A"}\n`;
      }
      return { content: [{ text: output }] };
    }

    return { content: [{ text: `Unknown tool: ${name}` }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ text: `Error: ${msg}` }] };
  }
});

const app = express();
app.use(express.json());

app.post("/api/mcp", (req: Request, res: Response) => {
  res.json({ message: "MCP gateway endpoint", tool: req.body?.params?.name, timestamp: new Date().toISOString() });
});

app.get("/", (req: Request, res: Response) => {
  res.send("<h1>Commerce Operations MCP</h1><p>Use POST /api/mcp to call tools.</p>");
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = 8003;
app.listen(PORT, () => console.error(`HTTP proxy on port ${PORT}`));

async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error("ecommerce-mcp server running on stdio");
}

main().catch((err) => { console.error("MCP server failed:", err); process.exit(1); });
