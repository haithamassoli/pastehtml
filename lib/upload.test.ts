import { describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { api } from "@/convex/_generated/api";
import { publishHtml, uploadFile } from "./upload";
import type { AppError } from "./errors";

/** Minimal stand-in for the Convex client: records calls, returns canned values. */
function fakeConvex(pasteResult = { pasteId: "p1", token: "abc" }) {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    mutation: vi.fn(async (fn: never, args: unknown) => {
      const name = getFunctionName(fn);
      calls.push({ name, args });
      return name === getFunctionName(api.storage.generateUploadUrl)
        ? "https://convex.test/api/storage/upload?token=1"
        : pasteResult;
    }),
  };
  return { client: client as never, calls };
}

function fakeFetch(response: Partial<Response> & { json?: () => unknown }) {
  return vi.fn(
    async () => ({ ok: true, status: 200, ...response }) as Response,
  );
}

const html = (body = "<h1>hi</h1>", name = "page.html") =>
  new File([body], name, { type: "text/html" });

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return (error as AppError).code;
  }
  throw new Error("expected a rejection");
}

describe("uploadFile", () => {
  it("POSTs the file to the signed URL and returns the storage id", async () => {
    const { client, calls } = fakeConvex();
    const fetchMock = fakeFetch({ json: async () => ({ storageId: "s1" }) });
    vi.stubGlobal("fetch", fetchMock);

    expect(await uploadFile(client, html())).toBe("s1");
    expect(calls[0].name).toBe(getFunctionName(api.storage.generateUploadUrl));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toContain("/api/storage/upload");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "text/html",
    );
    vi.unstubAllGlobals();
  });

  it("rejects empty and oversized files before uploading anything", async () => {
    const { client } = fakeConvex();
    const fetchMock = fakeFetch({});
    vi.stubGlobal("fetch", fetchMock);

    expect(await codeOf(uploadFile(client, html("")))).toBe("VALIDATION");
    expect(
      await codeOf(uploadFile(client, html("x".repeat(5 * 1024 * 1024 + 1)))),
    ).toBe("PAYLOAD_TOO_LARGE");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("surfaces a failed upload as a structured error", async () => {
    const { client } = fakeConvex();
    vi.stubGlobal("fetch", fakeFetch({ ok: false, status: 507 }));
    expect(await codeOf(uploadFile(client, html()))).toBe("INTERNAL");
    vi.unstubAllGlobals();
  });
});

describe("publishHtml", () => {
  it("creates the paste from the uploaded file", async () => {
    const { client, calls } = fakeConvex();
    vi.stubGlobal(
      "fetch",
      fakeFetch({ json: async () => ({ storageId: "s1" }) }),
    );

    expect(await publishHtml(client, html(), { title: "Demo" })).toEqual({
      pasteId: "p1",
      token: "abc",
    });
    expect(calls[1].name).toBe(getFunctionName(api.pastes.create));
    expect(calls[1].args).toEqual({
      storageId: "s1",
      filename: "page.html",
      contentType: "text/html",
      title: "Demo",
    });
    vi.unstubAllGlobals();
  });
});
