<?php

// signcollect-lib's install-root resolver: sc_path(), sc_dir(), sc_root().
// Vendored shim - it finds /web/lib/paths.php, or falls back to /web.
require_once __DIR__ . '/../sc_paths.php';

/**
 * API: Get Date Overview
 * Returns list of dates with capture counts for the date overview panel
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once(sc_path('mysql_config.php'));

try {
    $conn = new mysqli($servername, $username, $password, $database);

    if ($conn->connect_error) {
        throw new Exception("Database connection failed: " . $conn->connect_error);
    }

    // Query to get date overview with capture counts
    $sql = "SELECT date_dir,
                   COUNT(*) as capture_count,
                   SUM(CASE WHEN recording_dir LIKE '%_0' THEN 1 ELSE 0 END) as unique_capture_count,
                   MAX(last_modified) as latest_activity
            FROM vicon_captures
            GROUP BY date_dir
            ORDER BY date_dir DESC
            LIMIT 30";

    $result = $conn->query($sql);

    if (!$result) {
        throw new Exception("Query failed: " . $conn->error);
    }

    $dates = [];
    while ($row = $result->fetch_assoc()) {
        $dates[] = [
            'date' => $row['date_dir'],
            'capture_count' => (int)$row['capture_count'],
            'unique_capture_count' => (int)$row['unique_capture_count'],
            'latest_activity' => $row['latest_activity']
        ];
    }

    $conn->close();

    echo json_encode([
        'success' => true,
        'dates' => $dates,
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
