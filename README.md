# signlab_viconDashboard
A live dashboard for Vicon recording sessions. It shows which recordings arrived, whether their files are complete, and download links.

## What it does
- `index.html` refreshes every 30 seconds. It shows the last 100 recordings or one date, the last 30 recording dates, a mocap pie chart and a Tekst column.
- Row colours: green when `obs`, `shogun_live`, `unreal`, `livelink` and `metadata` are all present and no file is still growing. Yellow when all five are present but files are still growing. Red when one is missing. `shogun_post`, GLB and the `unreal/CC` and `unreal/Vicon` columns (from 2026-02-17) are shown but do not change the colour.
- `livelink` counts as present when `unreal` holds its CSVs. Files that stay on the Vicon PC show as present but have no download link.
- Read-only JSON in `api/`: `get_live_feed.php`, `get_capture_files.php`, `get_date_overview.php`, `get_mocap_stats.php`, `get_capture_glb.php` (for `3d-viewer.html`).

## Where it runs
Core server: `/web/viconDashboard`, https://signcollect.nl/viconDashboard/.
Demo hosts: dev2 `/web/viconDashboard`, dev-1 `/srv/signcollect/web/viconDashboard`.

## Status
Production.

## How to run / deploy
[signlab_signcollect-stack](https://github.com/Amsterdam-Humanities-Labs/signlab_signcollect-stack) deploys it (`repos.tsv` row `viconDashboard`).
There is no build step. Bootstrap 5 and Chart.js load from CDNs.

## Configuration
- `mysql_config.php` (not in git) at the docroot. The code finds it with `sc_path()`.
- `sc_paths.php` is copied from signcollect-lib; edit it there, not here.

## Dependencies
- MySQL `admin_gebarenoverleg`: `vicon_captures` and `vicon_files` (written by [signlab_viconSync](https://github.com/Amsterdam-Humanities-Labs/signlab_viconSync)), `matched_transcriptions`, `sentences`.
- Downloads go through the `gebarenoverleg_media/` symlinks to `/mnt/bigstorage/`. `/userProtect.js` must be at the docroot.
- The Tekst link opens `3d-viewer.html?capture_id=…`: the capture GLB (cc_pipeline `_anim.glb` if present, via `api/get_capture_glb.php`) on the Babylon CC avatar from `/animMIDI/babyloncc/dist/` (same scene code as annotation-editors 3DAnn3).

## License and citation

Apache License 2.0, copyright University of Amsterdam: see [LICENSE](LICENSE) and
[NOTICE](NOTICE). You may use it, also commercially, as long as you credit
Gomer Otterspeer / University of Amsterdam as the source. To cite it, use
[CITATION.cff](CITATION.cff) (the *Cite this repository* button on GitHub) or the DOI [10.21942/uva.33980395](https://doi.org/10.21942/uva.33980395).
