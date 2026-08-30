import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { expect, test } from "@playwright/test";

// Publishing over MCP, driven by the official SDK client rather than by hand —
// so the transport negotiation an agent actually performs is part of the test,
// not just the JSON-RPC shape (`app/mcp/route.test.ts` covers that).
//
// Needs a running Convex dev deployment (`npx convex dev`).
const MCP = new URL("http://localhost:3000/mcp");
const HTML = "<h1>published by an agent</h1>";

/** An MCP session against the running app, optionally holding an API key. */
async function connect(apiKey?: string) {
  const client = new Client({ name: "pastehtml-e2e", version: "1.0.0" });
  await client.connect(
    new StreamableHTTPClientTransport(MCP, {
      requestInit: apiKey
        ? { headers: { Authorization: `Bearer ${apiKey}` } }
        : undefined,
    }),
  );
  return client;
}

/** A tool call, with the JSON payload the tool answered with. */
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown> = {},
) {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { text: string }[];
  return { isError: result.isError, payload: JSON.parse(content[0].text) };
}

test("an agent publishes, updates and deletes a paste over MCP", async ({
  request,
}) => {
  const client = await connect();

  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  expect(tools).toEqual(
    expect.arrayContaining([
      "create_paste",
      "get_paste",
      "update_paste",
      "delete_paste",
      "list_pastes",
    ]),
  );

  const created = await call(client, "create_paste", {
    html: HTML,
    filename: "agent.html",
    title: "From an agent",
  });
  expect(created.isError).toBeFalsy();
  expect(created.payload.token).toHaveLength(12);
  // Anonymous over MCP just as over REST: the update token comes back once and
  // is the only way this session can change what it published.
  expect(created.payload.updateToken).toHaveLength(32);

  // The link the agent would hand a human really serves those bytes.
  expect(await (await request.get(created.payload.publicUrl)).text()).toBe(
    HTML,
  );

  const read = await call(client, "get_paste", {
    token: created.payload.token,
  });
  expect(read.payload.title).toBe("From an agent");
  expect(read.payload.filename).toBe("agent.html");
  // Metadata only — the HTML is fetched from rawUrl, never inlined in a tool
  // result, so a large paste cannot blow up an agent's context.
  expect(JSON.stringify(read.payload)).not.toContain("published by an agent");

  const updated = await call(client, "update_paste", {
    token: created.payload.token,
    updateToken: created.payload.updateToken,
    html: "<h1>revised by an agent</h1>",
    title: "Revised",
  });
  expect(updated.isError).toBeFalsy();
  expect(updated.payload.title).toBe("Revised");
  // Same URL, new content: a link already shared keeps working.
  expect(await (await request.get(created.payload.publicUrl)).text()).toBe(
    "<h1>revised by an agent</h1>",
  );

  const deleted = await call(client, "delete_paste", {
    token: created.payload.token,
    updateToken: created.payload.updateToken,
  });
  expect(deleted.payload.deleted).toBe(true);
  expect(
    (
      await request.get(created.payload.publicUrl, { failOnStatusCode: false })
    ).status(),
  ).toBe(404);

  await client.close();
});

test("a tool rejection comes back as an error an agent can read", async () => {
  const client = await connect();

  // No update token, so nothing authorizes the write. The tool answers with our
  // own stable error code rather than a transport-level failure, which is what
  // lets an agent decide what to do next.
  const refused = await call(client, "delete_paste", {
    token: "nosuchpaste00",
  });
  expect(refused.isError).toBe(true);
  expect(refused.payload.error.code).toMatch(/NOT_FOUND|UNAUTHORIZED/);

  await client.close();
});
