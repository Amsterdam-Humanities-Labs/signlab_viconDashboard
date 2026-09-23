<?php

// signcollect-lib's install-root resolver: sc_path(), sc_dir(), sc_root().
// Vendored shim - it finds /web/lib/paths.php, or falls back to /web.
require_once __DIR__ . '/../sc_paths.php';

/**
 * API: Get Capture GLB
 * Returns the animation GLB URL for one capture, for 3d-viewer.html.
 *
 * Parameters (one of):
 *   capture_id: vicon_captures.capture_id
 *   file:       vicon_captures.recording_dir (latest capture with that name)
 *
 * Prefers the cc_pipeline output (<CC fbx name>_anim.glb + _shapekeys.json,
 * the format the 3DAnn3 editor is built for, same check as zinnen-annotation's
 * getLatestMocapFile), else the GLB viconSync matched (vicon_files.glb_path).
 */

header('Content-Type: application/json');

require_once(sc_path('mysql_config.php'));

try {
    $conn = new mysqli($servername, $username, $password, $database);
    if ($conn->connect_error) {
        throw new Exception("Database connection failed: " . $conn->connect_error);
    }

    $capture_id = $_GET['capture_id'] ?? '';
    $file = $_GET['file'] ?? '';

    if ($capture_id === '') {
        if ($file === '') {
            throw new Exception("capture_id or file parameter is required");
        }
        $stmt = $conn->prepare("SELECT capture_id FROM vicon_captures
                                WHERE recording_dir = ?
                                ORDER BY date_dir DESC LIMIT 1");
        $stmt->bind_param("s", $file);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if (!$row) {
            throw new Exception("No capture named " . $file, 404);
        }
        $capture_id = $row['capture_id'];
    }

    $stmt = $conn->prepare("SELECT c.recording_dir, f.filename, f.subdirectory, f.glb_path
                            FROM vicon_captures c
                            LEFT JOIN vicon_files f ON f.capture_id = c.capture_id
                            WHERE c.capture_id = ?");
    $stmt->bind_param("s", $capture_id);
    $stmt->execute();
    $result = $stmt->get_result();

    $recording_dir = null;
    $cc_glb_url = null;
    $glb_url = null;
    $cc_dir = sc_dir('media_fbx', 'cc_pipeline');
    while ($row = $result->fetch_assoc()) {
        $recording_dir = $row['recording_dir'];
        $filename = (string)$row['filename'];

        if ($cc_glb_url === null && $row['subdirectory'] === 'unreal/CC'
                && preg_match('/\.fbx$/i', $filename)) {
            $base = preg_replace('/\.fbx$/i', '', $filename);
            // Require both halves: a GLB without its sidecar would load with a frozen face.
            if (is_readable($cc_dir . $base . '_anim.glb')
                    && is_readable($cc_dir . $base . '_shapekeys.json')) {
                $cc_glb_url = '/gebarenoverleg_media/fbx/cc_pipeline/' . rawurlencode($base . '_anim.glb');
            }
        }

        if ($glb_url === null && !empty($row['glb_path'])) {
            $pos = strpos($row['glb_path'], '/gebarenoverleg_media/');
            if ($pos !== false) {
                $glb_url = implode('/', array_map('rawurlencode',
                    explode('/', substr($row['glb_path'], $pos))));
            }
        }
    }
    $stmt->close();
    $conn->close();

    if ($recording_dir === null) {
        throw new Exception("Unknown capture_id " . $capture_id);
    }

    echo json_encode([
        'success' => true,
        'capture_id' => $capture_id,
        'recording_dir' => $recording_dir,
        'glb_url' => $cc_glb_url ?? $glb_url,
        'is_cc_pipeline' => $cc_glb_url !== null,
    ], JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    // 404 for an unknown capture, 500 for anything that actually went wrong.
    http_response_code($e->getCode() === 404 ? 404 : 500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}
