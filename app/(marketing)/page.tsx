"use client";

import { useState } from "react";
import { useConvex, useMutation } from "convex/react";
import { Show } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/errors";
import { publishHtml, type PublishResult } from "@/lib/upload";
import { config } from "@/lib/config";

type Status = "idle" | "publishing" | "done";

export default function Home() {
  const convex = useConvex();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);

  async function publish(file: File) {
    setStatus("publishing");
    setError(null);
    try {
      setResult(await publishHtml(convex, file));
      setStatus("done");
    } catch (cause) {
      setError(messageOf(cause));
      setStatus("idle");
    }
  }

  function publishAnother() {
    setResult(null);
    setText("");
    setError(null);
    setStatus("idle");
  }

  if (status === "done" && result)
    return <Published result={result} onPublishAnother={publishAnother} />;

  const busy = status === "publishing";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Publish HTML, get a URL
        </h1>
        <p className="text-muted-foreground">
          Drop an HTML file and it goes live instantly. No account needed.
        </p>
      </div>

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file) void publish(file);
        }}
        className={`focus-within:border-ring flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          dragging ? "border-ring bg-muted" : "border-border hover:bg-muted/50"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <span className="font-medium">Drop an HTML file here</span>
        <span className="text-muted-foreground text-sm">
          or click to choose one — up to{" "}
          {Math.round(config.maxUploadBytes / 1024 / 1024)} MB
        </span>
        <input
          type="file"
          accept=".html,.htm,text/html"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void publish(file);
          }}
        />
      </label>

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void publish(new File([text], "index.html", { type: "text/html" }));
        }}
      >
        <label htmlFor="html" className="text-sm font-medium">
          Or paste HTML
        </label>
        <textarea
          id="html"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={6}
          spellCheck={false}
          placeholder="<h1>Hello</h1>"
          className="border-border focus-visible:border-ring focus-visible:ring-ring/50 rounded-lg border p-3 font-mono text-sm outline-none focus-visible:ring-3"
        />
        <Button
          type="submit"
          size="lg"
          className="self-start"
          disabled={busy || text.trim().length === 0}
        >
          Publish
        </Button>
      </form>

      <div aria-live="polite" className="min-h-6">
        {busy && (
          // ponytail: indeterminate — fetch() exposes no upload progress.
          // Swap in XMLHttpRequest.upload.onprogress if a real bar is wanted.
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div className="bg-primary h-full w-1/3 animate-pulse rounded-full" />
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}

function Published({
  result,
  onPublishAnother,
}: {
  result: PublishResult;
  onPublishAnother: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Published</h1>

      <UrlRow label="Public URL" value={result.publicUrl} />
      <UrlRow label="Raw URL" value={result.rawUrl} />

      {result.updateToken && (
        <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-sm font-medium">Update token</p>
          <p className="text-muted-foreground text-sm">
            Save this now — it is shown once and is the only way to update or
            delete this paste without an account.
          </p>
          <Value value={result.updateToken} />
          <Show when="signed-in">
            <ClaimPaste token={result.token} updateToken={result.updateToken} />
          </Show>
        </div>
      )}

      <Button size="lg" className="self-start" onClick={onPublishAnother}>
        Publish another
      </Button>
    </main>
  );
}

/**
 * Anonymous publish, then sign in: the update token is still in this page's
 * state, so the paste can be moved into the account that is now signed in.
 * Claiming retires the token, which is why this disappears once it succeeds.
 */
function ClaimPaste({
  token,
  updateToken,
}: {
  token: string;
  updateToken: string;
}) {
  const claim = useMutation(api.pastes.claim);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  if (status === "saved")
    return (
      <p className="text-muted-foreground text-sm">
        Saved to your account. The update token above no longer works.
      </p>
    );

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={status === "saving"}
        onClick={async () => {
          setStatus("saving");
          setError(null);
          try {
            await claim({ token, updateToken });
            setStatus("saved");
          } catch (cause) {
            setError(messageOf(cause));
            setStatus("idle");
          }
        }}
      >
        Save to my account
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <Value value={value} href={value} />
    </div>
  );
}

function Value({ value, href }: { value: string; href?: string }) {
  return (
    <div className="border-border flex items-center gap-2 rounded-lg border p-2">
      {href ? (
        <a
          href={href}
          className="flex-1 truncate font-mono text-sm underline-offset-4 hover:underline"
        >
          {value}
        </a>
      ) : (
        <code className="flex-1 truncate font-mono text-sm">{value}</code>
      )}
      <CopyButton value={value} />
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/** Structured errors carry a user-facing message; anything else is a surprise. */
function messageOf(cause: unknown): string {
  if (cause instanceof AppError) return cause.message;
  const data = (cause as { data?: { message?: string } }).data;
  return data?.message ?? "Something went wrong. Please try again.";
}
