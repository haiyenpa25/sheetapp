<?php
/**
 * api/categories.php
 * CRUD API cho bảng `categories`
 */
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];
$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';

try {
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("SELECT * FROM categories ORDER BY id ASC");
            $categories = $stmt->fetchAll();
            echo json_encode($categories, JSON_UNESCAPED_UNICODE);
            break;

        case 'POST':
            if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'Chỉ Admin mới có quyền thêm']); exit; }
            $body = json_decode(file_get_contents('php://input'), true) ?? [];
            if (empty($body['name'])) { http_response_code(400); echo json_encode(['error' => 'Missing name']); exit; }
            
            $name = trim($body['name']);
            $slug = _slugify($name);
            
            $stmt = $pdo->prepare("INSERT INTO categories (name, slug) VALUES (?, ?)");
            $stmt->execute([$name, $slug]);
            
            echo json_encode(['id' => $pdo->lastInsertId(), 'name' => $name, 'slug' => $slug], JSON_UNESCAPED_UNICODE);
            break;

        case 'PUT':
        case 'DELETE':
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed for now']);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Lỗi Database: ' . $e->getMessage()]);
}

function _slugify(string $text): string {
    $text = mb_strtolower($text, 'UTF-8');
    $replacements = [
        'à','á','â','ã','ä','å','æ','ç','è','é','ê','ë',
        'ì','í','î','ï','ð','ñ','ò','ó','ô','õ','ö','ø',
        'ù','ú','û','ü','ý','þ','ÿ',
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
