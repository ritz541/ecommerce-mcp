import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.resolve(__dirname, "..", "data", "orders.db");

const orders = [
  { id: "ORD-001", customer: "Alice Johnson", email: "alice@example.com", status: "delivered", items: [{ name: "Wireless Headphones", qty: 1, price: 79.99 }, { name: "USB-C Cable", qty: 2, price: 12.99 }], total: 105.97, created: "2026-07-01", tracking: "1Z999AA10123456784", notes: null },
  { id: "ORD-002", customer: "Bob Smith", email: "bob@example.com", status: "shipped", items: [{ name: "Mechanical Keyboard", qty: 1, price: 149.99 }], total: 149.99, created: "2026-07-03", tracking: "1Z999AA10123456785", notes: "Leave at door" },
  { id: "ORD-003", customer: "Carol Davis", email: "carol@example.com", status: "processing", items: [{ name: "Monitor 27\" 4K", qty: 2, price: 449.99 }, { name: "Monitor Arm", qty: 2, price: 89.99 }], total: 1079.96, created: "2026-07-05", tracking: null, notes: null },
  { id: "ORD-004", customer: "Dave Wilson", email: "dave@example.com", status: "pending", items: [{ name: "Laptop Stand", qty: 1, price: 44.99 }], total: 44.99, created: "2026-07-10", tracking: null, notes: "Awaiting payment" },
  { id: "ORD-005", customer: "Eve Martinez", email: "eve@example.com", status: "delivered", items: [{ name: "Webcam 1080p", qty: 1, price: 59.99 }, { name: "Ring Light", qty: 1, price: 34.99 }], total: 94.98, created: "2026-07-12", tracking: "1Z999AA10123456786", notes: null },
  { id: "ORD-006", customer: "Frank Lee", email: "frank@example.com", status: "cancelled", items: [{ name: "Desk Chair", qty: 1, price: 299.99 }], total: 299.99, created: "2026-07-14", tracking: null, notes: "Customer cancelled" },
  { id: "ORD-007", customer: "Grace Kim", email: "grace@example.com", status: "shipped", items: [{ name: "USB Hub 7-port", qty: 3, price: 24.99 }], total: 74.97, created: "2026-07-15", tracking: "1Z999AA10123456787", notes: null },
  { id: "ORD-008", customer: "Henry Brown", email: "henry@example.com", status: "processing", items: [{ name: "External SSD 1TB", qty: 1, price: 89.99 }, { name: "SATA Cable", qty: 2, price: 7.99 }], total: 105.97, created: "2026-07-16", tracking: null, notes: null },
  { id: "ORD-009", customer: "Iris Chen", email: "iris@example.com", status: "pending", items: [{ name: "Mouse Wireless", qty: 1, price: 29.99 }, { name: "Mouse Pad XL", qty: 1, price: 19.99 }], total: 49.98, created: "2026-07-18", tracking: null, notes: "Gift wrap requested" },
  { id: "ORD-010", customer: "Jack Taylor", email: "jack@example.com", status: "delivered", items: [{ name: "Phone Case", qty: 2, price: 15.99 }, { name: "Screen Protector", qty: 2, price: 9.99 }], total: 51.96, created: "2026-07-20", tracking: "1Z999AA10123456788", notes: null },
  { id: "ORD-011", customer: "Karen White", email: "karen@example.com", status: "shipped", items: [{ name: "Bluetooth Speaker", qty: 1, price: 69.99 }], total: 69.99, created: "2026-07-22", tracking: "1Z999AA10123456789", notes: "Fragile - handle carefully" },
  { id: "ORD-012", customer: "Leo Garcia", email: "leo@example.com", status: "processing", items: [{ name: "Standing Desk", qty: 1, price: 399.99 }, { name: "Desk Mat", qty: 1, price: 39.99 }], total: 439.98, created: "2026-07-23", tracking: null, notes: null },
  { id: "ORD-013", customer: "Mia Robinson", email: "mia@example.com", status: "pending", items: [{ name: "Notebook Pro 15\"", qty: 1, price: 1299.99 }], total: 1299.99, created: "2026-07-25", tracking: null, notes: "Express shipping requested" },
  { id: "ORD-014", customer: "Noah Adams", email: "noah@example.com", status: "cancelled", items: [{ name: "Tablet 10\"", qty: 1, price: 329.99 }], total: 329.99, created: "2026-07-26", tracking: null, notes: "Out of stock - refunded" },
  { id: "ORD-015", customer: "Olivia Nelson", email: "olivia@example.com", status: "delivered", items: [{ name: "Cable Management Kit", qty: 1, price: 24.99 }], total: 24.99, created: "2026-07-27", tracking: "1Z999AA10123456790", notes: null },
];

function main() {
  const db = new Database(DB_PATH);

  db.exec(`DROP TABLE IF EXISTS orders;
    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      email TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
      items TEXT NOT NULL,
      total REAL NOT NULL,
      created TEXT NOT NULL,
      tracking TEXT,
      notes TEXT
    );`);

  const insert = db.prepare(
    `INSERT INTO orders (id, customer, email, status, items, total, created, tracking, notes)
     VALUES (@id, @customer, @email, @status, @items, @total, @created, @tracking, @notes)`
  );

  const insertMany = db.transaction((rows: typeof orders) => {
    for (const row of rows) {
      insert.run({
        ...row,
        items: JSON.stringify(row.items),
      });
    }
  });

  insertMany(orders);

  const count = db.prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number };
  console.log(`Seeded ${count.n} orders into ${DB_PATH}`);
  db.close();
}

main();
