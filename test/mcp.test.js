import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = Number(process.env.TEST_PORT ?? 8399);
const BASE = `http://127.0.0.1:${PORT}`;
const PROTOCOL_VERSION = "2025-06-18";

let server;

function startServer() {
  return new Promise((resolve, reject) => {
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

async function mcpRequest(payload) {
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
  return JSON.parse(dataLine.slice("data: ".length));
}

async function callTool(name, args) {
  return mcpRequest({
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 1e9),
    method: "tools/call",
    params: { name, arguments: args },
  });
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
  const names = res.result.tools.map((tool) => tool.name);
  assert.ok(names.includes("get_order"));
  assert.ok(names.includes("search_orders"));
});

test("get_order returns order details", async () => {
  const res = await callTool("get_order", { orderId: "ORD-001" });
  assert.equal(res.result.content[0].type, "text");
  assert.match(res.result.content[0].text, /Alice Johnson/);
  assert.match(res.result.content[0].text, /Wireless Headphones/);
  assert.match(res.result.content[0].text, /Total: \$105\.97/);
});

test("get_order returns not found for unknown order", async () => {
  const res = await callTool("get_order", { orderId: "ORD-999" });
  assert.equal(res.result.content[0].type, "text");
  assert.match(res.result.content[0].text, /Order not found\./);
});

test("search_orders filters by status", async () => {
  const res = await callTool("search_orders", { status: "shipped" });
  assert.match(res.result.content[0].text, /Found 3 order\(s\)/);
  assert.match(res.result.content[0].text, /ORD-002/);
});

test("search_orders with no matches returns a message", async () => {
  const res = await callTool("search_orders", { status: "shipped", customer: "zzz-nobody" });
  assert.match(res.result.content[0].text, /No orders found\./);
});
