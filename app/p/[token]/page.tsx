// The public metadata page for a paste: what it is, and every URL it has.
// Paste content is never rendered here — the app origin only ever links to it.
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "@/convex/_generated/api";
import { Fact, UrlRow, sizeLabel } from "@/components/paste-fields";
import { convex } from "@/lib/paste-http";
import { isoDate } from "@/lib/paste-list";
import { pasteUrls } from "@/lib/urls";
import { OwnerControls } from "./owner-controls";

// Rendered per request, so Next answers it `private, no-cache, no-store`. It
// already was — every route in this app is dynamic because `ClerkProvider` in
// the root layout reads the request — but inheriting that would be inheriting
// it from somebody else's implementation detail. A page Next decides it may
// prerender is cached for a year (`s-maxage=31536000`), which for paste
// metadata means a deleted paste still described long after it is gone.
export const dynamic = "force-dynamic";

const fetchPaste = async (token: string) =>
  await convex.query(api.pastes.getByToken, { token });

export async function generateMetadata({
  params,
}: PageProps<"/p/[token]">): Promise<Metadata> {
  const { token } = await params;
  const paste = await fetchPaste(token);
  return { title: paste ? paste.title || paste.filename : "Paste not found" };
}

export default async function PastePage({ params }: PageProps<"/p/[token]">) {
  const { token } = await params;
  const paste = await fetchPaste(token);
  if (!paste) notFound();

  const urls = pasteUrls(paste.token);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-6 sm:px-8">
      <section className="panel bg-background relative overflow-clip p-6 sm:p-8">
        <span
          aria-hidden
          className="bg-halftone pointer-events-none absolute -right-6 -bottom-6 size-32 text-[#0072ce]/25"
        />
        <h1 className="text-4xl tracking-wide sm:text-5xl">
          {paste.title || paste.filename}
        </h1>
        {paste.description && (
          <p className="text-muted-foreground mt-3 max-w-[58ch]">
            {paste.description}
          </p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact label="Filename" value={paste.filename} />
          <Fact label="Size" value={sizeLabel(paste.contentLength)} />
          <Fact label="Views" value={String(paste.viewsCount)} />
          <Fact label="Published" value={isoDate(paste.createdAt)} />
        </dl>

        <div className="border-ink/15 mt-7 flex flex-col gap-5 border-t-2 pt-7">
          <UrlRow label="Public URL" value={urls.publicUrl} />
          <UrlRow label="Raw URL" value={urls.rawUrl} />
          <UrlRow label="Preview" value={urls.renderUrl} />
        </div>
      </section>

      <OwnerControls token={paste.token} />
    </main>
  );
}
