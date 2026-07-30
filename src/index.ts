import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "..", "data", "orders.db");

function getDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true });
}

const server = new Server(
  {
    name: "ecommerce-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: [
      {
        name: "get_order",
        description:
          "Look up a single order by its order ID (e.g. ORD-001). Returns full order details: customer, items, status, tracking number, and any internal notes.",
        inputSchema: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              description: "The order ID to look up (e.g. ORD-001)",
              pattern: "^ORD-\\d{3}$",
            },
          },
          required: ["orderId"],
        },
      },
      {
        name: "search_orders",
        description:
          "Search orders by filters. Returns a list of matching orders with id, customer, status, total, and created date. Use this to find orders by status, date range, or customer name/email.",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              description: "Filter by order status",
              enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
            },
            customer: {
              type: "string",
              description: "Filter by customer name (partial match, case-insensitive)",
            },
            email: {
              type: "string",
              description: "Filter by customer email (partial match)",
            },
            dateFrom: {
              type: "string",
              description: "Filter orders created on or after this date (YYYY-MM-DD)",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            },
            dateTo: {
              type: "string",
              description: "Filter orders created on or before this date (YYYY-MM-DD)",
              pattern: "^\\d{4}-\\d{2}-\\d{2}$",
            },
            limit: {
              type: "number",
              description: "Maximum number of results to return (default 20, max 100)",
              minimum: 1,
              maximum: 100,
              default: 20,
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "get_order") {
      const { orderId } = args as { orderId: string };
      const db = getDb();
      const row = db.prepare(
        `SELECT id, customer, email, status, items, total, created, tracking, notes FROM orders WHERE id = ?`
      ).get(orderId) as
        | {
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
        | undefined;
      db.close();

      if (!row) {
        return {
          content: [
            {
              type: "text",
              text: `Order ${orderId} not found. Check the order ID and try again. Valid IDs follow the format ORD-XXX (e.g. ORD-001).`,
            },
          ],
        };
      }

      const items = JSON.parse(row.items) as Array<{
        name: string;
        qty: number;
        price: number;
      }>;
      const itemLines = items
        .map((i) => `  - ${i.name} ×${i.qty} @ $${i.price.toFixed(2)} = $${(i.qty * i.price).toFixed(2)}`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: [
              `Order: ${row.id}`,
              `Customer: ${row.customer} (${row.email})`,
              `Status: ${row.status}`,
              `Created: ${row.created}`,
              `Tracking: ${row.tracking ?? "N/A"}`,
              `Items:\n${itemLines}`,
              `Total: $${row.total.toFixed(2)}`,
              ...(row.notes ? [`Notes: ${row.notes}`] : []),
            ].join("\n"),
          },
        ],
      };
    }

    if (name === "search_orders") {
      const {
        status,
        customer,
        email,
        dateFrom,
        dateTo,
        limit = 20,
      } = args as {
        status?: string;
        customer?: string;
        email?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
      };

      const db = getDb();
      const clauses: string[] = [];
      const params: (string | number)[] = [];

      if (status) {
        clauses.push("status = ?");
        params.push(status);
      }
      if (customer) {
        clauses.push("customer LIKE ?");
        params.push(`%${customer}%`);
      }
      if (email) {
        clauses.push("email LIKE ?");
        params.push(`%${email}%`);
      }
      if (dateFrom) {
        clauses.push("created >= ?");
        params.push(dateFrom);
      }
      if (dateTo) {
        clauses.push("created <= ?");
        params.push(dateTo);
      }

      const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
      const sql = `SELECT id, customer, email, status, total, created, tracking FROM orders ${where} ORDER BY created DESC LIMIT ?`;
      params.push(limit);

      const rows = db.prepare(sql).all(...params) as Array<{
        id: string;
        customer: string;
        email: string;
        status: string;
        total: number;
        created: string;
        tracking: string | null;
      }>;
      db.close();

      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No orders found matching the given filters.",
            },
          ],
        };
      }

      const lines = rows.map(
        (r) =>
          `${r.id} | ${r.customer} | ${r.status} | $${r.total.toFixed(2)} | ${r.created} | tracking: ${r.tracking ?? "N/A"}`
      );

      return {
        content: [
          {
            type: "text",
            text: [
              `Found ${rows.length} order(s):`,
              "",
              "ID          | Customer        | Status      | Total     | Date       | Tracking",
              "------------|-----------------|-------------|-----------|------------|-----------",
              ...lines,
            ].join("\n"),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${name}`,
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ecommerce-mcp server running on stdio");
}

main().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
