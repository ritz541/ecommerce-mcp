import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.TEST_PORT ?? 8399);
const BASE = `http://127.0.0.1:${PORT}`;
const PROTOCOL_VERSION = "2025-06-18";

let server: ChildProcess | null = null;

interface McpResponse {
  id?: number;
  result: {
    content?: Array<{ type: string; text: string }>;
    isError?: boolean;
    serverInfo?: { name: string };
    capabilities?: unknown;
    tools?: Array<{ name: string }>;
  };
}

interface OrderItem {
  name: string;
  qty: number;
  price: number;
}

interface OrderDetail {
  id: string;
  customer: string;
  email: string;
  status: string;
  items: OrderItem[];
  total: number;
  created: string;
  tracking: string | null;
  notes: string | null;
}

interface OrderSummary {
  id: string;
  customer: string;
  email: string;
  status: string;
  total: number;
  created: string;
  tracking: string | null;
}

function startServer() {
  return new Promise<ChildProcess>((resolve, reject) => {
    const child = spawn("npx", ["tsx", "src/index.ts"], {
      cwd: root,
      env: { ...process.env, PORT: String(PORT) },
      stdio: "ignore",
    });
    const timeout = setTimeout(
      () => reject(new Error("timed out waiting for MCP server")),
      15000
    );
    child.on("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`server exited early with code ${code}`));
    });
    const poll = async () => {
      try {
        const res = await fetch(`${BASE}/health`);
        if (res.ok) {
          clearTimeout(timeout);
          resolve(child);
          return;
        }
      } catch {
        // not up yet
      }
      setTimeout(poll, 250);
    };
    poll();
  });
}

async function mcpRequest(payload: unknown): Promise<McpResponse> {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
    },
    body: JSON.stringify(payload),
  });
  assert.equal(res.status, 200, `expected 200, got ${res.status}`);
  const text = await res.text();
  const dataLine = text.split("\n").find((line) => line.startsWith("data: "));
  assert.ok(dataLine, `expected an SSE data line, got: ${text}`);
  return JSON.parse(dataLine.slice("data: ".length)) as McpResponse;
}

async function callTool(name: string, args: Record<string, unknown>): Promise<McpResponse> {
  return mcpRequest({
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 1e9),
    method: "tools/call",
    params: { name, arguments: args },
  });
}

function parseResult(res: McpResponse): unknown {
  assert.equal(res.result.content[0].type, "text");
  return JSON.parse(res.result.content[0].text) as unknown;
}

before(async () => {
  if (!existsSync(path.join(root, "data", "orders.db"))) {
    const result = spawnSync("npx", ["tsx", "src/seed.ts"], {
      cwd: root,
      stdio: "inherit",
    });
    assert.equal(result.status, 0, "seed failed");
  }
  server = await startServer();
});

after(() => {
  server?.kill();
});

test("initialize handshake", async () => {
  const res = await mcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    },
  });
  assert.equal(res.id, 1);
  assert.equal(res.result.serverInfo.name, "ecommerce-mcp");
  assert.deepEqual(res.result.capabilities, { tools: {} });
});

test("tools/list exposes get_order and search_orders", async () => {
  const res = await mcpRequest({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });
  const names = res.result.tools.map((tool: { name: string }) => tool.name);
  assert.ok(names.includes("get_order"));
  assert.ok(names.includes("search_orders"));
});

test("get_order returns order details", async () => {
  const res = await callTool("get_order", { orderId: "ORD-001" });
  const data = parseResult(res) as OrderDetail;
  assert.equal(data.id, "ORD-001");
  assert.equal(data.customer, "Alice Johnson");
  assert.equal(data.email, "alice@example.com");
  assert.equal(data.status, "delivered");
  assert.equal(data.total, 105.97);
  assert.equal(data.items[0].name, "Wireless Headphones");
  assert.equal(data.tracking, "1Z999AA10123456784");
});

test("get_order returns not found for unknown order", async () => {
  const res = await callTool("get_order", { orderId: "ORD-999" });
  assert.equal(res.result.isError, true);
  const data = parseResult(res) as { ok: boolean; message: string };
  assert.equal(data.ok, false);
  assert.match(data.message, /ORD-999 not found/i);
});

test("search_orders filters by status", async () => {
  const res = await callTool("search_orders", { status: "shipped" });
  const data = parseResult(res) as OrderSummary[];
  assert.ok(Array.isArray(data));
  assert.equal(data.length, 3);
  assert.ok(data.some((o) => o.id === "ORD-002"));
});

test("search_orders with no matches returns an empty array", async () => {
  const res = await callTool("search_orders", { status: "shipped", customer: "zzz-nobody" });
  const data = parseResult(res) as OrderSummary[];
  assert.ok(Array.isArray(data));
  assert.equal(data.length, 0);
});

test("search_orders caps limit at 10", async () => {
  const res = await callTool("search_orders", { limit: 500 });
  const data = parseResult(res) as OrderSummary[];
  assert.ok(Array.isArray(data));
  assert.ok(data.length <= 10);
});

test("search_orders supports offset pagination", async () => {
  const page1 = parseResult(await callTool("search_orders", { limit: 5, offset: 0 })) as OrderSummary[];
  const page2 = parseResult(await callTool("search_orders", { limit: 5, offset: 5 })) as OrderSummary[];
  assert.equal(page1.length, 5);
  assert.equal(page2.length, 5);
  const ids1 = page1.map((o) => o.id);
  const ids2 = page2.map((o) => o.id);
  assert.ok(ids1.some((id) => !ids2.includes(id)), "pages should not fully overlap");
  assert.equal(ids1.length, new Set(ids1).size);
});

test("search_orders offset beyond results returns empty array", async () => {
  const data = parseResult(await callTool("search_orders", { limit: 5, offset: 999 })) as OrderSummary[];
  assert.ok(Array.isArray(data));
  assert.equal(data.length, 0);
});

test("search_orders offset pages deterministically (delivered, limit 1)", async () => {
  const page1 = parseResult(await callTool("search_orders", { status: "delivered", limit: 1, offset: 0 })) as OrderSummary[];
  const page2 = parseResult(await callTool("search_orders", { status: "delivered", limit: 1, offset: 1 })) as OrderSummary[];
  assert.equal(page1[0].id, "ORD-015");
  assert.equal(page2[0].id, "ORD-010");
});
