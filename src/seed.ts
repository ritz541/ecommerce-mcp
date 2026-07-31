import fs from "fs";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "..", "data", "orders.db");

const customers = [
  { email: "alice@example.com", riskScore: 10 },
  { email: "bob@example.com", riskScore: 25 },
  { email: "carol@example.com", riskScore: 15 },
  { email: "dave@example.com", riskScore: 35 },
  { email: "eve@example.com", riskScore: 20 },
  { email: "frank@example.com", riskScore: 30 },
  { email: "grace@example.com", riskScore: 12 },
  { email: "henry@example.com", riskScore: 18 },
  { email: "iris@example.com", riskScore: 22 },
  { email: "jack@example.com", riskScore: 8 },
  { email: "karen@example.com", riskScore: 16 },
  { email: "leo@example.com", riskScore: 28 },
  { email: "mia@example.com", riskScore: 85 },
  { email: "noah@example.com", riskScore: 14 },
  { email: "olivia@example.com", riskScore: 10 },
  { email: "priya@example.com", riskScore: 20 },
  { email: "sam@example.com", riskScore: 15 },
];

const orders = [
  { id: "ORD-001", customer: "Alice Johnson", email: "alice@example.com", status: "delivered", items: [{ name: "Wireless Headphones", qty: 1, price: 79.99 }, { name: "USB-C Cable", qty: 2, price: 12.99 }], total: 105.97, created: "2026-07-01", tracking: "1Z999AA10123456784", notes: null, carrierStatus: "delivered" },
  { id: "ORD-002", customer: "Bob Smith", email: "bob@example.com", status: "shipped", items: [{ name: "Mechanical Keyboard", qty: 1, price: 149.99 }], total: 149.99, created: "2026-07-03", tracking: "1Z999AA10123456785", notes: "Leave at door", carrierStatus: "in_transit" },
  { id: "ORD-003", customer: "Carol Davis", email: "carol@example.com", status: "processing", items: [{ name: "Monitor 27\" 4K", qty: 2, price: 449.99 }, { name: "Monitor Arm", qty: 2, price: 89.99 }], total: 1079.96, created: "2026-07-05", tracking: null, notes: null, carrierStatus: "pending" },
  { id: "ORD-004", customer: "Dave Wilson", email: "dave@example.com", status: "pending", items: [{ name: "Laptop Stand", qty: 1, price: 44.99 }], total: 44.99, created: "2026-07-10", tracking: null, notes: "Awaiting payment", carrierStatus: "pending" },
  { id: "ORD-005", customer: "Eve Martinez", email: "eve@example.com", status: "delivered", items: [{ name: "Webcam 1080p", qty: 1, price: 59.99 }, { name: "Ring Light", qty: 1, price: 34.99 }], total: 94.98, created: "2026-07-12", tracking: "1Z999AA10123456786", notes: null, carrierStatus: "delivered" },
  { id: "ORD-006", customer: "Frank Lee", email: "frank@example.com", status: "cancelled", items: [{ name: "Desk Chair", qty: 1, price: 299.99 }], total: 299.99, created: "2026-07-14", tracking: null, notes: "Customer cancelled", carrierStatus: "not_shipped" },
  { id: "ORD-007", customer: "Grace Kim", email: "grace@example.com", status: "shipped", items: [{ name: "USB Hub 7-port", qty: 3, price: 24.99 }], total: 74.97, created: "2026-07-15", tracking: "1Z999AA10123456787", notes: null, carrierStatus: "in_transit" },
  { id: "ORD-008", customer: "Henry Brown", email: "henry@example.com", status: "processing", items: [{ name: "External SSD 1TB", qty: 1, price: 89.99 }, { name: "SATA Cable", qty: 2, price: 7.99 }], total: 105.97, created: "2026-07-16", tracking: null, notes: null, carrierStatus: "pending" },
  { id: "ORD-009", customer: "Iris Chen", email: "iris@example.com", status: "pending", items: [{ name: "Mouse Wireless", qty: 1, price: 29.99 }, { name: "Mouse Pad XL", qty: 1, price: 19.99 }], total: 49.98, created: "2026-07-18", tracking: null, notes: "Gift wrap requested", carrierStatus: "pending" },
  { id: "ORD-010", customer: "Jack Taylor", email: "jack@example.com", status: "delivered", items: [{ name: "Phone Case", qty: 2, price: 15.99 }, { name: "Screen Protector", qty: 2, price: 9.99 }], total: 51.96, created: "2026-07-20", tracking: "1Z999AA10123456788", notes: null, carrierStatus: "delivered" },
  { id: "ORD-011", customer: "Karen White", email: "karen@example.com", status: "shipped", items: [{ name: "Bluetooth Speaker", qty: 1, price: 69.99 }], total: 69.99, created: "2026-07-22", tracking: "1Z999AA10123456789", notes: "Fragile - handle carefully", carrierStatus: "in_transit" },
  { id: "ORD-012", customer: "Leo Garcia", email: "leo@example.com", status: "processing", items: [{ name: "Standing Desk", qty: 1, price: 399.99 }, { name: "Desk Mat", qty: 1, price: 39.99 }], total: 439.98, created: "2026-07-23", tracking: null, notes: null, carrierStatus: "pending" },
  { id: "ORD-013", customer: "Mia Robinson", email: "mia@example.com", status: "pending", items: [{ name: "Notebook Pro 15\"", qty: 1, price: 1299.99 }], total: 1299.99, created: "2026-07-25", tracking: null, notes: "Express shipping requested", carrierStatus: "pending" },
  { id: "ORD-014", customer: "Noah Adams", email: "noah@example.com", status: "cancelled", items: [{ name: "Tablet 10\"", qty: 1, price: 329.99 }], total: 329.99, created: "2026-07-26", tracking: null, notes: "Out of stock - refunded", carrierStatus: "not_shipped" },
  { id: "ORD-015", customer: "Olivia Nelson", email: "olivia@example.com", status: "delivered", items: [{ name: "Cable Management Kit", qty: 1, price: 24.99 }], total: 24.99, created: "2026-07-27", tracking: "1Z999AA10123456790", notes: null, carrierStatus: "delivered" },
  { id: "ORD-016", customer: "Priya Sharma", email: "priya@example.com", status: "processing", items: [{ name: "Bluetooth Earbuds", qty: 1, price: 49.99 }], total: 49.99, created: "2026-07-29", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-017", customer: "Sam Patel", email: "sam@example.com", status: "processing", items: [{ name: "Desk Lamp", qty: 1, price: 79.99 }], total: 79.99, created: "2026-06-10", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-018", customer: "Mia Robinson", email: "mia@example.com", status: "processing", items: [{ name: "Mousepad", qty: 1, price: 39.99 }], total: 39.99, created: "2026-07-28", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
];

const payments = [
  { orderId: "ORD-001", status: "paid", amount: 105.97, method: "card" },
  { orderId: "ORD-002", status: "paid", amount: 149.99, method: "card" },
  { orderId: "ORD-003", status: "paid", amount: 1079.96, method: "upi" },
  { orderId: "ORD-004", status: "pending", amount: 44.99, method: "card" },
  { orderId: "ORD-005", status: "paid", amount: 94.98, method: "card" },
  { orderId: "ORD-006", status: "paid", amount: 299.99, method: "card" },
  { orderId: "ORD-007", status: "paid", amount: 74.97, method: "upi" },
  { orderId: "ORD-008", status: "paid", amount: 105.97, method: "card" },
  { orderId: "ORD-009", status: "pending", amount: 49.98, method: "paypal" },
  { orderId: "ORD-010", status: "paid", amount: 51.96, method: "card" },
  { orderId: "ORD-011", status: "paid", amount: 69.99, method: "card" },
  { orderId: "ORD-012", status: "paid", amount: 439.98, method: "card" },
  { orderId: "ORD-013", status: "pending", amount: 1299.99, method: "card" },
  { orderId: "ORD-014", status: "refunded", amount: 329.99, method: "card" },
  { orderId: "ORD-015", status: "paid", amount: 24.99, method: "card" },
  { orderId: "ORD-016", status: "paid", amount: 49.99, method: "card" },
  { orderId: "ORD-017", status: "paid", amount: 79.99, method: "card" },
  { orderId: "ORD-018", status: "paid", amount: 39.99, method: "card" },
];

const refunds = [
  { id: "REF-001", orderId: "ORD-014", amount: 329.99, reason: "Out of stock - refunded", actor: "system", created: "2026-07-26" },
];

const escalations: Array<{ id: string; orderId: string; reason: string; conditions: string; created: string }> = [];

const auditEntries = [
  { ts: "2026-07-26T09:00:00.000Z", orderId: "ORD-014", action: "refund.automatic", actor: "system", reason: "Out of stock - refunded", before: '{"paymentStatus":"paid"}', after: '{"paymentStatus":"refunded"}', outcome: "refunded" },
  { ts: "2026-07-29T10:00:00.000Z", orderId: "ORD-016", action: "order.created", actor: "system", reason: null, before: null, after: '{"status":"processing"}', outcome: "created" },
  { ts: "2026-07-28T10:00:00.000Z", orderId: "ORD-018", action: "order.created", actor: "system", reason: null, before: null, after: '{"status":"processing"}', outcome: "created" },
];

function main() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);

  try {
    db.exec(`DROP TABLE IF EXISTS audit_log;
      DROP TABLE IF EXISTS escalations;
      DROP TABLE IF EXISTS refunds;
      DROP TABLE IF EXISTS payments;
      DROP TABLE IF EXISTS orders;
      DROP TABLE IF EXISTS customers;

      CREATE TABLE customers (
        email TEXT PRIMARY KEY,
        risk_score INTEGER NOT NULL
      );

      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        customer TEXT NOT NULL,
        email TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
        items TEXT NOT NULL,
        total REAL NOT NULL,
        created TEXT NOT NULL,
        tracking TEXT,
        notes TEXT,
        carrier_status TEXT NOT NULL DEFAULT 'pending'
      );

      CREATE TABLE payments (
        order_id TEXT PRIMARY KEY REFERENCES orders(id),
        status TEXT NOT NULL CHECK(status IN ('paid', 'refunded', 'pending')),
        amount REAL NOT NULL,
        method TEXT NOT NULL
      );

      CREATE TABLE refunds (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
        amount REAL NOT NULL,
        reason TEXT NOT NULL,
        actor TEXT NOT NULL,
        created TEXT NOT NULL
      );

      CREATE TABLE escalations (
        id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
        reason TEXT NOT NULL,
        conditions TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending_approval',
        created TEXT NOT NULL
      );

      CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts TEXT NOT NULL,
        order_id TEXT NOT NULL,
        action TEXT NOT NULL,
        actor TEXT NOT NULL,
        reason TEXT,
        before TEXT,
        after TEXT,
        outcome TEXT NOT NULL
      );`);

    const insertCustomer = db.prepare("INSERT INTO customers (email, risk_score) VALUES (@email, @riskScore)");
    const insertOrder = db.prepare(
      `INSERT INTO orders (id, customer, email, status, items, total, created, tracking, notes, carrier_status)
       VALUES (@id, @customer, @email, @status, @items, @total, @created, @tracking, @notes, @carrierStatus)`
    );
    const insertPayment = db.prepare("INSERT INTO payments (order_id, status, amount, method) VALUES (@orderId, @status, @amount, @method)");
    const insertRefund = db.prepare("INSERT INTO refunds (id, order_id, amount, reason, actor, created) VALUES (@id, @orderId, @amount, @reason, @actor, @created)");
    const insertEscalation = db.prepare("INSERT INTO escalations (id, order_id, reason, conditions, status, created) VALUES (@id, @orderId, @reason, @conditions, 'pending_approval', @created)");
    const insertAudit = db.prepare("INSERT INTO audit_log (ts, order_id, action, actor, reason, before, after, outcome) VALUES (@ts, @orderId, @action, @actor, @reason, @before, @after, @outcome)");

    const seedAll = db.transaction(() => {
      for (const c of customers) insertCustomer.run(c);
      for (const o of orders) insertOrder.run({ ...o, items: JSON.stringify(o.items) });
      for (const p of payments) insertPayment.run(p);
      for (const r of refunds) insertRefund.run(r);
      for (const e of escalations) insertEscalation.run(e);
      for (const a of auditEntries) insertAudit.run(a);
    });

    seedAll();

    const counts = db.prepare(`
      SELECT (SELECT COUNT(*) FROM customers) AS customers,
             (SELECT COUNT(*) FROM orders) AS orders,
             (SELECT COUNT(*) FROM payments) AS payments,
             (SELECT COUNT(*) FROM refunds) AS refunds,
             (SELECT COUNT(*) FROM escalations) AS escalations,
             (SELECT COUNT(*) FROM audit_log) AS audit_log`).get() as Record<string, number>;

    console.log(`Seeded: ${counts.customers} customers, ${counts.orders} orders, ${counts.payments} payments, ${counts.refunds} refunds, ${counts.escalations} escalations, ${counts.audit_log} audit entries -> ${DB_PATH}`);
  } finally {
    db.close();
  }
}

try {
  main();
} catch (err) {
  const detail = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`Seed failed: ${detail}`);
  process.exit(1);
}
