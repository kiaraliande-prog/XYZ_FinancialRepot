# XYZ Financial Report — Publishable Website

A publishable, self-contained website build of the **XYZ Financial Report
v3.8** app (Agreement Revenue & Disbursement tracker). The original was a React
JSX module that ran inside the claude.ai artifact runtime; this repository is
the same application converted so it runs as a plain static site on any web
host — **GitHub Pages, Netlify, a USB stick, or opened straight off disk** —
with no server, no build step at view time, and no external network requests.

All the original detail is preserved: the auto-seeded register of 20
agreements, invoices (raise / pay / outstanding), the combined Invoice +
Payments Received + Allocations view, per-payment disbursements, party
statements with balances, closed/archived locking, Super Admin + Admin roles
and invite-only registration, the release/data-entry lock, the pretty HTML
report generator, and the styled Excel export.

## View it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000    # then visit http://localhost:8000
```

On first run you'll set up the **Super Admin** account (its ID is `AL1409`);
everything else is created from the in-app **Settings** tab.

### Publish on GitHub Pages

Push this repository, then in **Settings → Pages** choose *Deploy from a
branch* and pick this branch with the `/ (root)` folder. Your site appears at
`https://<user>.github.io/<repo>/`.

## How the conversion works

The application source is **unchanged React**, kept verbatim in
[`src/app.jsx`](src/app.jsx). Only two things were adapted for a backend-less
static host:

| Original (artifact runtime) | Static-site replacement |
|---|---|
| `import … from "react"` / `"xlsx"` | Vendored UMD bundles expose `React`, `ReactDOM`, `XLSX` as globals (`/vendor`) |
| `window.storage` (shared server store) | A `localStorage`-backed shim in `index.html` with the same async `get/set/delete` API |

Because there is no backend, **records live in the browser that entered them**
— the three-user *shared* ledger of the hosted artifact becomes a per-browser
store here. Use the in-app **Generate Report** (Pretty PDF / Excel) to keep
portable copies. The AI "read statement images" import calls the Anthropic API
directly and is not available on a plain static host; every other feature works
fully.

## Files

```
index.html      Page shell: vendored libs, window.storage shim, mount point
app.js          The app, transpiled to browser JS (generated — do not edit)
src/app.jsx     The React source (edit here, then rebuild)
build.mjs       Transpiles src/app.jsx -> app.js
vendor/         React, ReactDOM, SheetJS (XLSX) and the Tailwind engine
```

## Rebuild after editing the app

`app.js` is generated from `src/app.jsx`. After changing the source:

```bash
npm install --no-save @babel/core @babel/preset-react
node build.mjs
```

Then commit both `src/app.jsx` and the regenerated `app.js`.
