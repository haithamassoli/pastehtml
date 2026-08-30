"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Authenticated,
  AuthLoading,
  useConvex,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { displayName, isoDate } from "@/lib/paste-list";
import { replaceHtml } from "@/lib/upload";
import { pasteUrls } from "@/lib/urls";

export default function PasteDetailPage({
  params,
}: PageProps<"/dashboard/pastes/[token]">) {
  const { token } = use(params);
  return (
    <>
      <AuthLoading>
        <div
          aria-busy="true"
          className="bg-muted h-64 animate-pulse rounded-lg"
        />
      </AuthLoading>
      <Authenticated>
        <PasteDetail token={token} />
      </Authenticated>
    </>
  );
}

/**
 * `pastes.getOwned` authorizes against the caller's own Convex identity, so a
 * stranger's token rejects here and the dashboard error boundary shows it —
 * this page never has to decide who owns what.
 */
function PasteDetail({ token }: { token: string }) {
  // Skipped once the paste is on its way out, so the subscription cannot
  // re-run against the deleted row and flash "Paste not found" on the way to
  // the list.
  const [gone, setGone] = useState(false);
  const paste = useQuery(api.pastes.getOwned, gone ? "skip" : { token });
  const folders = useQuery(api.folders.list, {});
  const update = useMutation(api.pastes.update);
  const remove = useMutation(api.pastes.remove);
  const convex = useConvex();
  const router = useRouter();

  // `null` means "not editing", so a live update from elsewhere still shows up.
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (paste === undefined)
    return (
      <div
        aria-busy="true"
        className="bg-muted h-64 animate-pulse rounded-lg"
      />
    );

  const urls = pasteUrls(paste.token);

  /** Every mutation on this page reports the same way. `false` means it failed. */
  async function run(work: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (cause) {
      setError(errorMessage(cause));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link
            href="/dashboard"
            className="text-muted-foreground text-sm underline-offset-4 hover:underline"
          >
            ← All pastes
          </Link>
          <h2 className="truncate text-lg font-semibold">
            {displayName(paste)}
          </h2>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={busy}
          onClick={() => {
            // ponytail: the platform's own confirm() is the explicit
            // confirmation. A Base UI AlertDialog if the copy needs more room.
            if (
              !confirm(
                `Delete "${displayName(paste)}"? Its public URL stops working immediately.`,
              )
            )
              return;
            void (async () => {
              setGone(true);
              if (await run(() => remove({ token }))) router.push("/dashboard");
              else setGone(false);
            })();
          }}
        >
          Delete paste
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {/* Analytics summary. Milestone 12 turns the view total into a real
          breakdown; the total itself is already live. */}
      <dl className="text-muted-foreground grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Fact label="Views" value={String(paste.viewsCount)} />
        <Fact label="Filename" value={paste.filename} />
        <Fact
          label="Size"
          value={`${Math.ceil(paste.contentLength / 1024)} KB`}
        />
        <Fact label="Updated" value={isoDate(paste.updatedAt)} />
      </dl>

      <div className="flex flex-col gap-4">
        <UrlRow label="Public URL" value={urls.publicUrl} />
        <UrlRow label="Raw URL" value={urls.rawUrl} />
        <UrlRow label="Preview" value={urls.renderUrl} />
      </div>

      <Section title="Title">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const title = draftTitle ?? "";
            void run(async () => {
              await update({ token, title });
              setDraftTitle(null);
            });
          }}
        >
          <input
            value={draftTitle ?? paste.title ?? ""}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder={paste.filename}
            aria-label="Paste title"
            className="border-border focus-visible:border-ring focus-visible:ring-ring/50 h-8 flex-1 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
          />
          <Button
            type="submit"
            size="sm"
            disabled={busy || draftTitle === null}
          >
            Save title
          </Button>
        </form>
      </Section>

      <Section title="Replace HTML">
        <input
          type="file"
          accept=".html,.htm,text/html"
          disabled={busy}
          aria-label="Replace HTML"
          className="text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void run(() => replaceHtml(convex, file, { token }));
          }}
        />
        <p className="text-muted-foreground text-xs">
          The public URL stays the same. The old file is dropped only once the
          new one is committed.
        </p>
      </Section>

      {folders && folders.length > 0 && (
        <Section title="Folder">
          <select
            value={paste.folderId ?? ""}
            disabled={busy}
            aria-label="Folder"
            className="border-border focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3"
            onChange={(event) => {
              const value = event.target.value;
              void run(() =>
                update({
                  token,
                  folderId: value === "" ? null : (value as Id<"folders">),
                }),
              );
            }}
          >
            <option value="">No folder</option>
            {folders.map((folder) => (
              <option key={folder._id} value={folder._id}>
                {folder.name}
              </option>
            ))}
          </select>
        </Section>
      )}

      {/* Password protection lands with Milestone 9, which owns the hashing,
          the unlock flow and the rate limiting behind it. */}

      <Section title="Preview">
        {/* The render endpoint already serves this under a CSP sandbox; the
            attribute is the same fence stated again at the embed. */}
        <iframe
          src={urls.renderUrl}
          title="Paste preview"
          sandbox="allow-scripts allow-forms"
          className="border-border h-96 w-full rounded-lg border bg-white"
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
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

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="border-border flex items-center gap-2 rounded-lg border p-2">
        <a
          href={value}
          className="flex-1 truncate font-mono text-sm underline-offset-4 hover:underline"
        >
          {value}
        </a>
        <CopyButton value={value} />
      </div>
    </div>
  );
}
