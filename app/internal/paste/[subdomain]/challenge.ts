// The unlock challenge page, served on the paste's own origin.
//
// ponytail: a string, not a React page. This route already returns raw bytes
// for every other response, and the page has no user-controlled content and no
// interactivity beyond a form POST — a component tree and a renderer would buy
// nothing. `error` is one of two fixed strings chosen by the route, but it is
// escaped anyway so that stays true if the set ever grows.
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );

export function challengePage(error?: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Password required</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center;
    font: 16px/1.5 system-ui, sans-serif; background: Canvas; color: CanvasText; }
  form { display: grid; gap: 12px; width: min(360px, 90vw); padding: 24px;
    border: 1px solid color-mix(in srgb, CanvasText 20%, transparent); border-radius: 12px; }
  h1 { margin: 0; font-size: 1.125rem; }
  p { margin: 0; font-size: .875rem; color: color-mix(in srgb, CanvasText 65%, transparent); }
  p.error { color: #b91c1c; }
  input, button { font: inherit; padding: 8px 10px; border-radius: 8px;
    border: 1px solid color-mix(in srgb, CanvasText 25%, transparent); }
  input { background: Field; color: FieldText; }
  button { background: CanvasText; color: Canvas; border-color: transparent; cursor: pointer; }
</style>
</head>
<body>
<form method="post" action="/">
  <h1>This paste is password protected</h1>
  ${error ? `<p class="error" role="alert">${escape(error)}</p>` : ""}
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
  <button type="submit">Unlock</button>
  <p>Unlocking applies to this paste only.</p>
</form>
</body>
</html>
`;
}
