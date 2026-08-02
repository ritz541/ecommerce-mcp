# AI Worklog — ecommerce-mcp

This document explains how AI was used while building this assignment. It covers the tools and models I used, how I divided the work between myself and AI, the instructions I gave, the suggestions I accepted or rejected, and how I verified the generated code.

## AI tools and models used

| Phase               | Tool / Harness           | Model             | Purpose                                                                     |
| ------------------- | ------------------------ | ----------------- | --------------------------------------------------------------------------- |
| Research & planning | ChatGPT                  | Default web model | Understanding MCP, planning the implementation, and clarifying concepts.    |
| First prototype     | Hermes                   | StepFun 3.7 Flash | Building a minimal read-only MCP server to establish the project structure. |
| Main implementation | opencode                 | deepseek-v4-flash | Most of the implementation, debugging, and iterative development.           |
| Independent review  | Alibaba open-code-review | agnes-2.5-flash   | Reviewing the generated code using a different model.                       |
| Local testing       | Kimi Code                | Kimi Code agent   | Testing the MCP server locally using a real AI client.                      |
| Production testing  | oh-my-pi                 | oh-my-pi agent    | Verifying the deployed MCP server end-to-end.                               |

## Why I used different models

I didn't use a single model for the entire project because different tools were better suited for different stages.

* ChatGPT helped me understand MCP concepts and plan the project.
* StepFun 3.7 Flash was used to get the first working prototype running quickly.
* DeepSeek v4 Flash handled most of the implementation and debugging inside the development loop.
* Agnes 2.5 Flash was used as an independent reviewer instead of relying on the same model that generated the code.
* Kimi Code and oh-my-pi were used to verify that the MCP worked correctly with real AI clients.

## How I planned the work

One of the first things I changed was how the project was being built.

The AI initially tried to scaffold most of the assignment in one go. Instead of continuing with that approach, I broke the work into smaller stages so I could understand each part before adding more functionality.

The implementation progressed in four stages:

1. Build a minimal read-only MCP server with `get_order` and `search_orders`.
2. Improve search with pagination, validation, and deterministic results.
3. Add the refund workflow, policy engine, escalation path, and audit logging.
4. Harden the project with idempotency, rate limiting, validation, automated tests, and CI.

The git history reflects this progression, with separate commits for each major stage.

## Division of responsibilities

I treated AI as a development assistant rather than allowing it to make product decisions.

### My responsibilities

* Defining the scope of the assignment.
* Asking the client for clarification instead of making assumptions.
* Designing the refund workflow.
* Defining the refund policy rules.
* Deciding which MCP tools should and should not exist.
* Reviewing generated code.
* Verifying behaviour through testing.

### AI's responsibilities

* Generating TypeScript scaffolding.
* Setting up the MCP SDK.
* Implementing SQLite integration.
* Generating schemas and seed data.
* Implementing tools from my requirements.
* Helping resolve compile-time and runtime issues.
* Generating automated tests.

## Important instructions I gave the AI

Some instructions had a significant impact on the final implementation:

* Build only a minimal read-only MCP server first.
* Enforce the refund policy in backend code rather than relying on tool descriptions.
* Do not expose destructive tools.
* Implement the client's refund policy exactly:

  * refund amount must not exceed $150 or the paid amount
  * order must be within 30 days
  * risk score must be below 70
  * carrier exception must be verified
  * no existing refund
  * otherwise create a manager approval request
  * keep operations idempotent
  * record every action in the audit log

## AI suggestions I rejected

The AI wasn't always right, and I changed several of its suggestions during development.

### Building everything at once

The first approach generated most of the project in a single pass. I chose not to continue with that because it became difficult to understand and verify.

Instead, I restarted with a minimal read-only MCP server and gradually added functionality after each stage was working.

### Database reset tool

One suggestion was to expose a database reset tool so demo orders could be reused after refunds were issued.

I rejected this because exposing a destructive operation through MCP would create an unnecessary safety risk.

Instead, I introduced a separate test database and configured the server to reseed demo data automatically. This solved the original problem without exposing a destructive tool.

### Smaller corrections

Throughout development I also reviewed generated SQL, refined tool descriptions, and checked that the refund logic matched the client's specification instead of assuming the generated implementation was correct.

## How I verified AI-generated work

I didn't rely on generated code without checking it.

First, I reviewed the refund workflow and policy implementation against the client's requirements.

Next, I used Agnes 2.5 Flash to perform an independent review of the implementation rather than relying on the same model that generated the code.

I also ran the automated test suite, which covers:

* refund policy rules
* idempotency
* audit logging
* MCP protocol interactions
* end-to-end refund flows
* rate limiting

Finally, I tested the server using real AI clients.

* Kimi Code connected to the local MCP server.
* oh-my-pi connected to the deployed endpoint at `https://mcp.chavanpatil.com/mcp`.

Testing with actual MCP clients provided additional confidence that the server behaved correctly outside the automated test environment.

## Remaining limitations

Some functionality was intentionally left out because it was outside the scope of the assignment.

* Authentication and authorization are not implemented.
* Manager approval requests can be created but not approved or rejected through MCP.
* Rate limiting is IP-based, so clients behind the same network share the same limit.
* SQLite is suitable for this assignment but is not intended for horizontal scaling.
* All data used in the project is synthetic. No real customer information or credentials were used.
