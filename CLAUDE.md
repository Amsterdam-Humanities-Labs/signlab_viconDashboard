# Agent notes for signlab_viconDashboard
See README.md for what the dashboard does and how it is deployed.

## Code map
- `js/dashboard.js`: all frontend logic (auto-refresh, table rendering, file-list expansion). `css/dashboard.css`: status colours.
- `api/get_live_feed.php` holds the completion logic (`$required_subdirs`; `livelink` is derived from CSVs in `unreal`).
- PHP loads `sc_paths.php`, then `sc_path('mysql_config.php')`. Do not edit `sc_paths.php` here (it is copied from signcollect-lib).

## Tables (MySQL `admin_gebarenoverleg`)
- `vicon_captures`: date_dir, recording_dir, file_count, total_size_bytes
- `vicon_files`: file_path, filename, glb_path, subdirectory, size_bytes, status (`growing` = still uploading)
- `matched_transcriptions` (m_file, m_transcription, zOg) and `sentences` (zinString) feed the Tekst column

## File storage
- Files come from the Vicon PC (`E:\Recordings\{date}\{recording_dir}\{subdirectory}\`) and sync to `/mnt/bigstorage/`.
- Web paths via symlinks in `/web/gebarenoverleg_media/`: `razerFiles/` (OBS), `shogun_live/`, `fbx/` (FBX/GLB).
- livelink CSV, metadata JSON, `unreal/CC`, `unreal/Vicon` and `shogun_post` stay on the Vicon PC; no download link.
