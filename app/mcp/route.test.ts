import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, mutation } = vi.hoisted(() => ({
  query: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    query = query;
    mutation = mutation;
  },
}));

const { POST } = await import("./route");

const TOKEN = "k3n8pq2vd41x";

const PASTE = {
  _id: "pastes:1",
  token: TOKEN,
  filename: "index.html",
  title: "Release notes",
  contentType: "text/html",
  contentLength: 16,
  visibility: "public",
  viewsCount: 3,
  isOwned: false,
  createdAt: 1,
  updatedAt: 2,
};

/** One JSON-RPC round trip through the route handler. */
async function rpc(
  method: string,
  params: unknown = {},
  headers: Record<string, string> = {},
) {
  const response = await POST(
    new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...headers,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }),
    undefined,
  );
  return { response, body: await response.json() };
}

/** A tool call, with its JSON payload parsed back out of the text content. */
async function callTool(
  name: string,
  args: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  const { body } = await rpc("tools/call", { name, arguments: args }, headers);
  const result = body.result;
  return { ...result, payload: JSON.parse(result.content[0].text) };
}

/** What a Convex function rejects with when it fails one of our checks. */
const convexError = (code: string, message: string) =>
  Object.assign(new Error(message), { data: { code, message } });

const RESULTS: Record<string, unknown> = {};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(RESULTS, {
    "rateLimit:consume": {
      ok: true,
      limit: 60,
      remaining: 59,
      resetAt: Date.now() + 60_000,
    },
    "apiKeys:touch": null,
    "storage:generateUploadUrl": "https://storage.test/upload",
    "pastes:create": {
      pasteId: "pastes:1",
      token: TOKEN,
      updateToken: "upd_secret",
    },
    "pastes:update": null,
    "pastes:remove": null,
    "pastes:getByToken": PASTE,
    "pastes:getOwned": { ...PASTE, folderId: null, hasPassword: false },
    "pastes:listByOwner": [PASTE],
  });

  const answer = async (reference: unknown) => {
    const name = getFunctionName(reference as never);
    const value = RESULTS[name];
    if (value instanceof Error) throw value;
    return value;
  };
  query.mockImplementation(answer);
  mutation.mockImplementation(answer);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ storageId: "storage:1" })),
  );
});

describe("tools/list", () => {
  it("advertises every tool with an input and an output schema", async () => {
    const { body } = await rpc("tools/list");
    const names = body.result.tools.map((tool: { name: string }) => tool.name);

    expect(names.sort()).toEqual([
      "create_paste",
      "delete_paste",
      "get_paste",
      "list_pastes",
      "update_paste",
    ]);
    for (const tool of body.result.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.outputSchema.type).toBe("object");
    }
  });

  it("marks the destructive tool as destructive", async () => {
    const { body } = await rpc("tools/list");
    const remove = body.result.tools.find(
      (tool: { name: string }) => tool.name === "delete_paste",
    );

    expect(remove.annotations.destructiveHint).toBe(true);
  });
});

describe("create_paste", () => {
  it("publishes and answers with the working URLs and the update token", async () => {
    const result = await callTool("create_paste", {
      html: "<h1>hello</h1>",
      title: "Release notes",
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      token: TOKEN,
      publicUrl: `http://${TOKEN}.localhost:3000`,
      rawUrl: `http://localhost:3000/p/${TOKEN}/raw`,
      updateToken: "upd_secret",
    });
    // The text content carries the same object, for a client that ignores the
    // output schema.
    expect(result.payload).toEqual(result.structuredContent);
  });

  it("hands the API key to Convex rather than deciding ownership here", async () => {
    await callTool(
      "create_paste",
      { html: "<h1>hello</h1>" },
      { authorization: "Bearer ph_secretkey" },
    );

    expect(mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ apiKey: "ph_secretkey" }),
    );
  });

  it("maps a rejected upload onto our own error code", async () => {
    RESULTS["pastes:create"] = convexError(
      "CONFLICT",
      '"my-demo" is already taken.',
    );

    const result = await callTool("create_paste", {
      html: "<h1>hello</h1>",
      subdomain: "my-demo",
    });

    expect(result.isError).toBe(true);
    expect(result.payload).toEqual({
      error: { code: "CONFLICT", message: '"my-demo" is already taken.' },
    });
  });

  it("rejects a document over the upload limit before it reaches storage", async () => {
    const result = await callTool("create_paste", {
      html: "x".repeat(5 * 1024 * 1024 + 1),
    });

    expect(result.payload.error.code).toBe("PAYLOAD_TOO_LARGE");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("get_paste", () => {
  it("returns the public shape plus every URL", async () => {
    const result = await callTool("get_paste", { token: TOKEN });

    expect(result.structuredContent).toMatchObject({
      token: TOKEN,
      title: "Release notes",
      publicUrl: `http://${TOKEN}.localhost:3000`,
      pageUrl: `http://localhost:3000/p/${TOKEN}`,
    });
  });

  it("does not ask for the owner view without a key to ask with", async () => {
    await callTool("get_paste", { token: TOKEN });

    expect(query).toHaveBeenCalledOnce();
  });

  it("prefers the owner view when the key owns the paste", async () => {
    const result = await callTool(
      "get_paste",
      { token: TOKEN },
      { authorization: "Bearer ph_secretkey" },
    );

    expect(result.structuredContent.hasPassword).toBe(false);
  });

  it("reports an unknown paste as NOT_FOUND", async () => {
    RESULTS["pastes:getByToken"] = null;

    const result = await callTool("get_paste", { token: "nope" });

    expect(result.isError).toBe(true);
    expect(result.payload.error.code).toBe("NOT_FOUND");
  });
});

describe("update_paste", () => {
  it("passes the caller's update token through to the authorization check", async () => {
    await callTool("update_paste", {
      token: TOKEN,
      title: "Newer",
      subdomain: null,
      updateToken: "upd_secret",
    });

    expect(mutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        token: TOKEN,
        updateToken: "upd_secret",
        title: "Newer",
        customSubdomain: null,
      }),
    );
  });

  it("replaces the content when HTML is given, without touching metadata", async () => {
    await callTool("update_paste", { token: TOKEN, html: "<h1>new</h1>" });

    const called = mutation.mock.calls.map(([reference]) =>
      getFunctionName(reference),
    );
    expect(called).toContain("pastes:replaceContent");
    expect(called).not.toContain("pastes:update");
  });
});

describe("delete_paste", () => {
  it("confirms the deletion", async () => {
    const result = await callTool("delete_paste", { token: TOKEN });

    expect(result.structuredContent).toEqual({ token: TOKEN, deleted: true });
  });
});

describe("list_pastes", () => {
  it("refuses a caller who presented no credential", async () => {
    RESULTS["pastes:listByOwner"] = convexError(
      "UNAUTHORIZED",
      "Sign in required.",
    );

    const result = await callTool("list_pastes");

    expect(result.isError).toBe(true);
    expect(result.payload).toEqual({
      error: { code: "UNAUTHORIZED", message: "Sign in required." },
    });
  });

  it("adds the URLs each paste is reachable at", async () => {
    const result = await callTool("list_pastes");

    expect(result.structuredContent.pastes[0].publicUrl).toBe(
      `http://${TOKEN}.localhost:3000`,
    );
  });
});

describe("protocol", () => {
  it("negotiates an initialize handshake without a session", async () => {
    const { response, body } = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1" },
    });

    expect(response.status).toBe(200);
    expect(body.result.serverInfo.name).toBe("pastehtml");
    expect(body.result.capabilities.tools).toBeDefined();
    // Stateless: nothing to carry between requests.
    expect(response.headers.get("Mcp-Session-Id")).toBeNull();
  });

  it("reports an unknown tool as a tool error, not a transport failure", async () => {
    const { response, body } = await rpc("tools/call", {
      name: "publish_pdf",
      arguments: {},
    });

    expect(response.status).toBe(200);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("publish_pdf");
  });

  it("rejects arguments that do not match the tool's input schema", async () => {
    const { body } = await rpc("tools/call", {
      name: "get_paste",
      arguments: { token: 42 },
    });

    expect(body.result.isError).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it("answers a rate-limited caller with 429 and no tool call", async () => {
    RESULTS["rateLimit:consume"] = {
      ok: false,
      limit: 60,
      remaining: 0,
      resetAt: Date.now() + 1_000,
    };

    const { response, body } = await rpc("tools/list");

    expect(response.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
  });
});
