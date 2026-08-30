// The public metadata page for a paste: what it is, and every URL it has.
// Paste content is never rendered here — the app origin only ever links to it.
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { api } from "@/convex/_generated/api";
import { convex } from "@/lib/paste-http";
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {paste.title || paste.filename}
        </h1>
        {paste.description && (
          <p className="text-muted-foreground">{paste.description}</p>
        )}
      </div>

      <dl className="text-muted-foreground grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Fact label="Filename" value={paste.filename} />
        <Fact
          label="Size"
          value={`${Math.ceil(paste.contentLength / 1024)} KB`}
        />
        <Fact label="Views" value={String(paste.viewsCount)} />
        <Fact
          label="Published"
          value={new Date(paste.createdAt).toISOString().slice(0, 10)}
        />
      </dl>

      <div className="flex flex-col gap-4">
        <UrlRow label="Public URL" href={urls.publicUrl} />
        <UrlRow label="Raw URL" href={urls.rawUrl} />
        <UrlRow label="Preview" href={urls.renderUrl} />
      </div>

      <OwnerControls token={paste.token} />
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-foreground truncate font-medium">{value}</dd>
    </div>
  );
}

function UrlRow({ label, href }: { label: string; href: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="border-border rounded-lg border p-2">
        <Link
          href={href}
          className="block truncate font-mono text-sm underline-offset-4 hover:underline"
        >
          {href}
        </Link>
      </div>
    </div>
  );
}
