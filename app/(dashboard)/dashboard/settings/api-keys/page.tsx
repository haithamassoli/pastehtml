"use client";

import { useState } from "react";
import {
  Authenticated,
  AuthLoading,
  useMutation,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { SCOPES, type Scope } from "@/convex/schema";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/paste-fields";
import { CopyButton } from "@/components/copy-button";
import { errorMessage } from "@/lib/errors";

const inputClass =
  "border-border focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3";

const date = (value: number) => new Date(value).toLocaleDateString();

/** ponytail: the clock lives here rather than in the component body, where the
    purity rule rightly objects to it. A key that expires between two repaints
    still stops working server-side; only its label is a moment late. */
const isExpired = (expiresAt?: number) =>
  expiresAt !== undefined && expiresAt <= Date.now();

export default function ApiKeysPage() {
  return (
    <>
      <AuthLoading>
        <Skeleton />
      </AuthLoading>
      <Authenticated>
        <ApiKeyList />
      </Authenticated>
    </>
  );
}

function ApiKeyList() {
  // Live: creating or revoking a key repaints the list under the form.
  const keys = useQuery(api.apiKeys.list, {});
  const create = useMutation(api.apiKeys.create);
  const revoke = useMutation(api.apiKeys.revoke);

  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Scope[]>([
    "pastes:read",
    "pastes:write",
  ]);
  const [expiresOn, setExpiresOn] = useState("");
  const [secret, setSecret] = useState<string | null>(null);
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
      {/* ponytail: an inline form rather than a dialog, like the folders page.
          The one thing that truly needs attention — the raw secret — appears
          right below it, where a modal would have had to hand it over on the
          way out. */}
      <form
        className="border-border flex flex-col gap-3 rounded-lg border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            const created = await create({
              name,
              scopes,
              // Valid through the end of the chosen day, in the browser's own
              // timezone — which is the one the person picking it is thinking in.
              expiresAt: expiresOn
                ? new Date(`${expiresOn}T23:59:59`).getTime()
                : undefined,
            });
            setSecret(created.key);
            setName("");
            setExpiresOn("");
          });
        }}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Key name (e.g. deploy script)"
            aria-label="Key name"
            className={`${inputClass} flex-1`}
          />
          <input
            type="date"
            value={expiresOn}
            onChange={(event) => setExpiresOn(event.target.value)}
            aria-label="Expiry date (optional)"
            className={inputClass}
          />
        </div>

        <fieldset className="flex flex-wrap gap-x-4 gap-y-2">
          <legend className="text-muted-foreground mb-2 text-sm">
            Scopes — a key can do nothing outside these.
          </legend>
          {SCOPES.map((scope) => (
            <label key={scope} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={(event) =>
                  setScopes((current) =>
                    event.target.checked
                      ? [...current, scope]
                      : current.filter((value) => value !== scope),
                  )
                }
              />
              <code>{scope}</code>
            </label>
          ))}
        </fieldset>

        <Button
          type="submit"
          size="sm"
          className="self-start"
          disabled={!name.trim() || scopes.length === 0}
        >
          Create key
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {secret && (
        <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">
            Copy this key now — it is never shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="bg-muted flex-1 overflow-x-auto rounded-lg p-2 text-xs">
              {secret}
            </code>
            <CopyButton value={secret} label="Copy key" />
            <Button variant="ghost" size="sm" onClick={() => setSecret(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {keys === undefined ? (
        <Skeleton />
      ) : keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No API keys yet. Create one above to publish from a script — see the
          API docs for the requests it can make.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {keys.map((key) => {
            const expired = isExpired(key.expiresAt);
            const dead = key.revokedAt !== undefined || expired;
            return (
              <li
                key={key._id}
                className="border-border flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className={dead ? "opacity-60" : undefined}>
                  <p className="font-medium">
                    {key.name} <code className="text-xs">{key.keyPrefix}…</code>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {key.scopes.join(", ")}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Created {date(key.createdAt)} ·{" "}
                    {key.lastUsedAt
                      ? `last used ${date(key.lastUsedAt)}`
                      : "never used"}{" "}
                    ·{" "}
                    {key.revokedAt !== undefined
                      ? `revoked ${date(key.revokedAt)}`
                      : key.expiresAt === undefined
                        ? "no expiry"
                        : `${expired ? "expired" : "expires"} ${date(key.expiresAt)}`}
                  </p>
                </div>
                {key.revokedAt === undefined && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      if (
                        !confirm(
                          `Revoke "${key.name}"? Anything still using it stops working immediately.`,
                        )
                      )
                        return;
                      void run(() => revoke({ keyId: key._id }));
                    }}
                  >
                    Revoke
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
