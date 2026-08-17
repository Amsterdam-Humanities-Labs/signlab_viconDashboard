# CLAUDE.md + Downloadable File Links + Tekst Bug Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write a CLAUDE.md documenting the project, make expanded file list items downloadable, and fix the tekst "--" link bug.

**Architecture:** Three independent changes: (1) a new CLAUDE.md file at project root, (2) PHP API + JS changes to add download URLs to file list items, (3) JS fix to make tekst cell clickable even when text is "--".

**Tech Stack:** PHP, vanilla JavaScript, Bootstrap 5, MySQL

---

## File Storage URL Mapping (reference for all tasks)

Files are synced from a Windows recording machine (`E:\Recordings\`) to the Linux server. Not all files are available for download — only those synced to `/mnt/bigstorage/` which is web-accessible via `gebarenoverleg_media/` symlinks.

| Subdirectory | Server path | Web URL pattern | Available |
|---|---|---|---|
| obs | `/mnt/bigstorage/razerFiles/{filename}` | `gebarenoverleg_media/razerFiles/{filename}` | Yes (all .mkv) |
| shogun_live | `/mnt/bigstorage/shogun_live/{filename}` | `gebarenoverleg_media/shogun_live/{filename}` | Partial (.enf, .mcp, .x2d only) |
| unreal | `/mnt/bigstorage/fbx/{filename}` | `gebarenoverleg_media/fbx/{filename}` | Yes (main .fbx) |
| GLB | `/mnt/bigstorage/fbx/{recording_dir}.glb` | `gebarenoverleg_media/fbx/{recording_dir}.glb` | Yes |
| livelink (CSV) | NOT ON SERVER | — | No |
| metadata | NOT ON SERVER | — | No |
| unreal/CC | NOT ON SERVER | — | No |
| unreal/Vicon | NOT ON SERVER | — | No |
| shogun_post | NOT ON SERVER | — | No |

**Database `file_path` format:** `E:\Recordings\{date}\{recording_dir}\{subdirectory}\{filename}`

**Key:** OBS filenames in the flat razerFiles dir include the recording_dir prefix (e.g., `techday_tekst2_260325_5_2026-03-25_11-47-50.mkv`). Shogun and FBX files also include the recording_dir prefix in their filename already.

---

### Task 1: Write CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Create CLAUDE.md at project root**

```markdown
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
```

- [ ] **Step 2: Verify CLAUDE.md renders correctly**

Read the file back and confirm formatting is correct.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md documenting project structure and architecture"
```

---

### Task 2: Make file list items downloadable

**Files:**
- Modify: `api/get_capture_files.php:49-57` (add download_url computation)
- Modify: `js/dashboard.js:626-633` (render files as links)
- Modify: `css/dashboard.css:255-258` (style downloadable file links)

The approach: compute `download_url` server-side in PHP based on the subdirectory-to-URL mapping. Only files that exist on the web server get a URL. The JS renders those as `<a>` download links.

- [ ] **Step 1: Add download URL computation to get_capture_files.php**

In `get_capture_files.php`, after fetching each file row (line 49-57), compute a `download_url` based on the subdirectory:

```php
$files = [];
$base_url = 'https://signcollect.nl/gebarenoverleg_media';

while ($row = $result->fetch_assoc()) {
    // Compute download URL based on subdirectory
    $download_url = null;
    $subdir = $row['subdirectory'];
    $filename = $row['filename'];

    if ($subdir === 'obs') {
        // OBS files are in razerFiles/ - filename already includes recording_dir prefix
        $download_url = $base_url . '/razerFiles/' . rawurlencode($filename);
    } else if ($subdir === 'shogun_live') {
        // Only .enf, .mcp, .x2d files are synced (not .mov, .capture)
        $ext = pathinfo($filename, PATHINFO_EXTENSION);
        if (in_array($ext, ['enf', 'mcp', 'x2d'])) {
            $download_url = $base_url . '/shogun_live/' . rawurlencode($filename);
        }
    } else if ($subdir === 'unreal') {
        // FBX files synced to fbx/
        if (str_ends_with($filename, '.fbx')) {
            $download_url = $base_url . '/fbx/' . rawurlencode($filename);
        }
    }

    $files[] = [
        'file_path' => $row['file_path'],
        'filename' => $row['filename'],
        'subdirectory' => $row['subdirectory'],
        'size_bytes' => (int)$row['size_bytes'],
        'size_mb' => round($row['size_bytes'] / 1048576, 2),
        'status' => $row['status'],
        'download_url' => $download_url
    ];
}
```

- [ ] **Step 2: Verify API returns download_url**

Run: `curl -s "http://127.0.0.1/viconDashboard/api/get_capture_files.php?capture_id=2026-03-25/techday_tekst2_260325_5" | python3 -m json.tool | grep download_url`

Expected: URLs for obs, some shogun_live, and unreal .fbx files. `null` for livelink, metadata, unreal/CC, unreal/Vicon.

- [ ] **Step 3: Render downloadable files as links in dashboard.js**

In `renderFileList()` (line 626-633), change the file item rendering to wrap filename in an `<a>` tag when `download_url` is present:

```javascript
subdirFiles.forEach(file => {
    const statusBadge = file.status === 'growing'
        ? '<span class="badge bg-warning text-dark ms-2">uploading</span>'
        : '';
    const fileNameHtml = file.download_url
        ? `<a href="${escapeHtml(file.download_url)}" target="_blank" onclick="event.stopPropagation();" class="file-download-link" title="Download ${escapeHtml(file.filename)}">${escapeHtml(file.filename)}</a>`
        : escapeHtml(file.filename);
    html += `<div class="file-item d-flex justify-content-between align-items-center py-1 px-2">`;
    html += `<span class="file-name"><small>${fileNameHtml}</small>${statusBadge}</span>`;
    html += `<span class="file-size text-muted"><small>${formatSize(file.size_mb)}</small></span>`;
    html += `</div>`;
});
```

- [ ] **Step 4: Add CSS for download links**

In `css/dashboard.css`, after the `.file-name` rule (line 255), add:

```css
/* Downloadable file links */
.file-download-link {
    color: #0d6efd;
    text-decoration: none;
}

.file-download-link:hover {
    text-decoration: underline;
}
```

- [ ] **Step 5: Test in browser**

1. Open the dashboard, click on a capture row to expand the file list
2. Verify OBS .mkv files are blue clickable links
3. Verify shogun_live .enf/.mcp/.x2d files are blue clickable links
4. Verify unreal .fbx files are blue clickable links
5. Verify livelink CSV, metadata JSON, unreal/CC, unreal/Vicon files are plain text (not links)
6. Click a download link — verify it opens/downloads the file in a new tab

- [ ] **Step 6: Commit**

```bash
git add api/get_capture_files.php js/dashboard.js css/dashboard.css
git commit -m "feat: make file list items downloadable for obs, shogun_live, and unreal files"
```

---

### Task 3: Fix tekst "--" not clickable when has_glb is true

**Files:**
- Modify: `js/dashboard.js:299-308` (tekst cell generation)

Currently the tekst cell logic is:
1. `tekst && has_glb` → clickable link with tekst as label
2. `tekst` only → plain text
3. no tekst → `--` (not clickable)

The bug: when `tekst` is null but `has_glb` is true, the "--" should still be a clickable link to the 3D viewer. The user expects to always be able to click through to the viewer when a GLB exists.

- [ ] **Step 1: Update tekst cell logic in createCaptureRow()**

Replace lines 299-308 in `dashboard.js`:

```javascript
let tekstCell;
const viewerUrl = `https://signcollect.nl/sCApp/3DViewer_viconDashboard.html?file=${encodeURIComponent(capture.recording_dir)}` +
    (capture.obs_filename ? `&obs=${encodeURIComponent(capture.obs_filename)}` : '');

if (capture.tekst && capture.has_glb) {
    tekstCell = `<a href="${viewerUrl}" target="_blank" onclick="event.stopPropagation();" class="tekst-link" title="Open 3D Viewer">${escapeHtml(capture.tekst)}</a>`;
} else if (capture.tekst) {
    tekstCell = escapeHtml(capture.tekst);
} else if (capture.has_glb) {
    tekstCell = `<a href="${viewerUrl}" target="_blank" onclick="event.stopPropagation();" class="tekst-link" title="Open 3D Viewer">--</a>`;
} else {
    tekstCell = '<span class="text-muted">--</span>';
}
```

The key change: added a new `else if (capture.has_glb)` branch that renders "--" as a clickable link when there's no tekst but a GLB file exists.

- [ ] **Step 2: Test in browser**

1. Find a capture with no tekst but with a GLB (has_glb = true)
2. Verify the "--" in the Tekst column is now a clickable link (dotted underline)
3. Click it — verify it opens the 3D viewer with the correct `?file=` parameter
4. Verify captures with tekst + GLB still show the tekst as a link (unchanged)
5. Verify captures with no tekst and no GLB show plain "--" (unchanged)

- [ ] **Step 3: Commit**

```bash
git add js/dashboard.js
git commit -m "fix: make tekst '--' clickable when GLB exists for 3D viewer access"
```
