<?php

// signcollect-lib's install-root resolver: sc_path(), sc_dir(), sc_root().
// Vendored shim - it finds /web/lib/paths.php, or falls back to /web.
require_once __DIR__ . '/../sc_paths.php';

/**
 * API: Get Mocap Statistics
 * Returns statistics on how many zOg='Zin' entries have has_mocap set
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once(sc_path('mysql_config.php'));

try {
    $conn = new mysqli($servername, $username, $password, $database);

    if ($conn->connect_error) {
        throw new Exception("Database connection failed: " . $conn->connect_error);
    }

    // Query to get mocap statistics (deduplicated by m_transcription)
    // When multiple recordings share the same m_transcription, count it only once.
    // A transcription counts as "with mocap" if any of its recordings has has_mocap=1.
    $sql = "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN max_mocap = 1 THEN 1 ELSE 0 END) as with_mocap,
                SUM(CASE WHEN max_mocap = 0 OR max_mocap IS NULL THEN 1 ELSE 0 END) as without_mocap
            FROM (
                SELECT m_transcription, MAX(has_mocap) as max_mocap
                FROM matched_transcriptions
                WHERE zOg = 'Zin'
                GROUP BY m_transcription
            ) as unique_transcriptions";

    $result = $conn->query($sql);

    if (!$result) {
        throw new Exception("Query failed: " . $conn->error);
    }

    $stats = $result->fetch_assoc();

    // Count sentences with Klaar statuses
    // Total is all sentences in the sentences table (the max possible)
    $sql_status = "SELECT
                COUNT(*) as total_sentences,
                SUM(CASE WHEN COALESCE(s.status_glos, '0') = 'Klaar' THEN 1 ELSE 0 END) as glos_klaar,
                SUM(CASE WHEN COALESCE(s.status_video, '0') = 'Klaar' THEN 1 ELSE 0 END) as video_klaar,
                SUM(CASE WHEN COALESCE(s.status_glos, '0') = 'Klaar'
                          AND COALESCE(s.status_video, '0') = 'Klaar'
                     THEN 1 ELSE 0 END) as both_klaar
            FROM sentences s";

    $result_status = $conn->query($sql_status);

    if (!$result_status) {
        throw new Exception("Status query failed: " . $conn->error);
    }

    $status_stats = $result_status->fetch_assoc();

    $conn->close();

    echo json_encode([
        'success' => true,
        'total' => (int)$stats['total'],
        'with_mocap' => (int)$stats['with_mocap'],
        'without_mocap' => (int)$stats['without_mocap'],
        'total_sentences' => (int)$status_stats['total_sentences'],
        'glos_klaar' => (int)$status_stats['glos_klaar'],
        'video_klaar' => (int)$status_stats['video_klaar'],
        'both_klaar' => (int)$status_stats['both_klaar'],
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
