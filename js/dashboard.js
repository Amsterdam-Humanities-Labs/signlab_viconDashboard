/**
 * Vicon Dashboard JavaScript
 * Handles auto-refresh, date filtering, and live feed rendering
 */

// Global state
let autoRefreshInterval = null;
let currentFilterDate = null;
let expandedCaptureId = null;
let fileListCache = {}; // Cache file list data by capture_id
let mocapPieChart = null; // Chart.js instance for mocap pie chart

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', function() {
    initDashboard();
});

/**
 * Initialize dashboard: load data and setup auto-refresh
 */
function initDashboard() {
    loadMocapStats();
    loadDateOverview();
    loadLiveFeed();
    startAutoRefresh();

    // Setup auto-refresh toggle
    document.getElementById('autoRefreshToggle').addEventListener('change', function(e) {
        if (e.target.checked) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
}

/**
 * Load and render date overview panel
 */
async function loadDateOverview() {
    try {
        const response = await fetch('api/get_date_overview.php');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load date overview');
        }

        renderDateOverview(data.dates);

    } catch (error) {
        console.error('Error loading date overview:', error);
        document.getElementById('dateOverview').innerHTML = `
            <div class="alert alert-danger mb-0" role="alert">
                <small>Error loading dates: ${escapeHtml(error.message)}</small>
            </div>
        `;
    }
}

/**
 * Render date overview cards
 */
function renderDateOverview(dates) {
    const container = document.getElementById('dateOverview');

    if (!dates || dates.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-3">No dates found</div>';
        return;
    }

    container.innerHTML = dates.map(dateInfo => {
        const isActive = currentFilterDate === dateInfo.date ? 'active' : '';
        return `
            <div class="date-card ${isActive} p-2 mb-2 border rounded"
                 data-date="${escapeHtml(dateInfo.date)}"
                 onclick="filterByDate('${escapeHtml(dateInfo.date)}')">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${formatDate(dateInfo.date)}</strong>
                    </div>
                    <div class="d-flex gap-1">
                        <span class="badge bg-success rounded-pill" title="Unique captures (ending with _0)">${dateInfo.unique_capture_count}</span>
                        <span class="badge bg-primary rounded-pill" title="Total captures">${dateInfo.capture_count}</span>
                    </div>
                </div>
                <div class="small text-muted">
                    ${formatTime(dateInfo.latest_activity)}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Load and render mocap statistics pie chart
 */
async function loadMocapStats() {
    try {
        const response = await fetch('api/get_mocap_stats.php');
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load mocap statistics');
        }

        renderMocapPieChart(data);

    } catch (error) {
        console.error('Error loading mocap statistics:', error);
        document.getElementById('mocapStats').innerHTML = `
            <div class="text-danger small">
                Error loading stats
            </div>
        `;
    }
}

/**
 * Render mocap statistics pie chart
 */
function renderMocapPieChart(data) {
    const ctx = document.getElementById('mocapPieChart');

    // If chart already exists, just update the data (no flicker)
    if (mocapPieChart) {
        mocapPieChart.data.datasets[0].data = [data.with_mocap, data.without_mocap];
        mocapPieChart.update('none'); // Update without animation to prevent flicker
    } else {
        // Create pie chart for the first time
        mocapPieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: ['With Mocap', 'Without Mocap'],
                datasets: [{
                    data: [data.with_mocap, data.without_mocap],
                    backgroundColor: [
                        '#28a745', // Green for with mocap
                        '#dc3545'  // Red for without mocap
                    ],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 10,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = data.total;
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Update stats text
    const withPercentage = ((data.with_mocap / data.total) * 100).toFixed(1);
    const withoutPercentage = ((data.without_mocap / data.total) * 100).toFixed(1);

    document.getElementById('mocapStats').innerHTML = `
        <div class="text-muted">
            <strong>${data.total}</strong> total sentences<br>
            <span class="text-success">${data.with_mocap} (${withPercentage}%)</span> captured<br>
            <span class="text-danger">${data.without_mocap} (${withoutPercentage}%)</span> not captured
        </div>
    `;

    const pct = (val) => data.total_sentences > 0 ? ((val / data.total_sentences) * 100).toFixed(1) : '0.0';
    document.getElementById('statusKlaarStats').innerHTML = `
        <table class="table table-sm table-borderless mb-0 small">
            <tbody>
                <tr>
                    <td class="text-muted py-0">Glos</td>
                    <td class="text-end py-0"><strong>${data.glos_klaar}</strong> / ${data.total_sentences} <span class="text-muted">(${pct(data.glos_klaar)}%)</span></td>
                </tr>
                <tr>
                    <td class="text-muted py-0">Video</td>
                    <td class="text-end py-0"><strong>${data.video_klaar}</strong> / ${data.total_sentences} <span class="text-muted">(${pct(data.video_klaar)}%)</span></td>
                </tr>
                <tr>
                    <td class="text-muted py-0"><strong>Both</strong></td>
                    <td class="text-end py-0"><span class="text-success"><strong>${data.both_klaar}</strong></span> / ${data.total_sentences} <span class="text-muted">(${pct(data.both_klaar)}%)</span></td>
                </tr>
            </tbody>
        </table>
    `;
}

/**
 * Load and render live feed table
 */
async function loadLiveFeed(date = null) {
    try {
        const url = date ? `api/get_live_feed.php?date=${encodeURIComponent(date)}` : 'api/get_live_feed.php';
        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to load live feed');
        }

        renderLiveFeed(data.captures, data.filter_date);
        updateLastUpdateTime(data.timestamp);

    } catch (error) {
        console.error('Error loading live feed:', error);
        document.getElementById('liveFeedBody').innerHTML = `
            <tr>
                <td colspan="15" class="text-center text-danger py-3">
                    Error loading captures: ${escapeHtml(error.message)}
                </td>
            </tr>
        `;
    }
}

/**
 * Render live feed table rows
 */
function renderLiveFeed(captures, filterDate) {
    const tbody = document.getElementById('liveFeedBody');

    if (!captures || captures.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="15" class="text-center text-muted py-3">
                    No captures found${filterDate ? ' for ' + formatDate(filterDate) : ''}
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = captures.map(capture => createCaptureRow(capture)).join('');

    // Add click handlers to rows
    document.querySelectorAll('#liveFeedBody tr.capture-row').forEach(row => {
        row.addEventListener('click', function() {
            toggleFileList(this);
        });
    });

    // Re-expand previously expanded row if it still exists
    if (expandedCaptureId) {
        const expandedRow = document.querySelector(`tr.capture-row[data-capture-id="${expandedCaptureId}"]`);
        if (expandedRow) {
            expandFileList(expandedRow);
        }
    }
}

/**
 * Create a single capture row
 */
function createCaptureRow(capture) {
    const statusClass = `status-${capture.completion_status}`;
    const subdirs = ['obs', 'shogun_live', 'unreal', 'livelink', 'metadata', 'shogun_post'];

    const subdirCells = subdirs.map(subdir => {
        const present = capture.subdirectory_status[subdir];
        const cellClass = present ? 'subdir-present' : 'subdir-missing';
        return `<td class="text-center ${cellClass}"></td>`;
    }).join('');

    const glbClass = capture.has_glb ? 'glb-present' : 'glb-missing';

    // CC and Vicon cells: only expected from 2026-02-17 onwards
    const ccViconSubdirs = ['unreal/CC', 'unreal/Vicon'];
    const ccViconCells = ccViconSubdirs.map(subdir => {
        if (capture.date_dir >= '2026-02-17') {
            const present = capture.subdirectory_status[subdir];
            const cellClass = present ? 'subdir-present' : 'subdir-missing';
            return `<td class="text-center ${cellClass}"></td>`;
        } else {
            return `<td class="text-center subdir-na"></td>`;
        }
    }).join('');

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

    return `
        <tr class="capture-row ${statusClass}" data-capture-id="${escapeHtml(capture.capture_id)}" style="cursor: pointer;" title="Click to view files">
            <td><strong>${escapeHtml(capture.recording_dir)}</strong></td>
            <td>${tekstCell}</td>
            <td>${formatDate(capture.date_dir)}</td>
            <td>${formatTime(capture.last_modified)}</td>
            ${subdirCells}
            <td class="text-center ${glbClass}"></td>
            ${ccViconCells}
            <td class="text-center">${capture.file_count}</td>
            <td class="text-center">${formatSize(capture.total_size_mb)}</td>
        </tr>
    `;
}

/**
 * Filter live feed by date
 */
function filterByDate(date) {
    currentFilterDate = date;
    loadLiveFeed(date);

    // Update filter indicator
    document.getElementById('filterIndicator').innerHTML = `
        <span class="badge bg-light text-dark">
            Captures for ${formatDate(date)}
        </span>
        <button class="btn btn-sm btn-outline-light ms-2" onclick="clearDateFilter()">
            Clear filter
        </button>
    `;

    // Update active state in date overview
    document.querySelectorAll('.date-card').forEach(card => {
        if (card.dataset.date === date) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    });
}

/**
 * Clear date filter and return to all captures
 */
function clearDateFilter() {
    currentFilterDate = null;
    loadLiveFeed();

    // Update filter indicator
    document.getElementById('filterIndicator').innerHTML = `
        <span class="badge bg-light text-dark">Last 100 captures</span>
    `;

    // Clear active state in date overview
    document.querySelectorAll('.date-card').forEach(card => {
        card.classList.remove('active');
    });
}

/**
 * Start auto-refresh
 */
function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing interval

    autoRefreshInterval = setInterval(() => {
        loadMocapStats();
        loadDateOverview();
        loadLiveFeed(currentFilterDate);
    }, 30000); // Refresh every 30 seconds
}

/**
 * Stop auto-refresh
 */
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
}

/**
 * Update last update timestamp
 */
function updateLastUpdateTime(timestamp) {
    const date = new Date(timestamp * 1000);
    const timeStr = date.toLocaleTimeString();
    document.getElementById('lastUpdate').textContent = timeStr;
}

/**
 * Format date from YYYY-MM-DD to readable format
 */
function formatDate(dateStr) {
    if (!dateStr) return '--';

    const date = new Date(dateStr + 'T00:00:00');
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp) {
    if (!timestamp) return '--';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
        return 'Just now';
    } else if (diffMins < 60) {
        return `${diffMins}m ago`;
    } else if (diffHours < 24) {
        return `${diffHours}h ago`;
    } else if (diffDays < 7) {
        return `${diffDays}d ago`;
    } else {
        const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        return date.toLocaleDateString('en-US', options);
    }
}

/**
 * Format file size
 */
function formatSize(sizeMB) {
    if (!sizeMB || sizeMB === 0) return '0 MB';

    if (sizeMB < 1) {
        return `${(sizeMB * 1024).toFixed(0)} KB`;
    } else if (sizeMB < 1024) {
        return `${sizeMB.toFixed(1)} MB`;
    } else {
        return `${(sizeMB / 1024).toFixed(2)} GB`;
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Expand file list for a capture row (no toggle, just expand)
 */
async function expandFileList(row) {
    const captureId = row.dataset.captureId;

    // Mark this row as expanded and track it
    row.classList.add('expanded');
    expandedCaptureId = captureId;

    // Create file list row
    const fileListRow = document.createElement('tr');
    fileListRow.className = 'file-list-row';

    // Check if we have cached data
    if (fileListCache[captureId]) {
        // Use cached data immediately (no loading spinner, no flicker)
        fileListRow.innerHTML = `
            <td colspan="15" class="file-list-cell">
                ${renderFileList(fileListCache[captureId], captureId)}
            </td>
        `;
        row.after(fileListRow);

        // Refresh data in background
        refreshFileList(captureId, fileListRow);
    } else {
        // No cache, show loading spinner
        fileListRow.innerHTML = `
            <td colspan="15" class="file-list-cell">
                <div class="text-center py-3">
                    <div class="spinner-border spinner-border-sm" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <span class="ms-2">Loading files...</span>
                </div>
            </td>
        `;
        row.after(fileListRow);

        try {
            // Fetch files for this capture
            const response = await fetch(`api/get_capture_files.php?capture_id=${encodeURIComponent(captureId)}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to load files');
            }

            // Cache the data
            fileListCache[captureId] = data.files;

            // Replace loading row with file list
            fileListRow.innerHTML = `
                <td colspan="15" class="file-list-cell">
                    ${renderFileList(data.files, captureId)}
                </td>
            `;

        } catch (error) {
            console.error('Error loading files:', error);
            fileListRow.innerHTML = `
                <td colspan="15" class="file-list-cell">
                    <div class="alert alert-danger mb-0">
                        Error loading files: ${escapeHtml(error.message)}
                    </div>
                </td>
            `;
        }
    }
}

/**
 * Refresh file list data in background
 */
async function refreshFileList(captureId, fileListRow) {
    try {
        const response = await fetch(`api/get_capture_files.php?capture_id=${encodeURIComponent(captureId)}`);
        const data = await response.json();

        if (data.success) {
            // Update cache
            fileListCache[captureId] = data.files;

            // Update the displayed file list (smooth update, no loading spinner)
            fileListRow.innerHTML = `
                <td colspan="15" class="file-list-cell">
                    ${renderFileList(data.files, captureId)}
                </td>
            `;
        }
    } catch (error) {
        console.error('Error refreshing file list:', error);
        // Keep showing cached data on error
    }
}

/**
 * Toggle file list for a capture row
 */
async function toggleFileList(row) {
    const nextRow = row.nextElementSibling;

    // Check if file list is already open
    if (nextRow && nextRow.classList.contains('file-list-row')) {
        // Close the file list
        nextRow.remove();
        row.classList.remove('expanded');
        expandedCaptureId = null;
        return;
    }

    // Close any other open file lists
    document.querySelectorAll('.file-list-row').forEach(r => r.remove());
    document.querySelectorAll('.capture-row.expanded').forEach(r => r.classList.remove('expanded'));

    // Expand this row
    await expandFileList(row);
}

/**
 * Render file list HTML
 */
function renderFileList(files, captureId) {
    if (!files || files.length === 0) {
        return '<div class="alert alert-info mb-0">No files found for this capture</div>';
    }

    // Group files by subdirectory
    const filesBySubdir = {};
    files.forEach(file => {
        if (!filesBySubdir[file.subdirectory]) {
            filesBySubdir[file.subdirectory] = [];
        }
        filesBySubdir[file.subdirectory].push(file);
    });

    // Sort subdirectories
    const subdirs = Object.keys(filesBySubdir).sort();

    let html = '<div class="file-list-container p-3">';
    html += `<div class="d-flex justify-content-between align-items-center mb-3">`;
    html += `<h6 class="mb-0">Files for ${escapeHtml(captureId.split('/')[1])}</h6>`;
    html += `<span class="badge bg-secondary">${files.length} files</span>`;
    html += `</div>`;

    subdirs.forEach(subdir => {
        const subdirFiles = filesBySubdir[subdir];
        const totalSize = subdirFiles.reduce((sum, f) => sum + f.size_bytes, 0);
        const hasGrowing = subdirFiles.some(f => f.status === 'growing');

        html += `<div class="subdir-group mb-3">`;
        html += `<div class="subdir-header d-flex justify-content-between align-items-center mb-2">`;
        html += `<strong class="text-primary">${escapeHtml(subdir)}</strong>`;
        html += `<span class="badge bg-light text-dark">${subdirFiles.length} files · ${formatSize(totalSize / 1048576)}`;
        if (hasGrowing) {
            html += ` <span class="text-warning">● uploading</span>`;
        }
        html += `</span>`;
        html += `</div>`;
        html += `<div class="file-list">`;

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

        html += `</div></div>`;
    });

    html += '</div>';
    return html;
}
