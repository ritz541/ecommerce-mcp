import fs from "fs";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.resolve(__dirname, "..", "data", "orders.db");

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
  { email: "tara@example.com", riskScore: 12 },
  { email: "umar@example.com", riskScore: 18 },
  { email: "vani@example.com", riskScore: 22 },
  { email: "wade@example.com", riskScore: 15 },
  { email: "xena@example.com", riskScore: 88 },
  { email: "yash@example.com", riskScore: 20 },
  { email: "zara@example.com", riskScore: 10 },
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
  { id: "ORD-101", customer: "Tara Gupta", email: "tara@example.com", status: "processing", items: [{ name: "Bluetooth Earbuds Pro", qty: 1, price: 45.99 }], total: 45.99, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-102", customer: "Tara Gupta", email: "tara@example.com", status: "processing", items: [{ name: "Smart Band", qty: 1, price: 79.99 }], total: 79.99, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-103", customer: "Tara Gupta", email: "tara@example.com", status: "processing", items: [{ name: "Mini Speaker", qty: 1, price: 59.99 }], total: 59.99, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-201", customer: "Umar Khan", email: "umar@example.com", status: "processing", items: [{ name: "Smartwatch", qty: 1, price: 199.99 }], total: 199.99, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-202", customer: "Umar Khan", email: "umar@example.com", status: "processing", items: [{ name: "Drone", qty: 1, price: 249.99 }], total: 249.99, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-203", customer: "Umar Khan", email: "umar@example.com", status: "processing", items: [{ name: "Coffee Machine", qty: 1, price: 189.99 }], total: 189.99, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-301", customer: "Vani Rao", email: "vani@example.com", status: "processing", items: [{ name: "Espresso Kit", qty: 1, price: 120.00 }], total: 120.00, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-302", customer: "Vani Rao", email: "vani@example.com", status: "processing", items: [{ name: "Yoga Set", qty: 1, price: 130.00 }], total: 130.00, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-303", customer: "Vani Rao", email: "vani@example.com", status: "processing", items: [{ name: "Office Lamp", qty: 1, price: 140.00 }], total: 140.00, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-401", customer: "Wade Cole", email: "wade@example.com", status: "processing", items: [{ name: "Camping Stove", qty: 1, price: 35.99 }], total: 35.99, created: "2026-05-15", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-402", customer: "Wade Cole", email: "wade@example.com", status: "processing", items: [{ name: "Lantern", qty: 1, price: 49.99 }], total: 49.99, created: "2026-05-20", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-403", customer: "Wade Cole", email: "wade@example.com", status: "processing", items: [{ name: "Cooler Bag", qty: 1, price: 24.99 }], total: 24.99, created: "2026-06-05", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-501", customer: "Xena Diaz", email: "xena@example.com", status: "processing", items: [{ name: "Gift Box", qty: 1, price: 59.99 }], total: 59.99, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-502", customer: "Xena Diaz", email: "xena@example.com", status: "processing", items: [{ name: "Photo Frame", qty: 1, price: 69.99 }], total: 69.99, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-503", customer: "Xena Diaz", email: "xena@example.com", status: "processing", items: [{ name: "Wall Clock", qty: 1, price: 44.99 }], total: 44.99, created: "2026-07-30", tracking: null, notes: "Carrier reported damage in transit", carrierStatus: "exception" },
  { id: "ORD-601", customer: "Yash Patel", email: "yash@example.com", status: "delivered", items: [{ name: "Backpack", qty: 1, price: 55.99 }], total: 55.99, created: "2026-07-30", tracking: "1Z999AA10123456791", notes: "Customer reports damage at delivery", carrierStatus: "delivered" },
  { id: "ORD-602", customer: "Yash Patel", email: "yash@example.com", status: "delivered", items: [{ name: "Umbrella", qty: 1, price: 22.99 }], total: 22.99, created: "2026-07-30", tracking: "1Z999AA10123456792", notes: "Customer reports damage at delivery", carrierStatus: "delivered" },
  { id: "ORD-603", customer: "Yash Patel", email: "yash@example.com", status: "delivered", items: [{ name: "Duffel Bag", qty: 1, price: 65.99 }], total: 65.99, created: "2026-07-30", tracking: "1Z999AA10123456793", notes: "Customer reports damage at delivery", carrierStatus: "delivered" },
  { id: "ORD-701", customer: "Zara Ali", email: "zara@example.com", status: "processing", items: [{ name: "Insulated Bottle", qty: 1, price: 19.99 }], total: 19.99, created: "2026-07-30", tracking: null, notes: "Defect reported - refunded", carrierStatus: "exception" },
  { id: "ORD-702", customer: "Zara Ali", email: "zara@example.com", status: "processing", items: [{ name: "Lunch Box", qty: 1, price: 25.99 }], total: 25.99, created: "2026-07-30", tracking: null, notes: "Defect reported - refunded", carrierStatus: "exception" },
  { id: "ORD-703", customer: "Zara Ali", email: "zara@example.com", status: "processing", items: [{ name: "Cutting Board", qty: 1, price: 14.99 }], total: 14.99, created: "2026-07-30", tracking: null, notes: "Defect reported - refunded", carrierStatus: "exception" },
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
  { orderId: "ORD-101", status: "paid", amount: 45.99, method: "card" },
  { orderId: "ORD-102", status: "paid", amount: 79.99, method: "card" },
  { orderId: "ORD-103", status: "paid", amount: 59.99, method: "card" },
  { orderId: "ORD-201", status: "paid", amount: 199.99, method: "card" },
  { orderId: "ORD-202", status: "paid", amount: 249.99, method: "card" },
  { orderId: "ORD-203", status: "paid", amount: 189.99, method: "card" },
  { orderId: "ORD-301", status: "paid", amount: 100.00, method: "card" },
  { orderId: "ORD-302", status: "paid", amount: 110.00, method: "card" },
  { orderId: "ORD-303", status: "paid", amount: 125.00, method: "card" },
  { orderId: "ORD-401", status: "paid", amount: 35.99, method: "card" },
  { orderId: "ORD-402", status: "paid", amount: 49.99, method: "card" },
  { orderId: "ORD-403", status: "paid", amount: 24.99, method: "card" },
  { orderId: "ORD-501", status: "paid", amount: 59.99, method: "card" },
  { orderId: "ORD-502", status: "paid", amount: 69.99, method: "card" },
  { orderId: "ORD-503", status: "paid", amount: 44.99, method: "card" },
  { orderId: "ORD-601", status: "paid", amount: 55.99, method: "card" },
  { orderId: "ORD-602", status: "paid", amount: 22.99, method: "card" },
  { orderId: "ORD-603", status: "paid", amount: 65.99, method: "card" },
  { orderId: "ORD-701", status: "refunded", amount: 19.99, method: "card" },
  { orderId: "ORD-702", status: "refunded", amount: 25.99, method: "card" },
  { orderId: "ORD-703", status: "refunded", amount: 14.99, method: "card" },
];

const refunds = [
  { id: "REF-001", orderId: "ORD-014", amount: 329.99, reason: "Out of stock - refunded", actor: "system", created: "2026-07-26" },
  { id: "REF-101", orderId: "ORD-701", amount: 19.99, reason: "Defect reported - refunded", actor: "system", created: "2026-07-30" },
  { id: "REF-102", orderId: "ORD-702", amount: 25.99, reason: "Defect reported - refunded", actor: "system", created: "2026-07-30" },
  { id: "REF-103", orderId: "ORD-703", amount: 14.99, reason: "Defect reported - refunded", actor: "system", created: "2026-07-30" },
];

const escalations: Array<{ id: string; orderId: string; reason: string; conditions: string; created: string }> = [];

const auditEntries = [
  { ts: "2026-07-26T09:00:00.000Z", orderId: "ORD-014", action: "refund.automatic", actor: "system", reason: "Out of stock - refunded", before: '{"paymentStatus":"paid"}', after: '{"paymentStatus":"refunded"}', outcome: "refunded" },
  { ts: "2026-07-29T10:00:00.000Z", orderId: "ORD-016", action: "order.created", actor: "system", reason: null, before: null, after: '{"status":"processing"}', outcome: "created" },
  { ts: "2026-07-28T10:00:00.000Z", orderId: "ORD-018", action: "order.created", actor: "system", reason: null, before: null, after: '{"status":"processing"}', outcome: "created" },
  { ts: "2026-07-30T12:00:00.000Z", orderId: "ORD-701", action: "refund.automatic", actor: "system", reason: "Defect reported - refunded", before: '{"paymentStatus":"paid"}', after: '{"paymentStatus":"refunded"}', outcome: "refunded" },
  { ts: "2026-07-30T12:05:00.000Z", orderId: "ORD-702", action: "refund.automatic", actor: "system", reason: "Defect reported - refunded", before: '{"paymentStatus":"paid"}', after: '{"paymentStatus":"refunded"}', outcome: "refunded" },
  { ts: "2026-07-30T12:10:00.000Z", orderId: "ORD-703", action: "refund.automatic", actor: "system", reason: "Defect reported - refunded", before: '{"paymentStatus":"paid"}', after: '{"paymentStatus":"refunded"}', outcome: "refunded" },
];

export function seedDatabase(dbPath: string = DB_PATH): Record<string, number> {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);

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

    return counts;
  } finally {
    db.close();
  }
}

function main() {
  const counts = seedDatabase();
  console.log(`Seeded: ${counts.customers} customers, ${counts.orders} orders, ${counts.payments} payments, ${counts.refunds} refunds, ${counts.escalations} escalations, ${counts.audit_log} audit entries -> ${DB_PATH}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (err) {
    const detail = err instanceof Error ? err.stack ?? err.message : String(err);
    console.error(`Seed failed: ${detail}`);
    process.exit(1);
  }
}
