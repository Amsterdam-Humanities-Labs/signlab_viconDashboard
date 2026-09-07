<?php

// signcollect-lib's install-root resolver: sc_path(), sc_dir(), sc_root().
// Vendored shim - it finds /web/lib/paths.php, or falls back to /web.
require_once __DIR__ . '/../sc_paths.php';

/**
 * API: Get Live Feed
 * Returns last 10 captures (or filtered by date) with subdirectory status and completion logic
 *
 * Parameters:
 *   date (optional): Filter by date in YYYY-MM-DD format
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once(sc_path('mysql_config.php'));

try {
    $conn = new mysqli($servername, $username, $password, $database);

    if ($conn->connect_error) {
        throw new Exception("Database connection failed: " . $conn->connect_error);
    }

    // Get optional date filter
    $filter_date = isset($_GET['date']) ? $_GET['date'] : null;

    // Build query based on whether date filter is present
    $sql = "SELECT c.capture_id, c.date_dir, c.recording_dir, c.file_count,
                   c.total_size_bytes, c.first_seen, c.last_modified,
                   GROUP_CONCAT(DISTINCT f.subdirectory ORDER BY f.subdirectory SEPARATOR ',') as subdirs_present,
                   SUM(CASE WHEN f.status = 'growing' THEN 1 ELSE 0 END) as growing_files_count,
                   SUM(CASE WHEN f.subdirectory = 'unreal' AND f.filename LIKE '%.csv' THEN 1 ELSE 0 END) as csv_file_count,
                   SUM(CASE WHEN f.glb_path IS NOT NULL THEN 1 ELSE 0 END) as has_glb
            FROM vicon_captures c
            LEFT JOIN vicon_files f ON c.capture_id = f.capture_id";

    if ($filter_date) {
        $sql .= " WHERE c.date_dir = ?";
    }

    $sql .= " GROUP BY c.capture_id
              ORDER BY c.first_seen DESC";

    // Limit results to most recent 100 captures when not filtered by date
    if (!$filter_date) {
        $sql .= " LIMIT 100";
    }

    // Prepare and execute query
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Query preparation failed: " . $conn->error);
    }

    if ($filter_date) {
        $stmt->bind_param("s", $filter_date);
    }

    $stmt->execute();
    $result = $stmt->get_result();

    if (!$result) {
        throw new Exception("Query failed: " . $conn->error);
    }

    // Required subdirectories for completion
    $required_subdirs = ['obs', 'shogun_live', 'unreal', 'livelink', 'metadata'];

    // All possible subdirectories to track
    $all_subdirs = ['obs', 'shogun_live', 'unreal', 'livelink', 'metadata', 'shogun_post'];

    $captures = [];
    while ($row = $result->fetch_assoc()) {
        // Parse present subdirectories
        $present = $row['subdirs_present'] ? explode(',', $row['subdirs_present']) : [];

        // Calculate subdirectory status for each possible subdirectory
        $subdirectory_status = [];
        foreach ($all_subdirs as $subdir) {
            $subdirectory_status[$subdir] = in_array($subdir, $present);
        }
        $subdirectory_status['unreal/CC'] = in_array('unreal/CC', $present);
        $subdirectory_status['unreal/Vicon'] = in_array('unreal/Vicon', $present);

        // Check if CSV files exist in unreal subdirectory - these should count as livelink
        $csv_count = (int)$row['csv_file_count'];
        if ($csv_count > 0) {
            $subdirectory_status['livelink'] = true;
            // Add livelink to present array for completion calculation
            if (!in_array('livelink', $present)) {
                $present[] = 'livelink';
            }
        }

        // Calculate completion status
        $required_present = array_intersect($required_subdirs, $present);
        $required_count = count($required_present);
        $growing_count = (int)$row['growing_files_count'];

        if ($required_count === 5 && $growing_count == 0) {
            $completion_status = 'green';  // Complete
        } else if ($required_count === 5 && $growing_count > 0) {
            $completion_status = 'yellow'; // Uploading
        } else {
            $completion_status = 'red';    // Incomplete
        }

        // Convert size to MB
        $total_size_mb = round($row['total_size_bytes'] / 1048576, 2);

        // Lookup text separately for better performance
        $tekst = null;
        $base_name = implode('_', array_slice(explode('_', $row['recording_dir']), 0, 2));
        $m_file = $base_name . '.wav';

        $tekst_sql = "SELECT s.zinString
                      FROM matched_transcriptions mt
                      JOIN sentences s ON s.ID = mt.m_transcription
                      WHERE mt.m_file = ? AND mt.zOg = 'Zin'
                      LIMIT 1";
        $tekst_stmt = $conn->prepare($tekst_sql);
        if ($tekst_stmt) {
            $tekst_stmt->bind_param("s", $m_file);
            $tekst_stmt->execute();
            $tekst_result = $tekst_stmt->get_result();
            if ($tekst_row = $tekst_result->fetch_assoc()) {
                $tekst = $tekst_row['zinString'];
            }
            $tekst_stmt->close();
        }

        // Lookup obs MIDDLE filename for 3D viewer link
        $obs_filename = null;
        $obs_sql = "SELECT filename FROM vicon_files
                    WHERE capture_id = ? AND subdirectory = 'obs'
                      AND filename NOT LIKE '%MIDDLE%'
                      AND filename NOT LIKE '%LEFT%'
                      AND filename NOT LIKE '%RIGHT%'
                    LIMIT 1";
        $obs_stmt = $conn->prepare($obs_sql);
        if ($obs_stmt) {
            $obs_stmt->bind_param("s", $row['capture_id']);
            $obs_stmt->execute();
            $obs_result = $obs_stmt->get_result();
            if ($obs_row = $obs_result->fetch_assoc()) {
                $fn = $obs_row['filename'];
                // Prepend recording_dir if the filename doesn't already include it
                if (strpos($fn, $row['recording_dir']) !== 0) {
                    $obs_filename = $row['recording_dir'] . '_' . $fn;
                } else {
                    $obs_filename = $fn;
                }
            }
            $obs_stmt->close();
        }

        $captures[] = [
            'capture_id' => $row['capture_id'],
            'recording_dir' => $row['recording_dir'],
            'date_dir' => $row['date_dir'],
            'subdirs_present' => $row['subdirs_present'],
            'growing_files_count' => $growing_count,
            'subdirectory_status' => $subdirectory_status,
            'completion_status' => $completion_status,
            'file_count' => (int)$row['file_count'],
            'total_size_mb' => $total_size_mb,
            'first_seen' => $row['first_seen'],
            'last_modified' => $row['last_modified'],
            'tekst' => $tekst,
            'has_glb' => (int)$row['has_glb'] > 0,
            'obs_filename' => $obs_filename
        ];
    }

    $stmt->close();
    $conn->close();

    echo json_encode([
        'success' => true,
        'captures' => $captures,
        'filter_date' => $filter_date,
        'timestamp' => time()
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => time()
    ]);
}
