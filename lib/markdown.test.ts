import { describe, expect, it } from "vitest";
import { asHtmlFile, isMarkdown } from "./markdown";

const file = (name: string, type: string, body = "# Hi") =>
  new File([body], name, { type });

describe("isMarkdown", () => {
  it("matches on extension or declared type, and nothing else", () => {
    expect(isMarkdown(file("notes.md", ""))).toBe(true);
    expect(isMarkdown(file("notes.MARKDOWN", ""))).toBe(true);
    // The REST API sends a type and no filename.
    expect(isMarkdown(file("index.html", "text/markdown; charset=utf-8"))).toBe(
      true,
    );
    expect(isMarkdown(file("page.html", "text/html"))).toBe(false);
    // A name that merely contains ".md" is not a Markdown file.
    expect(isMarkdown(file("a.md.html", "text/html"))).toBe(false);
  });
});

describe("asHtmlFile", () => {
  it("passes HTML through untouched", async () => {
    const html = file("page.html", "text/html", "<h1>hi</h1>");
    expect(await asHtmlFile(html)).toBe(html);
  });

  it("renders Markdown to a stored HTML document", async () => {
    const out = await asHtmlFile(
      file(
        "notes.md",
        "text/markdown",
        "# Release plan\n\n- one\n- two\n\n| a | b |\n| - | - |\n| 1 | 2 |\n",
      ),
    );

    expect(out.name).toBe("notes.html");
    expect(out.type).toBe("text/html");

    const text = await out.text();
    expect(text.startsWith("<!DOCTYPE html>")).toBe(true);
    // The H1 names the document, so /p/<token> and the OG card have a title.
    expect(text).toContain("<title>Release plan</title>");
    expect(text).toContain("<li>one</li>");
    // GFM: tables are the reason `gfm` is on.
    expect(text).toContain("<table>");
  });

  it("strips markup from the title and escapes what is left", async () => {
    const out = await asHtmlFile(
      file("x.md", "text/markdown", '# <script>a</script>Tom & "Jerry"'),
    );
    const text = await out.text();
    expect(text).toContain("<title>aTom &amp; &quot;Jerry&quot;</title>");
    expect(text).not.toContain("<title><script>");
  });

  it("falls back to the filename when there is no heading", async () => {
    const out = await asHtmlFile(
      file("plan.md", "text/markdown", "just prose"),
    );
    expect(await out.text()).toContain("<title>plan</title>");
  });
});
