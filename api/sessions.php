<?php
/**
 * api/sessions.php
 * Lưu trữ nhật ký biểu diễn theo từng bài hát.
 * GET  ?songId=xxx → Lấy settings + history
 * POST             → Lưu settings mới
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

define('SESSIONS_DIR', __DIR__ . '/../storage/data/sessions/');
if (!is_dir(SESSIONS_DIR)) mkdir(SESSIONS_DIR, 0775, true);

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $songId = $_GET['songId'] ?? '';
    if (!$songId) { http_response_code(400); echo json_encode(['error' => 'Missing songId']); exit; }

    $data = _readSession($songId);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} elseif ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $songId = $body['songId'] ?? '';

    if (!$songId) { http_response_code(400); echo json_encode(['error' => 'Missing songId']); exit; }

    $userSettings = $body['userSettings'] ?? [];
    $data = _writeSession($songId, $userSettings);
    echo json_encode(['success' => true, 'userSettings' => $data], JSON_UNESCAPED_UNICODE);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

// ---- FUNCTIONS ----

function _sessionFile(string $songId): string {
    // Sanitize filename
    $safe = preg_replace('/[^a-z0-9\-_]/', '', strtolower($songId));
    return SESSIONS_DIR . $safe . '.json';
}

function _readSession(string $songId): array {
    $file = _sessionFile($songId);
    if (!file_exists($file)) {
        return [
            'songId'       => $songId,
            'userSettings' => _defaultSettings(),
        ];
    }
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data)) return ['songId' => $songId, 'userSettings' => _defaultSettings()];

    // Ensure structure
    if (!isset($data['userSettings'])) $data['userSettings'] = _defaultSettings();
    return $data;
}

function _writeSession(string $songId, array $userSettings): array {
    $file = _sessionFile($songId);

    // Merge với existing data để preserve history
    $existing = _readSession($songId);
    $merged   = array_merge($existing['userSettings'], $userSettings);

    // Keep history sorted chronologically, max 50 entries
    if (isset($merged['history']) && is_array($merged['history'])) {
        usort($merged['history'], fn($a,$b) => strcmp($a['date'] ?? '', $b['date'] ?? ''));
        $merged['history'] = array_slice($merged['history'], -50);
    }

    $data = [
        'songId'       => $songId,
        'lastSaved'    => date('c'),
        'userSettings' => $merged,
    ];

    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return $merged;
}

function _defaultSettings(): array {
    return [
        'lastTranspose'  => 0,
        'zoomLevel'      => 1.0,
        'chordOverrides' => [],
        'history'        => [],
    ];
}
