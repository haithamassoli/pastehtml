"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  Authenticated,
  AuthLoading,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { Skeleton } from "@/components/paste-fields";
import { displayName, isoDate } from "@/lib/paste-list";
import { pasteUrls } from "@/lib/urls";

export default function FolderDetailPage({
  params,
}: PageProps<"/dashboard/folders/[folderId]">) {
  const { folderId } = use(params);
  return (
    <>
      <AuthLoading>
        <Skeleton rows={1} className="h-40" />
      </AuthLoading>
      <Authenticated>
        <FolderDetail folderId={folderId as Id<"folders">} />
      </Authenticated>
    </>
  );
}

/**
 * Both queries authorize against the caller's own Convex identity, so another
 * account's folder id rejects here and lands on the dashboard error boundary.
 */
function FolderDetail({ folderId }: { folderId: Id<"folders"> }) {
  const folder = useQuery(api.folders.get, { folderId });
  const pastes = useQuery(api.pastes.listByFolder, { folderId });
  const update = useMutation(api.pastes.update);

  const [error, setError] = useState<string | null>(null);

  if (folder === undefined || pastes === undefined)
    return (
      <div
        aria-busy="true"
        className="border-ink bg-muted h-40 animate-pulse border-2"
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col">
        <Link
          href="/dashboard/folders"
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          ← All folders
        </Link>
        <h2 className="truncate text-2xl tracking-wide">{folder.name}</h2>
      </div>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {pastes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          This folder is empty. Move a paste in from its own page.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pastes.map((paste) => {
            const { publicUrl } = pasteUrls(paste.token);
            return (
              <li
                key={paste.token}
                className="border-ink shadow-comic-sm bg-card flex flex-col gap-3 border-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <Link
                    href={`/dashboard/pastes/${paste.token}`}
                    className="truncate font-medium underline-offset-4 hover:underline"
                  >
                    {displayName(paste)}
                  </Link>
                  <a
                    href={publicUrl}
                    className="text-muted-foreground truncate font-mono text-xs underline-offset-4 hover:underline"
                  >
                    {publicUrl}
                  </a>
                  <p className="text-muted-foreground text-xs">
                    {paste.viewsCount} views · updated{" "}
                    {isoDate(paste.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CopyButton value={publicUrl} label="Copy URL" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      void update({ token: paste.token, folderId: null }).catch(
                        (cause) => setError(errorMessage(cause)),
                      );
                    }}
                  >
                    Remove from folder
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
