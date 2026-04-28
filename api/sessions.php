<?php
/**
 * api/sessions.php
 * Lưu trữ nhật ký biểu diễn theo từng bài hát.
 *
 * GET  ?songId=xxx → Lấy settings + perfNotes (public, không cần auth)
 * POST             → Lưu userSettings hoặc perfNotes
 *
 * Cấu trúc JSON file:
 * {
 *   "songId":      "...",
 *   "lastSaved":   "ISO date",
 *   "userSettings": { lastTranspose, zoomLevel, history },
 *   "perfNotes":   { key, bpm, text, updatedAt }   ← field mới
 * }
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
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $songId = $body['songId'] ?? '';

    if (!$songId) { http_response_code(400); echo json_encode(['error' => 'Missing songId']); exit; }

    $result = [];

    /* Lưu userSettings nếu có */
    if (isset($body['userSettings'])) {
        $result['userSettings'] = _writeUserSettings($songId, $body['userSettings']);
    }

    /* Lưu perfNotes nếu có */
    if (isset($body['perfNotes'])) {
        $result['perfNotes'] = _writePerfNotes($songId, $body['perfNotes']);
    }

    echo json_encode(array_merge(['success' => true], $result), JSON_UNESCAPED_UNICODE);

} else {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
}

// ── FUNCTIONS ──────────────────────────────────────────────────

function _sessionFile(string $songId): string {
    // Giữ prefix dễ đọc + hash để unique (tránh collision khi songId chứa unicode)
    $prefix = preg_replace('/[^a-z0-9\-]/', '', strtolower(substr($songId, 0, 30)));
    $hash   = substr(md5($songId), 0, 8);
    $name   = $prefix ? "{$prefix}_{$hash}" : $hash;
    return SESSIONS_DIR . $name . '.json';
}

function _readSession(string $songId): array {
    $file = _sessionFile($songId);
    if (!file_exists($file)) {
        return [
            'songId'       => $songId,
            'userSettings' => _defaultSettings(),
            'perfNotes'    => (object)[],
        ];
    }
    $data = json_decode(file_get_contents($file), true);
    if (!is_array($data)) {
        return ['songId' => $songId, 'userSettings' => _defaultSettings(), 'perfNotes' => (object)[]];
    }
    // Ensure fields exist
    if (!isset($data['userSettings'])) $data['userSettings'] = _defaultSettings();
    if (!isset($data['perfNotes']))    $data['perfNotes']    = (object)[];
    return $data;
}

function _writeUserSettings(string $songId, array $userSettings): array {
    $file     = _sessionFile($songId);
    $existing = _readSession($songId);
    $merged   = array_merge($existing['userSettings'], $userSettings);

    if (isset($merged['history']) && is_array($merged['history'])) {
        usort($merged['history'], fn($a,$b) => strcmp($a['date'] ?? '', $b['date'] ?? ''));
        $merged['history'] = array_slice($merged['history'], -50);
    }

    $data = array_merge($existing, [
        'lastSaved'    => date('c'),
        'userSettings' => $merged,
    ]);

    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return $merged;
}

function _writePerfNotes(string $songId, array $perfNotes): array {
    $file     = _sessionFile($songId);
    $existing = _readSession($songId);

    // Sanitize input — chỉ cho phép các field đã biết
    $safe = [
        'key'       => substr(trim($perfNotes['key']       ?? ''), 0, 20),
        'bpm'       => substr(trim($perfNotes['bpm']       ?? ''), 0, 10),
        'text'      => substr(trim($perfNotes['text']      ?? ''), 0, 2000),
        'updatedAt' => $perfNotes['updatedAt'] ?? date('c'),
    ];

    $data = array_merge($existing, [
        'lastSaved' => date('c'),
        'perfNotes' => $safe,
    ]);

    file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return $safe;
}

function _defaultSettings(): array {
    return [
        'lastTranspose'  => 0,
        'zoomLevel'      => 1.0,
        'chordOverrides' => [],
        'history'        => [],
    ];
}
