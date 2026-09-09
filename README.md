# signlab_viconDashboard — Vicon Capture Dashboard

A real-time dashboard for Vicon motion-capture sessions: which captures have
arrived, which of their files are complete, and a link into the 3D viewer for
each one.

## What it does

One page (`index.html`) plus four read-only JSON endpoints, refreshed every 30
seconds. It answers the question an operator asks during and just after a
session: *did that recording land intact?*

- **Capture table** — the 100 most recent captures, or every capture on a
  chosen date. Each row is coloured by completeness and expands to show its
  file list, with download links for the files that are actually on the server.
- **Date sidebar** — every date that has captures, with counts; click one to
  filter.
- **Mocap pie chart** — how much of the corpus has mocap and how much does not
  (Chart.js).
- **Tekst column** — the sentence the take belongs to, linking to
  `3DViewer_viconDashboard.html` when a GLB exists.

**Reading the status colours** — the part worth knowing:

| Colour | Means |
|---|---|
| Green | All five required subdirectories present **and** no file still growing |
| Yellow | All five present **but** files are still growing (upload in progress) |
| Red | Incomplete — a required subdirectory is missing |

The five required subdirectories are `obs`, `shogun_live`, `unreal`, `livelink`
and `metadata`. `livelink` is derived from the CSV files in the `unreal`
subdirectory — there is no physical `livelink` directory. The CC and Vicon
columns only appear for captures from 2026-02-17 onwards.

| Endpoint | Returns |
|---|---|
| `api/get_live_feed.php` | Captures with per-subdirectory status, tekst and GLB status |
| `api/get_capture_files.php` | The file list for one capture (the expanded row) |
| `api/get_date_overview.php` | Dates with capture counts (the sidebar) |
| `api/get_mocap_stats.php` | Mocap coverage figures (the pie chart) |

Frontend is vanilla JavaScript with Bootstrap 5 and Chart.js; there is no
framework and no bundler. `CLAUDE.md` documents the same ground in more detail
and is the better reference when changing the code.

## Where it runs

The **signcollect core server** (the production VPS), at `/web/viconDashboard`,
served as `https://signcollect.nl/viconDashboard/`. On the demo hosts it is
`/web/viconDashboard` (dev2) and `/srv/signcollect/web/viconDashboard` (dev-1).
It is one of the pages the `mocap.signcollect.nl` portal links to.

**It does not run on the Vicon PC, and it does not talk to it.** The dashboard
is a read-only view of two database tables, and it reads files under
`/mnt/bigstorage/` through symlinks in `/web/gebarenoverleg_media/`. The files
themselves originate on the Windows recording machine (the Vicon PC) under
`E:\Recordings\{date}\{recording_dir}\{subdirectory}\`, and it is
`signlab_viconSync` — running on the core server, over SSH on the tailnet — that
brings them across and writes the `vicon_captures` and `vicon_files` rows this
page renders. If a capture never appears here, the thing to check is that sync,
not this repository.

Not everything is synced. `livelink` CSV, `metadata` JSON, `unreal/CC`,
`unreal/Vicon` and `shogun_post` files exist only on the Windows machine, so
they show as present in the status logic but have no download link.

## Status

**Production.**

## How to run or deploy it

No build step — the third-party JavaScript comes from CDNs at page load.
Deployment is a git clone performed by the stack:
`signlab_signcollect-stack`'s `interface_deploy/scripts/repos.tsv` lists

    viconDashboard	signlab_viconDashboard	main

and the install scripts clone this repository and rsync it into
`<webroot>/viconDashboard`. The hardcoded `https://signcollect.nl/...` viewer
and media URLs in `js/dashboard.js` are rewritten to the demo host's own domain
by `rewrite-urls.sh` at deploy time.

To work on it locally, serve the directory with PHP and a MySQL connection; the
frontend talks only to `api/*.php` relative to itself.

## Configuration

- **`mysql_config.php`** — required, gitignored, and resolved through
  `sc_path('mysql_config.php')`, so it is read from the docroot root
  (`/web/mysql_config.php`). It defines `$servername`, `$username`, `$password`
  and `$database`, is created per host by the deploy, and Apache returns 403
  for it.
- **`sc_paths.php`** — the vendored signcollect-lib install-root resolver. It
  finds `lib/paths.php` next to the docroot or falls back to `/web`. Do not edit
  this copy — it is byte-identical across repos and is checksummed by the
  stack's `tests/path-test.sh`; edit the copy in `signlab_signcollect-lib`.
- The API endpoints send `Access-Control-Allow-Origin: *`. Nothing else in the
  estate calls them cross-origin, so this is wider than it needs to be.

## Dependencies

- **MySQL** database `admin_gebarenoverleg` on localhost — `vicon_captures`,
  `vicon_files`, `matched_transcriptions`, `sentences`.
- **`signlab_viconSync`** — populates every row this dashboard reads. Without it
  the page renders, empty and permanently stale.
- **`/mnt/bigstorage/`** on the host, surfaced through `gebarenoverleg_media/`
  symlinks (`razerFiles/` for OBS video, `shogun_live/`, `fbx/`) — the download
  links resolve there.
- **`sCApp/3DViewer_viconDashboard.html`** — the 3D viewer the Tekst column
  links to. It is served from the same host but is not in this repository.
- **`signlab_signcollect-lib`** (`/web/lib`) — optional; the resolver falls back
  to `/web` without it.
- **`/userProtect.js`** — the estate's shared login guard, loaded from the
  docroot root by `index.html`. It is not in this repository.
- **CDNs** for Bootstrap 5 and Chart.js — the page needs outbound HTTPS from the
  *browser*, not from the server.
- The mocap portal at `mocap.signcollect.nl` is served by the separate
  `mocap_site` repository, which links here.
