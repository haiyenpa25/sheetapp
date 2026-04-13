<?php
/**
 * api/songs.php
 * CRUD API cho thư viện bài hát (Chạy bằng SQLite `songs`)
 * GET    → List all songs
 * POST   → Add new song
 * PUT    → Update song
 * DELETE → Delete song
 */
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/db.php';

define('SESSIONS_DIR',  __DIR__ . '/../storage/data/sessions/');
define('SHEETS_DIR',    __DIR__ . '/../storage/Thanh ca/');
foreach ([SESSIONS_DIR, SHEETS_DIR] as $dir) {
    if (!is_dir($dir)) mkdir($dir, 0775, true);
}

$method = $_SERVER['REQUEST_METHOD'];
$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';

try {
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("
                SELECT s.id, s.title, s.httlvnId, s.xmlPath, s.defaultKey, s.category_id, c.name as category_name 
                FROM songs s 
                LEFT JOIN categories c ON s.category_id = c.id 
                ORDER BY s.httlvnId ASC, s.title ASC
            ");
            $songs = $stmt->fetchAll();
            echo json_encode($songs, JSON_UNESCAPED_UNICODE);
            break;

        case 'POST':
            if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'Chỉ Admin mới có quyền thêm bài hát']); exit; }
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            echo json_encode(_addSong($pdo, $body), JSON_UNESCAPED_UNICODE);
            break;

        case 'PUT':
            if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'Chỉ Admin mới có quyền sửa']); exit; }
            $id = $_GET['id'] ?? null;
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            echo json_encode(_updateSong($pdo, $id, $body), JSON_UNESCAPED_UNICODE);
            break;

        case 'DELETE':
            if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'Chỉ Admin mới có quyền xóa']); exit; }
            $id = $_GET['id'] ?? null;
            echo json_encode(_deleteSong($pdo, $id), JSON_UNESCAPED_UNICODE);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Lỗi Database: ' . $e->getMessage()]);
}

// ---- FUNCTIONS ----

function _addSong(PDO $pdo, array $data): array {
    $id = _slugify($data['title'] ?? 'bai-hat-' . time());
    
    // Check trùng ID
    $baseId = $id;
    $counter = 1;
    while (true) {
        $check = $pdo->prepare("SELECT COUNT(*) FROM songs WHERE id = ?");
        $check->execute([$id]);
        if ($check->fetchColumn() == 0) break;
        $id = $baseId . '-' . $counter++;
    }

    $title = $data['title'] ?? 'Bài hát mới';
    $xmlPath = $data['xmlPath'] ?? '';
    $defaultKey = $data['defaultKey'] ?? '';
    $httlvnId = isset($data['httlvnId']) && $data['httlvnId'] !== '' ? intval($data['httlvnId']) : null;
    $categoryId = isset($data['categoryId']) ? intval($data['categoryId']) : 1; // Default to 1 (Thánh ca)

    $stmt = $pdo->prepare("INSERT INTO songs (id, title, httlvnId, xmlPath, defaultKey, category_id) VALUES (?, ?, ?, ?, ?, ?)");
    $stmt->execute([$id, $title, $httlvnId, $xmlPath, $defaultKey, $categoryId]);

    return [
        'id' => $id,
        'title' => $title,
        'xmlPath' => $xmlPath,
        'defaultKey' => $defaultKey,
        'httlvnId' => $httlvnId,
        'category_id' => $categoryId
    ];
}

function _updateSong(PDO $pdo, ?string $id, array $data): array {
    if (!$id) { http_response_code(400); return ['error' => 'Missing id']; }

    $fields = [];
    $params = [];
    if (isset($data['title'])) { $fields[] = 'title = ?'; $params[] = $data['title']; }
    if (isset($data['defaultKey'])) { $fields[] = 'defaultKey = ?'; $params[] = $data['defaultKey']; }
    if (isset($data['xmlPath'])) { $fields[] = 'xmlPath = ?'; $params[] = $data['xmlPath']; }
    if (isset($data['categoryId'])) { $fields[] = 'category_id = ?'; $params[] = intval($data['categoryId']); }

    if (empty($fields)) {
        return ['error' => 'No data to update'];
    }

    $params[] = $id;
    $sql = "UPDATE songs SET " . implode(', ', $fields) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    if ($stmt->rowCount() === 0) {
        http_response_code(404); return ['error' => 'Song not found'];
    }

    $get = $pdo->prepare("SELECT * FROM songs WHERE id = ?");
    $get->execute([$id]);
    return $get->fetch() ?: [];
}

function _deleteSong(PDO $pdo, ?string $id): array {
    if (!$id) { http_response_code(400); return ['error' => 'Missing id']; }

    $get = $pdo->prepare("SELECT xmlPath FROM songs WHERE id = ?");
    $get->execute([$id]);
    $song = $get->fetch();

    if (!$song) { http_response_code(404); return ['error' => 'Song not found']; }

    // Xóa khỏi Database (Bảng setlist_items cũng sẽ bị xóa nếu có FOREIGN KEY CASCADE)
    $stmt = $pdo->prepare("DELETE FROM songs WHERE id = ?");
    $stmt->execute([$id]);

    // Xoá file XML vật lý
    if (!empty($song['xmlPath'])) {
        $xmlFile = __DIR__ . '/../' . $song['xmlPath'];
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
