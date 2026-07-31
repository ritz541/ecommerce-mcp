import express from "express";
import { rateLimit } from "express-rate-limit";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import { daysSince, evaluateRefundEligibility, type PaymentStatus, type CarrierStatus } from "./policy.js";
import { seedDatabase } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.resolve(__dirname, "..", "data", "orders.db");

const ORDER_ID_RE = /^ORD-\d{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
  carrier_status: string;
}

interface PaymentRow {
  order_id: string;
  status: string;
  amount: number;
  method: string;
}

interface RefundRow {
  id: string;
  order_id: string;
  amount: number;
  reason: string;
  created: string;
}

interface EscalationRow {
  id: string;
  order_id: string;
  reason: string;
  conditions: string;
  status: string;
  created: string;
}

interface AuditRow {
  id: number;
  ts: string;
  order_id: string;
  action: string;
  actor: string;
  reason: string | null;
  before: string | null;
  after: string | null;
  outcome: string;
}

interface OrderContext {
  order: OrderRow;
  payment: PaymentRow | null;
  riskScore: number | null;
  refund: RefundRow | null;
  escalation: EscalationRow | null;
  orderAgeDays: number;
}

class OrderNotFoundError extends Error {
  constructor(orderId: string) {
    super(`Order ${orderId} not found.`);
    this.name = "OrderNotFoundError";
  }
}

function getDb() { return new Database(DB_PATH, { readonly: true }); }
function getWriteDb() { return new Database(DB_PATH); }

function invalidOrderId(orderId: string): string | null {
  return ORDER_ID_RE.test(orderId) ? null : `Invalid orderId '${orderId}'. Expected format like ORD-001.`;
}

function parseJson(s: string | null): unknown {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}

function parseStringArray(s: string | null): string[] | null {
  const parsed = parseJson(s);
  return Array.isArray(parsed) && parsed.every((x) => typeof x === "string") ? parsed as string[] : null;
}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Error && (err as { code?: string }).code === "SQLITE_CONSTRAINT_UNIQUE";
}

function ok(data: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

function error(message: string) {
  return { content: [{ type: "text", text: JSON.stringify({ ok: false, message }) }], isError: true };
}

function loadOrderContext(db: Database.Database, orderId: string): OrderContext {
  const order = db.prepare(`SELECT id, customer, email, status, items, total, created, tracking, notes, carrier_status FROM orders WHERE id = ?`).get(orderId) as OrderRow | undefined;
  if (!order) throw new OrderNotFoundError(orderId);

  const payment = (db.prepare(`SELECT order_id, status, amount, method FROM payments WHERE order_id = ?`).get(orderId) as PaymentRow | undefined) ?? null;
  const customer = db.prepare(`SELECT email, risk_score FROM customers WHERE email = ?`).get(order.email) as { email: string; risk_score: number } | undefined;
  const refund = (db.prepare(`SELECT id, order_id, amount, reason, created FROM refunds WHERE order_id = ?`).get(orderId) as RefundRow | undefined) ?? null;
  const escalation = (db.prepare(`SELECT id, order_id, reason, conditions, status, created FROM escalations WHERE order_id = ?`).get(orderId) as EscalationRow | undefined) ?? null;

  return {
    order,
    payment,
    riskScore: customer?.risk_score ?? null,
    refund,
    escalation,
    orderAgeDays: daysSince(order.created),
  };
}

function computeEligibility(ctx: OrderContext) {
  return evaluateRefundEligibility({
    orderAmount: ctx.order.total,
    paidAmount: ctx.payment?.amount ?? null,
    paymentStatus: (ctx.payment?.status ?? "unknown") as PaymentStatus,
    orderAgeDays: ctx.orderAgeDays,
    riskScore: ctx.riskScore ?? 999,
    carrierStatus: ctx.order.carrier_status as CarrierStatus,
    hasExistingRefund: ctx.refund !== null,
  });
}

function createMcpServer() {
  const server = new Server(
    { name: "ecommerce-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: "get_order",
        description: "Look up a single order by ID (e.g. ORD-001) and return its full details: items, payment, customer risk score, carrier status, order age, refund status, and refund eligibility.",
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
        description: "Search orders by status, customer, email, or date range. Returns up to 10 matches, newest first; paginate with limit and offset.",
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
      {
        name: "refund_order",
        description: "Attempt an automatic refund for an order. Refund is issued automatically only when the amount is at most $150 and not above the paid amount, the order is at most 30 days old, the customer risk score is below 70, a carrier exception is verified, and no refund exists for the order. Otherwise a manager-approval escalation is created. A non-empty reason is required. Idempotent: retrying returns the existing outcome and never issues a duplicate refund.",
        inputSchema: {
          type: "object",
          properties: {
            orderId: { type: "string", description: "Order ID like ORD-001", pattern: "^ORD-\\d{3}$" },
            reason: { type: "string", description: "Why the refund is being requested", minLength: 1 },
          },
          required: ["orderId", "reason"],
        },
      },
      {
        name: "get_audit_log",
        description: "Return the durable audit history for an order: every refund, escalation, and state change, with timestamp, actor, and reason.",
        inputSchema: {
          type: "object",
          properties: {
            orderId: { type: "string", description: "Order ID like ORD-001", pattern: "^ORD-\\d{3}$" },
          },
          required: ["orderId"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      return error("No arguments provided.");
    }

    try {
      if (name === "get_order") {
        const orderId = typeof args.orderId === "string" ? args.orderId : String(args.orderId);
        const badId = invalidOrderId(orderId);
        if (badId) return error(badId);

        const db = getDb();
        try {
          let ctx: OrderContext;
          try {
            ctx = loadOrderContext(db, orderId);
          } catch (e) {
            if (e instanceof OrderNotFoundError) return error(e.message);
            throw e;
          }

          let items: Array<{ name: string; qty: number; price: number }>;
          try {
            items = JSON.parse(ctx.order.items) as Array<{ name: string; qty: number; price: number }>;
          } catch {
            return error(`Order ${orderId} has corrupt item data.`);
          }

          const eligibility = computeEligibility(ctx);
          return ok({
            id: ctx.order.id,
            customer: ctx.order.customer,
            email: ctx.order.email,
            status: ctx.order.status,
            items,
            total: ctx.order.total,
            created: ctx.order.created,
            tracking: ctx.order.tracking ?? null,
            notes: ctx.order.notes ?? null,
            payment: ctx.payment ? { status: ctx.payment.status, amount: ctx.payment.amount, method: ctx.payment.method } : null,
            riskScore: ctx.riskScore,
            carrierStatus: ctx.order.carrier_status,
            orderAgeDays: ctx.orderAgeDays,
            refund: ctx.refund ? { id: ctx.refund.id, amount: ctx.refund.amount, reason: ctx.refund.reason, created: ctx.refund.created } : null,
            refundEligibility: { canAutoRefund: eligibility.canAutoRefund, reasons: eligibility.reasons },
          });
        } finally {
          db.close();
        }
      }

      if (name === "search_orders") {
        const db = getDb();
        const clauses: string[] = [];
        const params: Array<string | number> = [];

        if (typeof args.dateFrom === "string" && !DATE_RE.test(args.dateFrom)) {
          db.close();
          return error(`Invalid dateFrom '${args.dateFrom}'. Expected YYYY-MM-DD.`);
        }
        if (typeof args.dateTo === "string" && !DATE_RE.test(args.dateTo)) {
          db.close();
          return error(`Invalid dateTo '${args.dateTo}'. Expected YYYY-MM-DD.`);
        }

        if (typeof args.status === "string") { clauses.push("status = ?"); params.push(args.status); }
        if (typeof args.customer === "string") { clauses.push("customer LIKE ?"); params.push(`%${args.customer}%`); }
        if (typeof args.email === "string") { clauses.push("email LIKE ?"); params.push(`%${args.email}%`); }
        if (typeof args.dateFrom === "string") { clauses.push("created >= ?"); params.push(args.dateFrom); }
        if (typeof args.dateTo === "string") { clauses.push("created <= ?"); params.push(args.dateTo); }

        const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
        const limit = Math.min(Math.max(typeof args.limit === "number" ? args.limit : 10, 1), 10);
        const offset = typeof args.offset === "number" ? Math.max(args.offset, 0) : 0;
        const sql = `SELECT id, customer, email, status, total, created, tracking FROM orders ${where} ORDER BY created DESC, id DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const rows = db.prepare(sql).all(...params) as Array<{ id: string; customer: string; email: string; status: string; total: number; created: string; tracking: string | null }>;
        db.close();

        return ok(rows.map(r => ({
          id: r.id,
          customer: r.customer,
          email: r.email,
          status: r.status,
          total: r.total,
          created: r.created,
          tracking: r.tracking,
        })));
      }

      if (name === "refund_order") {
        const orderId = typeof args.orderId === "string" ? args.orderId : String(args.orderId);
        const reason = typeof args.reason === "string" ? args.reason.trim() : "";
        const badId = invalidOrderId(orderId);
        if (badId) return error(badId);
        if (reason.length === 0) return error("A non-empty reason is required to refund an order.");

        const db = getWriteDb();
        try {
          try {
            loadOrderContext(db, orderId);
          } catch (e) {
            if (e instanceof OrderNotFoundError) return error(e.message);
            throw e;
          }

          const ts = new Date().toISOString();

          const run = db.transaction((): ReturnType<typeof ok> => {
            const current = loadOrderContext(db, orderId);

            if (current.refund) {
              return ok({
                ok: true,
                mode: "already_refunded",
                orderId,
                refund: { id: current.refund.id, amount: current.refund.amount, reason: current.refund.reason, created: current.refund.created },
                message: "Order already refunded; no duplicate refund issued.",
              });
            }

            if (current.escalation) {
              return ok({
                ok: true,
                mode: "escalated",
                orderId,
                escalationId: current.escalation.id,
                status: current.escalation.status,
                reasons: parseStringArray(current.escalation.conditions) ?? [],
                message: "Refund already flagged for manager approval; no new escalation created.",
              });
            }

            const eligibility = computeEligibility(current);
            const before = JSON.stringify(current.payment
              ? { status: current.payment.status, amount: current.payment.amount, method: current.payment.method }
              : null);

            if (eligibility.canAutoRefund) {
              const refundId = `REF-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
              const after = JSON.stringify({ paymentStatus: "refunded", refundId, amount: current.order.total });
              db.prepare("INSERT INTO refunds (id, order_id, amount, reason, actor, created) VALUES (?, ?, ?, ?, ?, ?)").run(refundId, orderId, current.order.total, reason, "ops_agent", ts);
              db.prepare("UPDATE payments SET status = 'refunded' WHERE order_id = ?").run(orderId);
              db.prepare("INSERT INTO audit_log (ts, order_id, action, actor, reason, before, after, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(ts, orderId, "refund.automatic", "ops_agent", reason, before, after, "refunded");
              return ok({
                ok: true,
                mode: "automatic",
                orderId,
                refundId,
                amount: current.order.total,
                refundedAt: ts,
                message: "Refund issued automatically.",
              });
            }

            const escalationId = `ESC-${randomUUID().replace(/-/g, "").slice(0, 8)}`;
            const conditions = JSON.stringify(eligibility.reasons);
            const after = JSON.stringify({ escalationId, conditions: eligibility.reasons });
            db.prepare("INSERT INTO escalations (id, order_id, reason, conditions, status, created) VALUES (?, ?, ?, ?, 'pending_approval', ?)").run(escalationId, orderId, reason, conditions, ts);
            db.prepare("INSERT INTO audit_log (ts, order_id, action, actor, reason, before, after, outcome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(ts, orderId, "refund.escalated", "ops_agent", reason, before, after, "escalated");
            return ok({
              ok: true,
              mode: "escalated",
              orderId,
              escalationId,
              status: "pending_approval",
              reasons: eligibility.reasons,
              message: "Refund requires manager approval.",
            });
          });

          try {
            return run();
          } catch (e) {
            if (isUniqueConstraintError(e)) {
              const latest = loadOrderContext(db, orderId);
              if (latest.refund) {
                return ok({
                  ok: true,
                  mode: "already_refunded",
                  orderId,
                  refund: { id: latest.refund.id, amount: latest.refund.amount, reason: latest.refund.reason, created: latest.refund.created },
                  message: "Order already refunded; no duplicate refund issued.",
                });
              }
              if (latest.escalation) {
                return ok({
                  ok: true,
                  mode: "escalated",
                  orderId,
                  escalationId: latest.escalation.id,
                  status: latest.escalation.status,
                  reasons: parseStringArray(latest.escalation.conditions) ?? [],
                  message: "Refund already flagged for manager approval; no new escalation created.",
                });
              }
            }
            throw e;
          }
        } finally {
          db.close();
        }
      }

      if (name === "get_audit_log") {
        const orderId = typeof args.orderId === "string" ? args.orderId : String(args.orderId);
        const badId = invalidOrderId(orderId);
        if (badId) return error(badId);

        const db = getDb();
        try {
          const exists = db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
          if (!exists) return error(`Order ${orderId} not found.`);
          const rows = db.prepare(`SELECT id, ts, order_id, action, actor, reason, before, after, outcome FROM audit_log WHERE order_id = ? ORDER BY id ASC`).all(orderId) as AuditRow[];
          return ok(rows.map(r => ({
            id: r.id,
            ts: r.ts,
            orderId: r.order_id,
            action: r.action,
            actor: r.actor,
            reason: r.reason,
            before: parseJson(r.before),
            after: parseJson(r.after),
            outcome: r.outcome,
          })));
        } finally {
          db.close();
        }
      }

      return error(`Unknown tool: ${name}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return error(`Error: ${msg}`);
    }
  });

  return server;
}

const app = express();
app.use(express.json());

const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX) || 300);
const RATE_LIMIT_WINDOW_MS = Math.max(1, Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000);

const mcpLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { jsonrpc: "2.0", error: { code: 429, message: "Rate limit exceeded. Try again later." } },
});

app.post("/mcp", mcpLimiter, async (req, res) => {
  try {
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[mcp] request failed: ${detail}`);
    res.status(500).json({ jsonrpc: "2.0", error: { code: -32000, message: `Internal error: ${detail}` } });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = Number(process.env.PORT ?? 8003);

try {
  const counts = seedDatabase(DB_PATH);
  console.error(`[init] DB reseeded: ${counts.customers} customers, ${counts.orders} orders, ${counts.payments} payments, ${counts.refunds} refunds, ${counts.escalations} escalations, ${counts.audit_log} audit -> ${DB_PATH}`);
} catch (err) {
  const detail = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`[init] DB reseed failed: ${detail}`);
  process.exit(1);
}

app.listen(PORT, "127.0.0.1", () => console.error(`MCP server on http://localhost:${PORT}/mcp`));
