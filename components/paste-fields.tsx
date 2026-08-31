// The pieces every paste surface repeats: a labelled URL you can copy, a
// labelled fact in a definition list, and the loading block that stands in for
// a list while Convex is still answering.
import { CopyButton } from "@/components/copy-button";

/** A paste URL with its copy button. Cross-origin, so a plain anchor. */
export function UrlRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex max-w-3xl flex-col gap-1.5">
      <p className="font-display text-lg tracking-wide">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {/* Scrolls inside its own box: a long token URL must never widen the
            page, and truncating one you are about to copy by eye is worse. */}
        <a
          href={value}
          className="border-ink shadow-comic-xs bg-background hover:bg-card flex min-w-0 flex-1 items-center overflow-x-auto border-2 px-3 py-2 font-mono text-sm whitespace-nowrap"
        >
          {value}
        </a>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

/** One `<dt>/<dd>` pair. Belongs inside a `<dl>`. */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink shadow-comic-xs bg-background min-w-0 border-2 px-3 py-2">
      <dt className="font-mono text-[10px] font-semibold tracking-[0.14em] uppercase opacity-60">
        {label}
      </dt>
      <dd className="font-display truncate text-xl tracking-wide">{value}</dd>
    </div>
  );
}

/** Placeholder rows, sized to roughly match what is loading. */
export function Skeleton({ rows = 2, className = "h-16" }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className={`border-ink bg-muted animate-pulse border-2 ${className}`}
        />
      ))}
    </div>
  );
}

/** A stored size, rounded up so a one-byte paste never reads "0 KB". */
export const sizeLabel = (bytes: number) => `${Math.ceil(bytes / 1024)} KB`;
