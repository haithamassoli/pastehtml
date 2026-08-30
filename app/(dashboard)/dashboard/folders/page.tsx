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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/paste-fields";
import { errorMessage } from "@/lib/errors";

export default function FoldersPage() {
  return (
    <>
      <AuthLoading>
        <Skeleton />
      </AuthLoading>
      <Authenticated>
        <FolderList />
      </Authenticated>
    </>
  );
}

function FolderList() {
  // Live: a folder created, renamed or deleted anywhere repaints this list.
  const folders = useQuery(api.folders.list, {});
  const create = useMutation(api.folders.create);
  const rename = useMutation(api.folders.rename);
  const remove = useMutation(api.folders.remove);

  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<unknown>) {
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ponytail: an inline form, not a dialog — one field does not need a
          modal, and this way the folder appears in the list below it. */}
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await create({ name });
            setName("");
          });
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New folder name"
          aria-label="New folder name"
          className="border-border focus-visible:border-ring focus-visible:ring-ring/50 h-8 flex-1 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3"
        />
        <Button type="submit" size="sm" disabled={!name.trim()}>
          Create folder
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {folders === undefined ? (
        <Skeleton />
      ) : folders.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No folders yet. Create one above, then file pastes into it from any
          paste&rsquo;s page.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {folders.map((folder) => (
            <li
              key={folder._id}
              className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <Link
                href={`/dashboard/folders/${folder._id}`}
                className="truncate font-medium underline-offset-4 hover:underline"
              >
                {folder.name}
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // ponytail: prompt()/confirm() are the platform's own
                    // dialogs, and match the paste list's delete flow.
                    const next = prompt("Rename folder", folder.name);
                    if (next === null) return;
                    void run(() =>
                      rename({ folderId: folder._id, name: next }),
                    );
                  }}
                >
                  Rename
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (
                      !confirm(
                        `Delete "${folder.name}"? Its pastes are kept and simply leave the folder.`,
                      )
                    )
                      return;
                    void run(() => remove({ folderId: folder._id }));
                  }}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
