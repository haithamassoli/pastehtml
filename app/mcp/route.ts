// POST /mcp — the Model Context Protocol endpoint, so an agent publishes and
// manages pastes by calling tools instead of shelling out to curl.
//
// Transport: the SDK's Web-Standard streamable HTTP transport, stateless and in
// JSON mode. A Vercel function keeps nothing between requests, so there is no
// session to hold; one server and one transport are built per request and go
// away with it. Stateless also means no `GET /mcp` SSE stream — nothing here
// pushes notifications — so Next answers a `GET` with its own 405, which is
// what the spec says a server without a stream should do.
//
// Auth: `Authorization: Bearer ph_…`, the same API key the REST API takes, read
// by the same `credentialsFrom`. Every tool below hands that key to Convex,
// which verifies it and checks its scopes; nothing in this file decides who
// owns what. Anonymous `create_paste` needs no credential at all, exactly as
// over REST.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
// ponytail: `zod` is the SDK's own non-optional peer dependency — it is
// installed and version-pinned by the SDK, and `registerTool` accepts nothing
// else — so importing it adds no install. Declare it in package.json the day we
// use it outside this file.
import { z } from "zod";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { route, toAppError, type ApiCredentials } from "@/lib/api";
import { config } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { convex } from "@/lib/paste-http";
import { publishHtml, replaceHtml } from "@/lib/upload";
import { pasteUrls } from "@/lib/urls";

type Log = ReturnType<typeof logger.child>;

/** What the client reads before it decides which tool to call. */
const INSTRUCTIONS = `Publish HTML to ${config.rootDomain} and manage what you published.

create_paste uploads a document and returns a public URL that serves those exact
bytes on their own origin, so a page you write is shareable in one call. Publish
anonymously and you get an update_token back once: keep it, it is the only way
to change or delete that paste later. Publish with an API key and the paste
belongs to that account instead, and no update token is issued.

Errors come back as isError with a JSON body of {"error":{"code","message"}};
the code is stable, the message is for a human.`;

/**
 * The shape every tool that returns one paste answers with. Loose on purpose:
 * a paste carries owner-only fields the caller may or may not be allowed to
 * see, and the additive rule the REST API promises means more can appear. A
 * strict schema would have a conforming client reject its own data.
 */
const pasteOutput = z.looseObject({
  token: z.string().describe("The paste's public token."),
  filename: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  customSubdomain: z.string().optional(),
  contentType: z.string(),
  contentLength: z.number().describe("Size of the stored HTML, in bytes."),
  viewsCount: z.number(),
  createdAt: z.number().describe("Unix milliseconds."),
  updatedAt: z.number().describe("Unix milliseconds."),
  publicUrl: z.string().describe("Serves the HTML verbatim. Share this one."),
  pageUrl: z.string().describe("Metadata page for humans."),
  rawUrl: z.string().describe("The original bytes as source text."),
});

const tokenInput = z
  .string()
  .describe("The paste's public token, as returned by create_paste.");

const updateTokenInput = z
  .string()
  .optional()
  .describe(
    "The update token returned by create_paste. Required for a paste published anonymously; ignored for one owned by an account.",
  );

const text = (value: unknown) => ({
  type: "text" as const,
  text: JSON.stringify(value),
});

/**
 * Runs one tool and reports it. Success carries the same object twice — as
 * `structuredContent` for a client that reads the output schema, and as JSON
 * text for one that does not. Failure maps whatever was thrown onto our own
 * `ErrorCode` set, so an agent sees the same codes the REST API returns.
 *
 * Only the tool name and the outcome are logged: never the HTML, never a
 * credential, never the paste body an argument might carry.
 */
async function run<T extends Record<string, unknown>>(
  log: Log,
  tool: string,
  operation: () => Promise<T>,
) {
  try {
    const data = await operation();
    log.info("mcp tool", { tool, ok: true });
    return { content: [text(data)], structuredContent: data };
  } catch (cause) {
    const error = toAppError(cause);
    // 5xx is ours to fix, so it carries the original; 4xx is the caller's.
    if (error.status >= 500)
      log.error("mcp tool failed", { tool, code: error.code, cause });
    else log.info("mcp tool rejected", { tool, code: error.code });
    return {
      content: [text({ error: { code: error.code, message: error.message } })],
      isError: true,
    };
  }
}

/** A fresh server per request, with the caller's credentials closed over. */
function mcpServer(credentials: ApiCredentials, requestId: string) {
  const log = logger.child({ requestId });
  const server = new McpServer(
    // Version tracks the tool surface, which is versioned with the REST API it
    // delegates to: a breaking change here ships as `/mcp/v2` alongside this.
    { name: config.appName, version: "1.0.0", title: config.appName },
    { instructions: INSTRUCTIONS },
  );

  server.registerTool(
    "create_paste",
    {
      title: "Publish HTML",
      description:
        "Publish an HTML document and get back the URL that serves it. The bytes are stored and served verbatim on their own origin, so scripts and styles in the page work. Use this to hand a human a link to something you wrote.",
      inputSchema: {
        html: z
          .string()
          .describe(
            `The complete HTML document, at most ${config.maxUploadBytes} bytes.`,
          ),
        filename: z.string().optional().describe("Defaults to index.html."),
        title: z.string().optional(),
        description: z.string().optional(),
        subdomain: z
          .string()
          .optional()
          .describe(
            `A custom subdomain to serve on instead of a generated token, as in my-demo.${config.rootDomain}. Fails with CONFLICT if it is taken or reserved.`,
          ),
        folderId: z
          .string()
          .optional()
          .describe("Folder to file it under. Requires an API key."),
      },
      outputSchema: {
        token: z.string(),
        publicUrl: z
          .string()
          .describe("The working link. Give this one to the user."),
        rawUrl: z.string(),
        updateToken: z
          .string()
          .optional()
          .describe(
            "Anonymous pastes only, returned exactly once. Store it — without it the paste can never be changed or deleted.",
          ),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async (args) =>
      run(log, "create_paste", async () => {
        const file = new File([args.html], args.filename ?? "index.html", {
          type: "text/html",
        });
        const { token, publicUrl, rawUrl, updateToken } = await publishHtml(
          convex,
          file,
          {
            title: args.title,
            description: args.description,
            customSubdomain: args.subdomain,
            folderId: args.folderId as Id<"folders"> | undefined,
            apiKey: credentials.apiKey,
          },
        );
        return { token, publicUrl, rawUrl, updateToken };
      }),
  );

  server.registerTool(
    "get_paste",
    {
      title: "Read paste metadata",
      description:
        "Look up a paste by its token: title, size, view count and every URL it has. Never returns the HTML itself — fetch rawUrl for that. Owner-only fields are included when the API key owns the paste.",
      inputSchema: { token: tokenInput },
      outputSchema: pasteOutput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ token }) =>
      run(log, "get_paste", async () => {
        // The owner view is a superset, so try it first and fall back rather
        // than asking twice. Convex decides ownership; a key that does not own
        // this paste simply gets the public shape.
        const owned = credentials.apiKey
          ? await convex
              .query(api.pastes.getOwned, { token, apiKey: credentials.apiKey })
              .catch(() => null)
          : null;
        if (owned) return { ...owned, ...pasteUrls(token) };

        const paste = await convex.query(api.pastes.getByToken, { token });
        if (!paste) throw new AppError("NOT_FOUND", "Paste not found.");
        return { ...paste, ...pasteUrls(token) };
      }),
  );

  server.registerTool(
    "update_paste",
    {
      title: "Update a paste",
      description:
        "Replace a paste's HTML, its metadata, or both. The public URL does not change, so a link already shared keeps working and starts serving the new content.",
      inputSchema: {
        token: tokenInput,
        updateToken: updateTokenInput,
        html: z
          .string()
          .optional()
          .describe("New HTML document. Replaces the stored content entirely."),
        filename: z.string().optional(),
        title: z.string().optional(),
        description: z.string().optional(),
        subdomain: z
          .string()
          .nullable()
          .optional()
          .describe("null removes the custom subdomain."),
        folderId: z
          .string()
          .nullable()
          .optional()
          .describe("null removes the paste from its folder."),
      },
      outputSchema: pasteOutput,
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ token, updateToken, html, subdomain, folderId, ...rest }) =>
      run(log, "update_paste", async () => {
        const authorization = {
          apiKey: credentials.apiKey,
          updateToken: updateToken ?? credentials.updateToken,
        };

        if (html !== undefined) {
          const file = new File([html], rest.filename ?? "index.html", {
            type: "text/html",
          });
          await replaceHtml(convex, file, { token, ...authorization });
        }

        const patch = {
          ...rest,
          ...(subdomain !== undefined && { customSubdomain: subdomain }),
          ...(folderId !== undefined && {
            folderId: folderId as Id<"folders"> | null,
          }),
        };
        if (Object.keys(patch).length > 0)
          await convex.mutation(api.pastes.update, {
            token,
            ...authorization,
            ...patch,
          });

        const paste = await convex.query(api.pastes.getByToken, { token });
        if (!paste) throw new AppError("NOT_FOUND", "Paste not found.");
        return { ...paste, ...pasteUrls(token) };
      }),
  );

  server.registerTool(
    "delete_paste",
    {
      title: "Delete a paste",
      description:
        "Delete a paste and the HTML behind it. The public URL stops resolving immediately and nothing is recoverable, so confirm with the user first.",
      inputSchema: { token: tokenInput, updateToken: updateTokenInput },
      outputSchema: { token: z.string(), deleted: z.boolean() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ token, updateToken }) =>
      run(log, "delete_paste", async () => {
        await convex.mutation(api.pastes.remove, {
          token,
          apiKey: credentials.apiKey,
          updateToken: updateToken ?? credentials.updateToken,
        });
        return { token, deleted: true };
      }),
  );

  server.registerTool(
    "list_pastes",
    {
      title: "List my pastes",
      description:
        "List the pastes owned by the account this API key belongs to, newest first. Anonymous pastes are not listed anywhere — they are reachable only by their token.",
      inputSchema: {
        limit: z.number().optional().describe("Default 50, maximum 200."),
      },
      outputSchema: { pastes: z.array(pasteOutput) },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ limit }) =>
      run(log, "list_pastes", async () => {
        const pastes = await convex.query(api.pastes.listByOwner, {
          limit,
          apiKey: credentials.apiKey,
        });
        return {
          pastes: pastes.map((paste) => ({
            ...paste,
            ...pasteUrls(paste.token),
          })),
        };
      }),
  );

  return server;
}

export const POST = route("api:write", async ({ request, credentials, id }) => {
  const server = mcpServer(credentials, id);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    // JSON mode buffers the whole response, so it is complete before `finally`
    // tears the server down.
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
});
