"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const BROWSER_LABELS: Record<string, string> = {
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  edge: "Edge",
  other: "Other",
};

/**
 * The paste's analytics, live. `analytics.forPaste` authorizes against the
 * caller's own identity, so a stranger's token rejects there and the dashboard
 * error boundary shows it — nothing here decides who may read what.
 */
export function PasteAnalytics({ token }: { token: string }) {
  const stats = useQuery(api.analytics.forPaste, { token });

  if (stats === undefined)
    return (
      <div
        aria-busy="true"
        className="border-ink bg-muted h-48 animate-pulse border-2"
      />
    );

  // A flat run of zeroes still needs a divisor.
  const peak = Math.max(1, ...stats.byDay.map((day) => day.views));

  return (
    <section className="flex flex-col gap-6">
      <dl className="grid grid-cols-3 gap-x-6 gap-y-2">
        <Stat label="Views" value={stats.total} />
        <Stat label="Last 7 days" value={stats.last7d} />
        <Stat label="Last 24 hours" value={stats.last24h} />
      </dl>

      <div className="flex flex-col gap-2">
        <Heading>Last {stats.windowDays} days</Heading>
        {/* ponytail: one CSS bar per day. A chart library for thirty numbers
            would outweigh the rest of this page. */}
        <ol className="flex h-24 items-end gap-px">
          {stats.byDay.map((day) => (
            <li
              key={day.date}
              title={`${day.date}: ${day.views} view${day.views === 1 ? "" : "s"}`}
              style={{ height: `${Math.max(2, (day.views / peak) * 100)}%` }}
              className={`flex-1 rounded-t-sm ${day.views ? "bg-primary" : "bg-muted"}`}
            >
              <span className="sr-only">{`${day.date}: ${day.views}`}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <Breakdown
          title="Referrers"
          rows={stats.referrers}
          empty="Nothing but direct visits so far."
        />
        <Breakdown
          title="Countries"
          rows={stats.countries}
          empty="No country data yet."
        />
        <Breakdown
          title="Browsers"
          rows={stats.browsers.map((row) => ({
            ...row,
            value: BROWSER_LABELS[row.value] ?? row.value,
          }))}
          empty="No browser data yet."
        />
      </div>

      <p className="text-muted-foreground text-xs">
        Counted on the public URL only — the preview below and known bots are
        not views. Referring site, approximate country and browser are kept for{" "}
        {stats.retentionDays} days; the total is kept for good.
        {stats.truncated && " The breakdown covers the most recent views only."}
      </p>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">
        {label}
      </dt>
      <dd className="font-display text-3xl tracking-wide tabular-nums">
        {value}
      </dd>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-muted-foreground text-xs tracking-wide uppercase">
      {children}
    </h4>
  );
}

function Breakdown({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: readonly { value: string; views: number }[];
  empty: string;
}) {
  const peak = rows[0]?.views ?? 1;
  return (
    <div className="flex flex-col gap-2">
      <Heading>{title}</Heading>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-xs">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li key={row.value} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate" title={row.value}>
                {row.value}
              </span>
              <span
                aria-hidden
                className="bg-muted hidden h-1.5 w-16 rounded-full sm:block"
              >
                <span
                  className="bg-primary block h-1.5 rounded-full"
                  style={{ width: `${(row.views / peak) * 100}%` }}
                />
              </span>
              <span className="text-muted-foreground tabular-nums">
                {row.views}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
