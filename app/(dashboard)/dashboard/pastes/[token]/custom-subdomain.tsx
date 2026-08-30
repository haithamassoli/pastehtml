"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { pasteUrls } from "@/lib/urls";

/**
 * Assign, change or remove the paste's vanity subdomain. All three are the one
 * `pastes.update` field, so assign and change share a form and removal is a
 * `null`. Owning its own busy/error state keeps the mount in the detail page to
 * a single line.
 *
 * A subdomain is a paste host exactly like a token is, so `pasteUrls` builds
 * its URL unchanged.
 */
export function CustomSubdomain({
  token,
  current,
}: {
  token: string;
  current: string | undefined;
}) {
  const update = useMutation(api.pastes.update);
  const [draft, setDraft] = useState("");
  // The availability subscription follows this rather than `draft`, so it is
  // not re-opened on every keystroke.
  const [settled, setSettled] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(draft.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [draft]);

  // `token` so the paste's own name reads as available rather than taken.
  const check = useQuery(
    api.pastes.checkSubdomain,
    settled === "" ? "skip" : { subdomain: settled, token },
  );

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      setDraft("");
      setSettled("");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Custom subdomain</h3>
      {current ? (
        <div className="border-border flex items-center gap-2 rounded-lg border p-2">
          <a
            href={pasteUrls(current).publicUrl}
            className="flex-1 truncate font-mono text-sm underline-offset-4 hover:underline"
          >
            {pasteUrls(current).publicUrl}
          </a>
          <CopyButton value={pasteUrls(current).publicUrl} />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">
          Serve this paste from a name of your own. The generated URL keeps
          working either way.
        </p>
      )}

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void run(() => update({ token, customSubdomain: draft }));
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={current ?? "my-demo"}
          aria-label="Custom subdomain"
          autoCapitalize="none"
          spellCheck={false}
          className="border-border focus-visible:border-ring focus-visible:ring-ring/50 h-8 flex-1 rounded-lg border px-2.5 font-mono text-sm outline-none focus-visible:ring-3"
        />
        <Button
          type="submit"
          size="sm"
          // The indicator can be stale, so this only saves an obviously
          // doomed round trip; Convex is what actually refuses the name.
          disabled={busy || draft.trim() === "" || check?.available === false}
        >
          {current ? "Change subdomain" : "Assign subdomain"}
        </Button>
        {current && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => {
              // ponytail: platform confirm(), as with the other paths here.
              if (
                !confirm(
                  `Remove ${current}? That URL stops working immediately.`,
                )
              )
                return;
              void run(() => update({ token, customSubdomain: null }));
            }}
          >
            Remove
          </Button>
        )}
      </form>

      {check && (
        <p
          role="status"
          className={`text-xs ${check.available ? "text-muted-foreground" : "text-destructive"}`}
        >
          {check.available
            ? `${pasteUrls(settled).publicUrl} is available.`
            : check.reason}
        </p>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
