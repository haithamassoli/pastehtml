// The pieces every paste surface repeats: a labelled URL you can copy, a
// labelled fact in a definition list, and the loading block that stands in for
// a list while Convex is still answering.
import { CopyButton } from "@/components/copy-button";

/** A paste URL with its copy button. Cross-origin, so a plain anchor. */
export function UrlRow({ label, value }: { label: string; value: string }) {
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

/** One `<dt>/<dd>` pair. Belongs inside a `<dl>`. */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs tracking-wide uppercase">{label}</dt>
      <dd className="text-foreground truncate font-medium">{value}</dd>
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
          className={`bg-muted animate-pulse rounded-lg ${className}`}
        />
      ))}
    </div>
  );
}

/** A stored size, rounded up so a one-byte paste never reads "0 KB". */
export const sizeLabel = (bytes: number) => `${Math.ceil(bytes / 1024)} KB`;
