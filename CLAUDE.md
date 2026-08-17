# Vicon Capture Dashboard

Real-time dashboard for monitoring Vicon motion capture recording sessions. Shows capture status, file completions, and links to the 3D viewer.

## Tech Stack
- **Frontend:** Vanilla JavaScript + Bootstrap 5 + Chart.js
- **Backend:** PHP API endpoints + MySQL
- **Database:** `admin_gebarenoverleg` on localhost (config at `/web/mysql_config.php`)

## Project Structure
```
index.html              — Main dashboard page
css/dashboard.css       — Custom styles (status colors, indicators, file list)
js/dashboard.js         — All frontend logic (auto-refresh, table rendering, file list expansion)
api/
  get_live_feed.php     — Returns captures with subdirectory status, tekst, GLB status
  get_capture_files.php — Returns file list for a specific capture (expanded row)
  get_date_overview.php — Returns dates with capture counts (left sidebar)
  get_mocap_stats.php   — Returns mocap statistics for pie chart
```

## Database Tables
- `vicon_captures` — Capture metadata (date_dir, recording_dir, file_count, total_size_bytes)
- `vicon_files` — Individual files (file_path, filename, glb_path, subdirectory, size_bytes, status)
- `matched_transcriptions` — Links recordings to sentence transcriptions (m_file, m_transcription, zOg)
- `sentences` — Sentence text (zinString) used for the Tekst column

## File Storage
Files originate on a Windows recording machine (`E:\Recordings\{date}\{recording_dir}\{subdirectory}\`) and are synced to `/mnt/bigstorage/` on the Linux server.

Web-accessible paths (via symlinks in `/web/gebarenoverleg_media/`):
- **OBS videos:** `gebarenoverleg_media/razerFiles/{filename}` → `/mnt/bigstorage/razerFiles/`
- **Shogun live:** `gebarenoverleg_media/shogun_live/{filename}` → `/mnt/bigstorage/shogun_live/`
- **FBX/GLB:** `gebarenoverleg_media/fbx/{filename}` → `/mnt/bigstorage/fbx/`

Not all subdirectories are synced — livelink CSV, metadata JSON, unreal/CC, unreal/Vicon, and shogun_post files only exist on the Windows machine.

## Key URLs
- **Dashboard:** `https://signcollect.nl/viconDashboard/`
- **3D Viewer:** `https://signcollect.nl/sCApp/3DViewer_viconDashboard.html?file={recording_dir}&obs={obs_filename}`
- **Base media URL:** `https://signcollect.nl/gebarenoverleg_media/`

## Dashboard Features
- **Auto-refresh:** Every 30 seconds (toggleable)
- **Date filter:** Click a date in left sidebar to filter captures
- **Row expansion:** Click a capture row to see its file list
- **Status colors:** Green (complete), Yellow (uploading/growing), Red (incomplete)
- **Required subdirs for "complete":** obs, shogun_live, unreal, livelink, metadata
- **Tekst link:** Clickable link to 3D viewer when GLB exists
- **CC/Vicon columns:** Only shown for captures from 2026-02-17 onwards

## Completion Logic
- `livelink` status is derived from CSV files in the `unreal` subdirectory (not a physical livelink dir)
- A capture is "green" when all 5 required subdirs are present AND no files are "growing"
- A capture is "yellow" when all 5 required subdirs are present BUT files are still "growing"
