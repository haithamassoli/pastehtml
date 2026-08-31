"use client";

import { useState } from "react";
import {
  Authenticated,
  useConvex,
  useConvexAuth,
  useMutation,
} from "convex/react";
import { Show } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { UrlRow } from "@/components/paste-fields";
import { errorMessage } from "@/lib/errors";
import { publishHtml, type PublishResult } from "@/lib/upload";
import { config } from "@/lib/config";

type Status = "idle" | "publishing" | "done";

export default function Home() {
  const convex = useConvex();
  // Publishing before Convex has settled the Clerk token would create the paste
  // as anonymous, and a signed-in author would silently not own what they just
  // published. It resolves in a moment for a visitor too, so everyone waits.
  const { isLoading: authPending } = useConvexAuth();
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
      setError(errorMessage(cause));
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

  const busy = status === "publishing" || authPending;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-12 px-4 py-6 sm:px-8">
      <Hero />

      <section className="flex flex-col gap-3">
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
          className={`border-ink shadow-comic relative flex cursor-pointer flex-col items-center gap-3 border-3 p-8 text-center transition-colors sm:p-12 ${
            dragging ? "bg-hero-yellow" : "bg-card hover:bg-[#fffbf0]"
          } ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {/* The inner dashed rule reads as "target" without putting a dashed
              edge in front of the hard shadow, which turns to mud. */}
          <span
            aria-hidden
            className={`pointer-events-none absolute inset-2.5 border-2 border-dashed ${
              dragging ? "border-ink" : "border-ink/40"
            }`}
          />
          <span
            aria-hidden
            className="border-ink shadow-comic-sm bg-hero-yellow flex size-16 items-center justify-center rounded-full border-3"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-8"
            >
              <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5" />
              <path d="M7.5 7.5 12 3l4.5 4.5M12 3v13.5" />
            </svg>
          </span>
          <span className="font-display text-3xl tracking-wide sm:text-4xl">
            Drop an HTML file here
          </span>
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

        <div aria-live="polite" className="min-h-6">
          {status === "publishing" && (
            // ponytail: indeterminate — fetch() exposes no upload progress.
            // Swap in XMLHttpRequest.upload.onprogress if a real bar is wanted.
            <div className="border-ink bg-card h-3 overflow-hidden border-2">
              <div className="bg-hero-red h-full w-1/3 animate-pulse" />
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="border-ink shadow-comic-xs bg-hero-red border-2 px-3 py-2 text-sm font-semibold text-white"
            >
              {error}{" "}
              <a href="/422" className="underline underline-offset-4">
                What pastehtml accepts
              </a>
            </p>
          )}
        </div>
      </section>

      <section className="panel p-5 sm:p-7">
        <h2 className="text-3xl sm:text-4xl">Or paste HTML</h2>
        <p className="text-muted-foreground mt-2 max-w-[52ch] text-sm">
          Straight into the box. It gets the same URL a dropped file would.
        </p>
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void publish(new File([text], "index.html", { type: "text/html" }));
          }}
        >
          <label htmlFor="html" className="sr-only">
            Or paste HTML
          </label>
          <textarea
            id="html"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={7}
            spellCheck={false}
            placeholder="<h1>Hello</h1>"
            className="border-ink shadow-comic-xs bg-background focus-visible:outline-hero-blue border-2 p-3 font-mono text-sm outline-none focus-visible:outline-3 focus-visible:-outline-offset-1"
          />
          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              size="lg"
              disabled={busy || text.trim().length === 0}
            >
              Publish
            </Button>
            <span className="text-muted-foreground font-mono text-xs">
              Nothing is stored until you press it.
            </span>
          </div>
        </form>
      </section>

      <ApiExample />
    </main>
  );
}

/**
 * The thesis, stated once: a file goes in, a live page comes out at its own
 * URL. The window on the right is that page — decorative, so the screen reader
 * gets the sentence on the left instead.
 */
function Hero() {
  return (
    <section className="panel bg-card relative overflow-clip p-6 sm:p-10">
      <span
        aria-hidden
        className="bg-halftone pointer-events-none absolute -top-6 -left-6 size-32 text-[#0072ce]/30"
      />
      <div className="grid items-center gap-10 md:grid-cols-[1.08fr_0.92fr]">
        <div>
          <p className="border-ink shadow-comic-xs bg-hero-yellow inline-block -rotate-1 border-2 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.16em] uppercase">
            No sign-up · Live in one second
          </p>
          <h1 className="text-kapow mt-4 max-w-[15ch] text-5xl tracking-wide sm:text-6xl lg:text-7xl">
            Publish HTML, get a URL
          </h1>
          <p className="text-muted-foreground mt-5 max-w-[46ch] text-lg">
            Drop an HTML file and it goes live instantly. No account needed.
          </p>
          {/* Only once Convex holds the token, so this is also the honest signal
              that the next publish will be owned rather than anonymous. */}
          <Authenticated>
            <p className="border-ink shadow-comic-xs bg-hero-blue mt-4 inline-block border-2 px-2.5 py-1 text-sm font-semibold text-white">
              Publishing to your account.
            </p>
          </Authenticated>
        </div>

        <div aria-hidden className="relative mx-auto w-full max-w-sm md:mr-5">
          <svg
            viewBox="0 0 120 120"
            className="absolute -top-8 -right-4 z-2 size-24 rotate-12 drop-shadow-[3px_3px_0_#18120e] sm:-right-8 sm:size-28"
          >
            <polygon
              fill="#e62429"
              stroke="#18120e"
              strokeWidth="3"
              points="60,4 71,26 93,13 91,38 116,37 99,55 120,68 96,74 105,98 81,90 78,115 60,96 42,115 39,90 15,98 24,74 0,68 21,55 4,37 29,38 27,13 49,26"
            />
            <text
              x="60"
              y="64"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="27"
              fill="#ffffff"
              transform="rotate(-8 60 60)"
              className="font-display"
            >
              FREE
            </text>
          </svg>

          <div className="border-ink shadow-comic bg-card rotate-2 overflow-hidden border-3">
            <div className="border-ink bg-background flex items-center gap-2 border-b-3 px-3 py-2">
              <span className="flex gap-1.5">
                <span className="border-ink bg-hero-red size-3 rounded-full border-2" />
                <span className="border-ink bg-hero-yellow size-3 rounded-full border-2" />
                <span className="border-ink bg-hero-blue size-3 rounded-full border-2" />
              </span>
              <span className="min-w-0 truncate font-mono text-[11px] opacity-60">
                {new URL(config.appUrl).host}/p/k3f9x2q7
              </span>
            </div>
            <div className="grid gap-2.5 px-4 pt-4 pb-5">
              <p className="font-display text-2xl tracking-wide">Launch deck</p>
              <span className="bg-ink/15 h-2 w-full" />
              <span className="bg-ink/15 h-2 w-5/6" />
              <span className="bg-ink/15 h-2 w-3/5" />
              <span className="mt-1 flex h-16 items-end gap-2">
                <i className="border-ink bg-hero-yellow h-2/5 flex-1 border-2" />
                <i className="border-ink bg-hero-blue h-2/3 flex-1 border-2" />
                <i className="border-ink bg-paper h-1/2 flex-1 border-2" />
                <i className="border-ink bg-hero-red h-full flex-1 border-2" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * The same publish, from a terminal. One request, no account, no JSON wrapper —
 * which is the whole point of the API, so it belongs on the page that sells it.
 */
function ApiExample() {
  const command = `curl -X POST ${config.appUrl}/api/v1/pastes \\\n     -H 'Content-Type: text/html' --data-binary @index.html`;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-3xl sm:text-4xl">Or from your terminal</h2>
      <div className="border-ink shadow-comic bg-ink border-3">
        <div className="border-ink bg-background flex items-center gap-2 border-b-3 px-3 py-2">
          <span aria-hidden className="flex gap-1.5">
            <span className="border-ink bg-hero-red size-3 rounded-full border-2" />
            <span className="border-ink bg-hero-yellow size-3 rounded-full border-2" />
            <span className="border-ink bg-hero-blue size-3 rounded-full border-2" />
          </span>
          <span className="flex-1 truncate text-center font-mono text-[11px] opacity-60">
            ~/site — zsh
          </span>
          <CopyButton value={command} />
        </div>
        <pre className="text-paper overflow-x-auto p-4 font-mono text-xs leading-relaxed">
          {command}
        </pre>
      </div>
      <p className="text-muted-foreground text-sm">
        Returns the public URL and an update token.{" "}
        <a
          href="https://github.com/haithamassoli/pastehtml/blob/main/docs/api.md"
          className="text-hero-blue font-semibold underline decoration-2 underline-offset-4"
        >
          API reference
        </a>
      </p>
    </section>
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
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-6 sm:px-8">
      <section className="panel relative overflow-clip p-6 sm:p-8">
        <span
          aria-hidden
          className="bg-halftone pointer-events-none absolute -right-6 -bottom-6 size-32 text-[#e62429]/25"
        />
        <p className="border-ink shadow-comic-xs bg-hero-red inline-block -rotate-1 border-2 px-2.5 py-1 font-mono text-[11px] font-semibold tracking-[0.16em] text-white uppercase">
          Live now
        </p>
        <h1 className="text-kapow mt-4 text-5xl tracking-wide sm:text-6xl">
          Published
        </h1>

        <div className="mt-7 flex flex-col gap-5">
          <UrlRow label="Public URL" value={result.publicUrl} />
          <UrlRow label="Raw URL" value={result.rawUrl} />
        </div>

        {result.updateToken && (
          <div className="border-ink shadow-comic bg-hero-yellow mt-7 max-w-3xl -rotate-[0.6deg] border-3 p-5">
            <div className="flex items-center gap-2.5">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6 shrink-0"
              >
                <path d="M12 3.5 22 20.5H2z" />
                <path d="M12 10v4.5M12 17.6v.1" />
              </svg>
              <h2 className="text-2xl">Update token — shown once</h2>
            </div>
            <p className="mt-2.5 max-w-[56ch] text-sm">
              Save this now — it is the only way to update or delete this paste
              without an account. Close the tab and it is gone for good.
            </p>
            <Value value={result.updateToken} />
            <Show when="signed-in">
              <ClaimPaste
                token={result.token}
                updateToken={result.updateToken}
              />
            </Show>
          </div>
        )}
      </section>

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
      <p className="mt-4 text-sm font-semibold">
        Saved to your account. The update token above no longer works.
      </p>
    );

  return (
    <div className="mt-4 flex flex-col gap-2">
      <Button
        variant="default"
        className="self-start"
        disabled={status === "saving"}
        onClick={async () => {
          setStatus("saving");
          setError(null);
          try {
            await claim({ token, updateToken });
            setStatus("saved");
          } catch (cause) {
            setError(errorMessage(cause));
            setStatus("idle");
          }
        }}
      >
        Save to my account
      </Button>
      {error && (
        <p role="alert" className="text-sm font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}

/** The update token: a secret, so it is shown as code and never as a link. */
function Value({ value }: { value: string }) {
  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
      <code className="border-ink bg-ink text-paper flex min-w-0 flex-1 items-center overflow-x-auto border-2 px-3 py-2 font-mono text-sm whitespace-nowrap">
        {value}
      </code>
      <CopyButton value={value} />
    </div>
  );
}
