// A representative slice of a legacy Rails export, in the normalized migration
// format documented in `docs/migration.md`. (`legacy/` next door is Milestone
// 18's compatibility corpus — raw HTML files, a different job.) This is the worked example of that
// format as well as the test fixture: serialize one of these objects per line
// and you have the JSONL the export script is required to produce.
//
// The one difference from the wire format is `html`. On disk that field is
// `contentBase64` — base64 of the raw stored bytes — because a legacy paste is
// not guaranteed to be valid UTF-8 and base64 is what preserves the bytes a
// hash comparison later depends on. Here it is a plain string so the fixtures
// stay readable; the test encodes it to UTF-8 before uploading, which is the
// same bytes the driver would have decoded.

export type LegacyFolder = {
  legacyId: string;
  legacyOwnerId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
};

export type LegacyPaste = {
  legacyId: string;
  token: string;
  legacyOwnerId?: string;
  legacyFolderId?: string;
  filename: string;
  title?: string;
  description?: string;
  customSubdomain?: string;
  contentType: string;
  html: string;
  visibility: "public" | "protected";
  password?: string;
  updateToken?: string;
  viewsCount: number;
  createdAt: number;
  updatedAt: number;
};

/** Legacy `users.id` to Clerk `tokenIdentifier`, the operator-supplied mapping. */
export const legacyOwners: Record<string, string> = {
  "42": "https://clerk.test|user_alice",
  // "99" is deliberately absent: a legacy user nobody could match to a Clerk
  // identity, so their paste has to land somewhere. See `orphaned` below.
};

export const legacyFolders: LegacyFolder[] = [
  {
    legacyId: "10",
    legacyOwnerId: "42",
    name: "Demos",
    createdAt: Date.UTC(2019, 4, 1),
    updatedAt: Date.UTC(2021, 8, 12),
  },
];

export const legacyPastes: LegacyPaste[] = [
  {
    legacyId: "1001",
    token: "aaaa11112222",
    legacyOwnerId: "42",
    filename: "index.html",
    title: "Landing page",
    description: "The first thing anyone published here.",
    customSubdomain: "first-demo",
    contentType: "text/html",
    html: "<!doctype html><html><body><h1>hello</h1></body></html>",
    visibility: "public",
    viewsCount: 1204,
    createdAt: Date.UTC(2018, 0, 15, 9, 30),
    updatedAt: Date.UTC(2020, 6, 2, 11, 0),
  },
  {
    legacyId: "1002",
    token: "bbbb11112222",
    legacyOwnerId: "42",
    legacyFolderId: "10",
    filename: "chart.html",
    contentType: "text/html",
    html: "<!doctype html><p>filed away</p>",
    visibility: "public",
    viewsCount: 3,
    createdAt: Date.UTC(2019, 4, 2),
    updatedAt: Date.UTC(2019, 4, 2),
  },
  {
    legacyId: "1003",
    token: "cccc11112222",
    filename: "scratch.html",
    contentType: "text/html",
    html: "<h1>nobody owns me</h1>",
    // The legacy edit code, recoverable from the old store. Hashing it on the
    // way in is what keeps an anonymous author able to edit after cutover.
    updateToken: "legacyedittoken0000000000000000x",
    visibility: "public",
    viewsCount: 0,
    createdAt: Date.UTC(2020, 1, 3),
    updatedAt: Date.UTC(2020, 1, 3),
  },
  {
    legacyId: "1004",
    token: "dddd11112222",
    legacyOwnerId: "42",
    filename: "secret.html",
    contentType: "text/html",
    html: "<p>bcrypt held the door</p>",
    // Protected, with no `password`: the legacy digest was bcrypt and cannot
    // come across. Imports closed, owner has to set a new one.
    visibility: "protected",
    viewsCount: 8,
    createdAt: Date.UTC(2021, 2, 4),
    updatedAt: Date.UTC(2021, 2, 4),
  },
  {
    legacyId: "1005",
    token: "eeee11112222",
    legacyOwnerId: "42",
    filename: "recoverable.html",
    contentType: "text/html",
    html: "<p>the old app kept this one in plaintext</p>",
    visibility: "protected",
    password: "hunter2!",
    viewsCount: 0,
    createdAt: Date.UTC(2021, 2, 5),
    updatedAt: Date.UTC(2021, 2, 5),
  },
  {
    legacyId: "1006",
    token: "ffff11112222",
    legacyOwnerId: "42",
    filename: "unicode.html",
    title: "مرحبا 🌍",
    contentType: "text/html; charset=utf-8",
    html: '<!doctype html><html lang="ar" dir="rtl"><body><p>مرحبا بالعالم 🌍 — こんにちは — Ω≈ç√∫˜µ</p></body></html>',
    visibility: "public",
    viewsCount: 17,
    createdAt: Date.UTC(2021, 5, 6),
    updatedAt: Date.UTC(2021, 5, 6),
  },
  {
    legacyId: "1007",
    token: "gggg11112222",
    legacyOwnerId: "42",
    filename: "styled.html",
    contentType: "text/html",
    html: "<!doctype html><style>body{background:#111;color:#eee}</style><div id=x></div><script>document.getElementById('x').textContent = 1 < 2 ? 'yes' : 'no';</script>",
    visibility: "public",
    viewsCount: 44,
    createdAt: Date.UTC(2021, 7, 7),
    updatedAt: Date.UTC(2021, 7, 7),
  },
  {
    legacyId: "1008",
    token: "hhhh11112222",
    filename: "broken.html",
    contentType: "text/html",
    // Unclosed tags, a stray ampersand and no doctype: every browser renders
    // it, and nothing in this pipeline is allowed to tidy it up.
    html: "<html><body><p>unclosed<div>nested wrong</p><span>a & b<table><tr><td>x",
    visibility: "public",
    viewsCount: 2,
    createdAt: Date.UTC(2017, 10, 8),
    updatedAt: Date.UTC(2017, 10, 8),
  },
  {
    legacyId: "1009",
    token: "iiii11112222",
    legacyOwnerId: "99",
    filename: "orphan.html",
    contentType: "text/html",
    html: "<p>my owner never made it to Clerk</p>",
    visibility: "public",
    viewsCount: 1,
    createdAt: Date.UTC(2022, 3, 9),
    updatedAt: Date.UTC(2022, 3, 9),
  },
];

/**
 * Records that are expected to fail, one per reason. Kept apart from the set
 * above so a test can assert "everything else imported" without exceptions.
 */
export const legacyFailures: LegacyPaste[] = [
  {
    // `admin` is reserved by the new app, so this subdomain cannot be honoured.
    legacyId: "2001",
    token: "jjjj11112222",
    legacyOwnerId: "42",
    filename: "admin.html",
    customSubdomain: "admin",
    contentType: "text/html",
    html: "<p>squatting on a reserved name</p>",
    visibility: "public",
    viewsCount: 0,
    createdAt: Date.UTC(2022, 0, 1),
    updatedAt: Date.UTC(2022, 0, 1),
  },
  {
    // Mixed-case legacy token: the wildcard host lowercases before lookup, so
    // this URL cannot be preserved as-is and the record has to be decided on.
    legacyId: "2002",
    token: "MixedCase12",
    filename: "mixed.html",
    contentType: "text/html",
    html: "<p>unreachable at its own URL</p>",
    visibility: "public",
    viewsCount: 0,
    createdAt: Date.UTC(2022, 0, 2),
    updatedAt: Date.UTC(2022, 0, 2),
  },
  {
    // Timestamps in seconds, the export bug this pipeline refuses to file away.
    legacyId: "2003",
    token: "kkkk11112222",
    filename: "seconds.html",
    contentType: "text/html",
    html: "<p>1970 called</p>",
    visibility: "public",
    viewsCount: 0,
    createdAt: 1640995200,
    updatedAt: 1640995200,
  },
];
