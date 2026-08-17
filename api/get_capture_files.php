<?php
/**
 * API: Get Capture Files
 * Returns list of files for a specific capture
 *
 * Parameters:
 *   capture_id (required): The capture ID to get files for
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

require_once('/web/mysql_config.php');

try {
    $conn = new mysqli($servername, $username, $password, $database);

    if ($conn->connect_error) {
        throw new Exception("Database connection failed: " . $conn->connect_error);
    }

    // Get required capture_id parameter
    $capture_id = isset($_GET['capture_id']) ? $_GET['capture_id'] : null;

    if (!$capture_id) {
        throw new Exception("capture_id parameter is required");
    }

    // Query to get all files for this capture
    $sql = "SELECT file_path, filename, subdirectory, size_bytes, status
            FROM vicon_files
            WHERE capture_id = ?
            ORDER BY subdirectory, filename";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        throw new Exception("Query preparation failed: " . $conn->error);
    }

    $stmt->bind_param("s", $capture_id);
    $stmt->execute();
    $result = $stmt->get_result();

    if (!$result) {
        throw new Exception("Query failed: " . $conn->error);
    }

    $files = [];
    $base_url = 'https://signcollect.nl/gebarenoverleg_media';

    while ($row = $result->fetch_assoc()) {
        // Compute download URL based on subdirectory
        $download_url = null;
        $subdir = $row['subdirectory'];
        $filename = $row['filename'];

        if ($subdir === 'obs') {
            $download_url = $base_url . '/razerFiles/' . rawurlencode($filename);
        } else if ($subdir === 'shogun_live') {
            $ext = pathinfo($filename, PATHINFO_EXTENSION);
            if (in_array($ext, ['enf', 'mcp', 'x2d'])) {
                $download_url = $base_url . '/shogun_live/' . rawurlencode($filename);
            }
        } else if ($subdir === 'unreal') {
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

    $stmt->close();
    $conn->close();

    echo json_encode([
        'success' => true,
        'capture_id' => $capture_id,
        'files' => $files,
        'file_count' => count($files),
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
