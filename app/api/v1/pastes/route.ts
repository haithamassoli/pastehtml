// POST /api/v1/pastes — publish HTML in one request.
//
//   curl -X POST https://pastehtml.assoli.site/api/v1/pastes \
//        -H 'Content-Type: text/html' --data-binary @index.html
//
// The body is the HTML itself rather than a JSON wrapper, so `--data-binary @`
// and a shell pipe both work without escaping. Metadata rides in the query
// string. Anonymous by default; a Clerk session or an API key makes the paste
// owned, and only an anonymous paste gets an update token back.
import type { Id } from "@/convex/_generated/dataModel";
import { MAX_UPLOAD_BYTES } from "@/convex/lib/validation";
import { ok, route } from "@/lib/api";
import { authedConvex } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { publishHtml } from "@/lib/upload";

const tooLarge = () =>
  new AppError(
    "PAYLOAD_TOO_LARGE",
    `HTML must be at most ${MAX_UPLOAD_BYTES} bytes.`,
  );

export const POST = route("api:write", async ({ request, credentials, id }) => {
  const url = new URL(request.url);
  const param = (name: string) => url.searchParams.get(name) ?? undefined;

  // Cheap rejection before a single byte is read. The size is re-checked
  // against the stored object inside Convex, which is the only count that
  // cannot be lied about.
  if (Number(request.headers.get("content-length")) > MAX_UPLOAD_BYTES)
    throw tooLarge();

  const contentType = request.headers.get("content-type") ?? "text/html";
  const body = await request.arrayBuffer();
  if (body.byteLength === 0)
    throw new AppError("VALIDATION", "Request body is empty.");
  if (body.byteLength > MAX_UPLOAD_BYTES) throw tooLarge();

  const file = new File([body], param("filename") ?? "index.html", {
    type: contentType,
  });

  const result = await publishHtml(await authedConvex(), file, {
    title: param("title"),
    description: param("description"),
    customSubdomain: param("subdomain"),
    folderId: param("folderId") as Id<"folders"> | undefined,
    apiKey: credentials.apiKey,
  });

  return ok(result, id, 201);
});
