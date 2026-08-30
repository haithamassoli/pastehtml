// GET / PATCH / DELETE /api/v1/pastes/[token].
//
// Authorization comes from whichever credential the request carries — a Clerk
// session, an `Authorization: Bearer ph_…` API key, or the `X-Update-Token` a
// paste was published with. Every one of those is checked inside Convex against
// the stored digest or the verified identity, never here.
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { MAX_UPLOAD_BYTES } from "@/convex/lib/validation";
import { ok, route } from "@/lib/api";
import { authedConvex } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { convex } from "@/lib/paste-http";
import { replaceHtml } from "@/lib/upload";
import { pasteUrls } from "@/lib/urls";

type Context = RouteContext<"/api/v1/pastes/[token]">;

export const GET = route<Context>(
  "api:read",
  async ({ context, credentials, id }) => {
    const { token } = await context.params;

    // The owner view is a superset, so try it first and fall back rather than
    // asking twice. Convex decides ownership; a stranger simply gets the public
    // shape, and a paste that does not exist is 404 either way.
    const client = await authedConvex();
    const owned = await client
      .query(api.pastes.getOwned, { token, apiKey: credentials.apiKey })
      .catch(() => null);
    if (owned) return ok({ ...owned, ...pasteUrls(token) }, id);

    const paste = await convex.query(api.pastes.getByToken, { token });
    if (!paste) throw new AppError("NOT_FOUND", "Paste not found.");
    return ok({ ...paste, ...pasteUrls(token) }, id);
  },
);

export const PATCH = route<Context>(
  "api:write",
  async ({ request, context, credentials, id }) => {
    const { token } = await context.params;
    const client = await authedConvex();
    const contentType = request.headers.get("content-type") ?? "";

    // An HTML body replaces the content; a JSON body edits the metadata. Same
    // split as `POST`, so "the body is the paste" stays true across the API.
    if (!contentType.includes("json")) {
      const body = await request.arrayBuffer();
      if (body.byteLength === 0)
        throw new AppError("VALIDATION", "Request body is empty.");
      if (body.byteLength > MAX_UPLOAD_BYTES)
        throw new AppError(
          "PAYLOAD_TOO_LARGE",
          `HTML must be at most ${MAX_UPLOAD_BYTES} bytes.`,
        );

      const file = new File([body], filenameOf(request) ?? "index.html", {
        type: contentType || "text/html",
      });
      await replaceHtml(client, file, { token, ...credentials });
    } else {
      const patch = await readJson(request);
      // `password` is a separate mutation because enabling protection revokes
      // every outstanding unlock session; it is not a field you can just set.
      const { password, ...fields } = patch;
      if (Object.keys(fields).length > 0)
        await client.mutation(api.pastes.update, {
          token,
          ...credentials,
          ...pick(fields),
        });
      if (password !== undefined)
        await (password === null
          ? client.mutation(api.pastes.removePassword, {
              token,
              ...credentials,
            })
          : client.mutation(api.pastes.setPassword, {
              token,
              ...credentials,
              password: string(password, "password"),
            }));
    }

    const paste = await convex.query(api.pastes.getByToken, { token });
    return ok({ ...paste, ...pasteUrls(token) }, id);
  },
);

export const DELETE = route<Context>(
  "api:write",
  async ({ context, credentials, id }) => {
    const { token } = await context.params;
    const client = await authedConvex();
    // The paste row goes first and its stored HTML with it, so the public URL
    // stops resolving in the same transaction that authorized the delete.
    await client.mutation(api.pastes.remove, { token, ...credentials });
    return ok({ token, deleted: true }, id);
  },
);

function filenameOf(request: Request): string | undefined {
  return new URL(request.url).searchParams.get("filename") ?? undefined;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => {
    throw new AppError("VALIDATION", "Body is not valid JSON.");
  });
  if (typeof body !== "object" || body === null || Array.isArray(body))
    throw new AppError("VALIDATION", "Body must be a JSON object.");
  return body as Record<string, unknown>;
}

/** Narrows the JSON body to the fields `pastes.update` accepts, and their types. */
function pick(fields: Record<string, unknown>) {
  const out: {
    title?: string;
    description?: string;
    filename?: string;
    customSubdomain?: string | null;
    folderId?: Id<"folders"> | null;
  } = {};
  if ("title" in fields) out.title = string(fields.title, "title");
  if ("description" in fields)
    out.description = string(fields.description, "description");
  if ("filename" in fields) out.filename = string(fields.filename, "filename");
  if ("subdomain" in fields)
    out.customSubdomain = nullable(fields.subdomain, "subdomain");
  if ("folderId" in fields)
    out.folderId = nullable(
      fields.folderId,
      "folderId",
    ) as Id<"folders"> | null;
  return out;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string")
    throw new AppError("VALIDATION", `"${field}" must be a string.`);
  return value;
}

function nullable(value: unknown, field: string): string | null {
  return value === null ? null : string(value, field);
}
