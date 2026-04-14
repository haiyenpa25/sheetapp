<?php
/**
 * api/users.php
 * Endpoint quản lý người dùng (Admin only)
 */
session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

// Chỉ cho phép Admin truy cập
function checkAdmin() {
    if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
        http_response_code(403);
        echo json_encode(['error' => 'Permission denied. Admin only.']);
        exit;
    }
}

$method = $_SERVER['REQUEST_METHOD'];

// Lấy danh sách users
if ($method === 'GET') {
    checkAdmin();
    $stmt = $pdo->query("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($users);
    exit;
}

// Tạo tài khoản mới
if ($method === 'POST') {
    checkAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';
    $role = $data['role'] ?? 'viewer'; // mặc định viewer

    if (empty($username) || empty($password)) {
        http_response_code(400);
        echo json_encode(['error' => 'Vui lòng nhập tên đăng nhập và mật khẩu.']);
        exit;
    }

    try {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)");
        $stmt->execute([$username, $hash, $role]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) { // Unique constraint
            http_response_code(400);
            echo json_encode(['error' => 'Tên đăng nhập này đã tồn tại.']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
        }
    }
    exit;
}

// Cập nhật người dùng (Đổi mật khẩu / Role)
if ($method === 'PUT') {
    checkAdmin();
    $data = json_decode(file_get_contents('php://input'), true);
    $id = intval($data['id'] ?? 0);
    $role = $data['role'] ?? null;
    $password = $data['password'] ?? null;

    if (!$id) {
        http_response_code(400);
        echo json_encode(['error' => 'Thiếu ID người dùng']);
        exit;
    }

    try {
        // Cập nhật Role
        if ($role) {
            $stmt = $pdo->prepare("UPDATE users SET role = ? WHERE id = ?");
            $stmt->execute([$role, $id]);
        }
        // Cập nhật Pass
        if ($password) {
            $hash = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $stmt->execute([$hash, $id]);
        }
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Lỗi cập nhật: ' . $e->getMessage()]);
    }
    exit;
}

// Xoá người dùng
if ($method === 'DELETE') {
    checkAdmin();
    $id = intval($_GET['id'] ?? 0);
    if (!$id || $id == $_SESSION['user_id']) { // Không cho tự sát
        http_response_code(400);
        echo json_encode(['error' => 'Không thể xoá tài khoản này.']);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
