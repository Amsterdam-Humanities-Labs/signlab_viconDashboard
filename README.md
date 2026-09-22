# signlab_viconDashboard
Live dashboard for Vicon capture sessions: which captures arrived, whether their files are complete, download links.

## What it does
- `index.html` (refreshes every 30 s): last 100 captures or one date, date sidebar, mocap pie chart, Tekst column.
- Row colour: green = all of `obs`, `shogun_live`, `unreal`, `livelink`, `metadata` present and nothing growing; yellow = still growing; red = missing subdir.
- `livelink` is derived from CSVs in `unreal`. Files that stay on the Vicon PC show as present but have no download link.
- Read-only JSON: `api/get_live_feed.php`, `get_capture_files.php`, `get_date_overview.php`, `get_mocap_stats.php`.
- Details for code changes: `CLAUDE.md`.

## Where it runs
core (production): `/web/viconDashboard`, https://signcollect.nl/viconDashboard/. Demo: dev2 `/web/viconDashboard`, dev-1 `/srv/signcollect/web/viconDashboard`.

## Status
production

## How to run / deploy
Deployed by the stack (repos.tsv row `viconDashboard`): https://github.com/Amsterdam-Humanities-Labs/signlab_signcollect-stack
No build step; Bootstrap 5 and Chart.js load from CDNs.

## Configuration
- `mysql_config.php` (not in git) at the docroot, found via `sc_path()`.
- Vendored `sc_paths.php` (edit it in signcollect-lib, not here).

## Dependencies
- MySQL `admin_gebarenoverleg`: `vicon_captures`, `vicon_files` (written by signlab_viconSync), `matched_transcriptions`, `sentences`.
- `/mnt/bigstorage/` via `gebarenoverleg_media/` symlinks for downloads; `/userProtect.js` at the docroot.
- The Tekst link targets `/sCApp/3DViewer_viconDashboard.html`, which is in no repo (404 on prod and demo).
