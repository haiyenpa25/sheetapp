<?php
/**
 * api/songs.php
 * CRUD API cho thư viện bài hát.
 * GET    → List all songs
 * POST   → Add new song
 * PUT    → Update song
 * DELETE → Delete song
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

define('SONGS_FILE',    __DIR__ . '/../storage/data/songs.json');
define('SESSIONS_DIR',  __DIR__ . '/../storage/data/sessions/');
define('SHEETS_DIR',    __DIR__ . '/../storage/Thanh ca/');

// Ensure dirs exist
foreach ([dirname(SONGS_FILE), SESSIONS_DIR, SHEETS_DIR] as $dir) {
    if (!is_dir($dir)) mkdir($dir, 0775, true);
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        echo json_encode(_readSongs(), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        break;

    case 'POST':
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $song = _addSong($body);
        echo json_encode($song, JSON_UNESCAPED_UNICODE);
        break;

    case 'PUT':
        $id   = $_GET['id'] ?? null;
        $body = json_decode(file_get_contents('php://input'), true) ?? [];
        $song = _updateSong($id, $body);
        echo json_encode($song, JSON_UNESCAPED_UNICODE);
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;
        echo json_encode(_deleteSong($id), JSON_UNESCAPED_UNICODE);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

// ---- FUNCTIONS ----

function _readSongs(): array {
    if (!file_exists(SONGS_FILE)) return [];
    $data = json_decode(file_get_contents(SONGS_FILE), true);
    return is_array($data) ? $data : [];
}

function _writeSongs(array $songs): void {
    file_put_contents(SONGS_FILE, json_encode(array_values($songs), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function _addSong(array $data): array {
    $songs = _readSongs();

    // Generate ID từ title
    $id = _slugify($data['title'] ?? 'bai-hat-' . time());
    // Đảm bảo ID unique
    $baseId = $id;
    $counter = 1;
    $existingIds = array_column($songs, 'id');
    while (in_array($id, $existingIds)) {
        $id = $baseId . '-' . $counter++;
    }

    $song = [
        'id'         => $id,
        'title'      => $data['title']      ?? 'Bài hát mới',
        'xmlPath'    => $data['xmlPath']     ?? '',
        'defaultKey' => $data['defaultKey'] ?? '',
        'source'     => $data['source']     ?? '',
        'dateAdded'  => date('Y-m-d'),
    ];

    array_unshift($songs, $song); // Thêm vào đầu danh sách
    _writeSongs($songs);
    return $song;
}

function _updateSong(?string $id, array $data): array {
    if (!$id) { http_response_code(400); return ['error' => 'Missing id']; }

    $songs = _readSongs();
    foreach ($songs as &$song) {
        if ($song['id'] === $id) {
            $song = array_merge($song, array_intersect_key($data, array_flip(['title','defaultKey','xmlPath'])));
            _writeSongs($songs);
            return $song;
        }
    }
    http_response_code(404);
    return ['error' => 'Song not found'];
}

function _deleteSong(?string $id): array {
    if (!$id) { http_response_code(400); return ['error' => 'Missing id']; }

    $songs = _readSongs();
    $found = null;
    $songs = array_filter($songs, function($s) use ($id, &$found) {
        if ($s['id'] === $id) { $found = $s; return false; }
        return true;
    });

    if (!$found) { http_response_code(404); return ['error' => 'Song not found']; }

    _writeSongs($songs);

    // Xoá file XML nếu trong storage của ta
    if (!empty($found['xmlPath'])) {
        $xmlFile = __DIR__ . '/../' . $found['xmlPath'];
        if (file_exists($xmlFile)) @unlink($xmlFile);
    }

    // Xoá session file
    $sessionFile = SESSIONS_DIR . $id . '.json';
    if (file_exists($sessionFile)) @unlink($sessionFile);

    return ['success' => true, 'id' => $id];
}

function _slugify(string $text): string {
    $text = mb_strtolower($text, 'UTF-8');
    $replacements = [
        'à','á','â','ã','ä','å','æ','ç','è','é','ê','ë',
        'ì','í','î','ï','ð','ñ','ò','ó','ô','õ','ö','ø',
        'ù','ú','û','ü','ý','þ','ÿ',
        // Vietnamese
        'à','á','ả','ã','ạ','ă','ắ','ặ','ằ','ẳ','ẵ','â','ấ','ậ','ầ','ẩ','ẫ',
        'đ','è','é','ẻ','ẽ','ẹ','ê','ế','ệ','ề','ể','ễ',
        'ì','í','ỉ','ĩ','ị','ò','ó','ỏ','õ','ọ','ô','ố','ộ','ồ','ổ','ỗ',
        'ơ','ớ','ợ','ờ','ở','ỡ','ù','ú','ủ','ũ','ụ','ư','ứ','ự','ừ','ử','ữ',
        'ỳ','ý','ỷ','ỹ','ỵ',
    ];
    $latin = [
        'a','a','a','a','a','a','ae','c','e','e','e','e',
        'i','i','i','i','d','n','o','o','o','o','o','o',
        'u','u','u','u','y','th','y',
        'a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a',
        'd','e','e','e','e','e','e','e','e','e','e','e',
        'i','i','i','i','i','o','o','o','o','o','o','o','o','o','o','o',
        'o','o','o','o','o','o','u','u','u','u','u','u','u','u','u','u','u',
        'y','y','y','y','y',
    ];
    $text = str_replace($replacements, $latin, $text);
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', trim($text));
    return substr($text, 0, 80);
}
