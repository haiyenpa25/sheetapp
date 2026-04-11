<?php
// api/setlists.php
session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';

try {
    if ($method === 'GET' && empty($action)) {
        if ($id > 0) {
            // Lấy chi tiết 1 setlist kèm theo danh sách bài hát
            $stmt = $pdo->prepare("SELECT * FROM setlists WHERE id = ?");
            $stmt->execute([$id]);
            $setlist = $stmt->fetch();
            if (!$setlist) {
                http_response_code(404);
                echo json_encode(['error' => 'Setlist không tồn tại']);
                exit;
            }

            $stmtItems = $pdo->prepare("SELECT * FROM setlist_items WHERE setlist_id = ? ORDER BY display_order ASC");
            $stmtItems->execute([$id]);
            $items = $stmtItems->fetchAll();
            $setlist['items'] = $items;

            echo json_encode(['success' => true, 'data' => $setlist]);
        } else {
            // Lấy danh sách all setlists
            $stmt = $pdo->query("SELECT s.*, (SELECT COUNT(*) FROM setlist_items WHERE setlist_id = s.id) as item_count FROM setlists s ORDER BY s.created_at DESC");
            $setlists = $stmt->fetchAll();
            echo json_encode(['success' => true, 'data' => $setlists]);
        }
    } elseif ($method === 'POST' && empty($action)) {
        if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'Chỉ Admin mới có quyền tạo Setlist']); exit; }
        
        $data = json_decode(file_get_contents('php://input'), true);
        $title = $data['title'] ?? 'Setlist Mới';
        $date = $data['scheduled_date'] ?? date('Y-m-d');

        $stmt = $pdo->prepare("INSERT INTO setlists (title, scheduled_date, created_by) VALUES (?, ?, ?)");
        $stmt->execute([$title, $date, $_SESSION['user_id']]);
        
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    } elseif ($method === 'DELETE' && empty($action)) {
        if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'Chỉ Admin mới có quyền xóa']); exit; }
        if ($id > 0) {
            $stmt = $pdo->prepare("DELETE FROM setlists WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['success' => true]);
        }
    } elseif ($method === 'POST' && $action === 'add_item') {
        if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'Chỉ Admin mới có quyền thêm']); exit; }
        $data = json_decode(file_get_contents('php://input'), true);
        
        $setlist_id = $data['setlist_id'] ?? 0;
        $song_id = $data['song_id'] ?? '';
        $chord_profile = $data['chord_profile'] ?? 'default';

        // Tính order_idx
        $stmtOrder = $pdo->prepare("SELECT IFNULL(MAX(display_order), 0) + 1 FROM setlist_items WHERE setlist_id = ?");
        $stmtOrder->execute([$setlist_id]);
        $order = $stmtOrder->fetchColumn();

        $stmt = $pdo->prepare("INSERT INTO setlist_items (setlist_id, song_id, display_order, chord_profile) VALUES (?, ?, ?, ?)");
        $stmt->execute([$setlist_id, $song_id, $order, $chord_profile]);
        
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    } elseif ($method === 'DELETE' && $action === 'remove_item') {
        if (!$isAdmin) { http_response_code(403); echo json_encode(['error' => 'Chỉ Admin mới có quyền xóa']); exit; }
        $item_id = $id; // truyền qua `id`
        if ($item_id > 0) {
            $stmt = $pdo->prepare("DELETE FROM setlist_items WHERE id = ?");
            $stmt->execute([$item_id]);
            echo json_encode(['success' => true]);
        }
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
