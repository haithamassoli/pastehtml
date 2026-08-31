"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Authenticated,
  AuthLoading,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { CopyButton } from "@/components/copy-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/paste-fields";
import { errorMessage } from "@/lib/errors";
import {
  arrangePastes,
  displayName,
  isoDate,
  SORT_KEYS,
  SORT_LABELS,
  type SortKey,
} from "@/lib/paste-list";
import { pasteUrls } from "@/lib/urls";

// Every query below needs an identity, and Convex only has one once Clerk has
// handed over a token. Gating on `Authenticated` is what keeps the first render
// from firing an unauthenticated query the backend would reject.
export default function DashboardPage() {
  return (
    <>
      <AuthLoading>
        <Skeleton rows={3} className="h-20" />
      </AuthLoading>
      <Authenticated>
        <PasteList />
      </Authenticated>
    </>
  );
}

const FIELD_CLASS =
  "border-ink shadow-comic-xs bg-background focus-visible:outline-hero-blue h-9 border-2 px-2.5 text-sm outline-none focus-visible:outline-3 focus-visible:-outline-offset-1";

function PasteList() {
  // Live subscriptions: a publish, an edit, a view or a delete from anywhere
  // repaints this list without a refresh.
  const pastes = useQuery(api.pastes.listByOwner, {});
  const folders = useQuery(api.folders.list, {});
  const remove = useMutation(api.pastes.remove);

  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [error, setError] = useState<string | null>(null);

  if (pastes === undefined) return <Skeleton rows={3} className="h-20" />;
  if (pastes.length === 0) return <Empty />;

  const folderId =
    folder === "all" ? undefined : folder === "none" ? null : folder;
  const visible = arrangePastes(pastes, { query, folderId, sort });

  async function onDelete(token: string, name: string) {
    // ponytail: the platform's own confirm() is the explicit confirmation.
    // Swap in a Base UI AlertDialog if the copy ever needs to be richer.
    if (!confirm(`Delete "${name}"? Its public URL stops working immediately.`))
      return;
    setError(null);
    try {
      await remove({ token });
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search pastes"
          aria-label="Search pastes"
          className={`${FIELD_CLASS} flex-1`}
        />
        {/* Stays out of the way until the account actually has a folder. */}
        {folders && folders.length > 0 && (
          <select
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            aria-label="Filter by folder"
            className={FIELD_CLASS}
          >
            <option value="all">All folders</option>
            <option value="none">No folder</option>
            {folders.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortKey)}
          aria-label="Sort pastes"
          className={FIELD_CLASS}
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {SORT_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p
          role="alert"
          className="border-ink shadow-comic-xs bg-hero-red border-2 px-3 py-2 text-sm font-semibold text-white"
        >
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No pastes match those filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {visible.map((paste) => {
            const name = displayName(paste);
            const { publicUrl } = pasteUrls(paste.token);
            return (
              <li
                key={paste.token}
                className="border-ink shadow-comic-sm bg-card flex flex-col gap-3 border-3 border-l-8 p-4 sm:flex-row sm:items-center sm:justify-between [&:nth-child(4n+1)]:border-l-[var(--hero-red)] [&:nth-child(4n+2)]:border-l-[var(--hero-blue)] [&:nth-child(4n+3)]:border-l-[var(--hero-yellow)]"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={`/dashboard/pastes/${paste.token}`}
                    className="font-display truncate text-2xl tracking-wide underline-offset-4 hover:underline"
                  >
                    {name}
                  </Link>
                  <a
                    href={publicUrl}
                    className="text-hero-blue truncate font-mono text-xs font-medium underline-offset-4 hover:underline"
                  >
                    {publicUrl}
                  </a>
                  <p className="text-muted-foreground font-mono text-[11px] tracking-[0.05em] uppercase">
                    {paste.viewsCount} views · created{" "}
                    {isoDate(paste.createdAt)} · updated{" "}
                    {isoDate(paste.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CopyButton value={publicUrl} label="Copy URL" />
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void onDelete(paste.token, name)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="border-ink shadow-comic bg-card flex flex-col items-start gap-3 border-3 border-dashed p-8">
      <p className="font-display text-3xl tracking-wide">No pastes yet</p>
      <p className="text-muted-foreground text-sm">
        Publish some HTML and it shows up here the moment it exists.
      </p>
      <Link href="/" className={buttonVariants()}>
        Publish HTML
      </Link>
    </div>
  );
}
