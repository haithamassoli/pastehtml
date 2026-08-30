// How the dashboard arranges a user's pastes: search, folder filter, sort.
// `pastes.listByOwner` already bounds the list, so doing this in the browser is
// instant and costs no extra round trip.
// ponytail: swap for a Convex search index and a paginated query if a single
// account ever outgrows that bound.

export type ListedPaste = {
  token: string;
  filename: string;
  title?: string;
  folderId?: string;
  viewsCount: number;
  createdAt: number;
  updatedAt: number;
};

export const SORT_KEYS = ["newest", "updated", "views", "name"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const SORT_LABELS: Record<SortKey, string> = {
  newest: "Newest first",
  updated: "Recently updated",
  views: "Most viewed",
  name: "Name",
};

/** What a paste is called: its title if it has one, otherwise the filename. */
export function displayName(paste: ListedPaste): string {
  return paste.title?.trim() || paste.filename;
}

/** Stable, locale-independent, and identical on the server and the client. */
export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

const compare: Record<SortKey, (a: ListedPaste, b: ListedPaste) => number> = {
  newest: (a, b) => b.createdAt - a.createdAt,
  updated: (a, b) => b.updatedAt - a.updatedAt,
  views: (a, b) => b.viewsCount - a.viewsCount,
  name: (a, b) => displayName(a).localeCompare(displayName(b)),
};

export type ArrangeOptions = {
  query?: string;
  /** `undefined` keeps every paste, `null` only unfiled ones, else that folder. */
  folderId?: string | null;
  sort?: SortKey;
};

export function arrangePastes<T extends ListedPaste>(
  pastes: readonly T[],
  { query, folderId, sort = "newest" }: ArrangeOptions = {},
): T[] {
  const needle = query?.trim().toLowerCase() ?? "";
  return pastes
    .filter((paste) => {
      if (folderId !== undefined && (paste.folderId ?? null) !== folderId)
        return false;
      if (!needle) return true;
      return [displayName(paste), paste.filename, paste.token].some((field) =>
        field.toLowerCase().includes(needle),
      );
    })
    .sort(compare[sort]);
}
