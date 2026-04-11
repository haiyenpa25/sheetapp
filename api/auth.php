<?php
// api/auth.php
session_start();
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

$action = $_GET['action'] ?? '';

if ($action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';

    $stmt = $pdo->prepare("SELECT id, username, password_hash, role FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password_hash'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['role'] = $user['role'];

        echo json_encode(['success' => true, 'role' => $user['role'], 'username' => $user['username']]);
    } else {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Sai tài khoản hoặc mật khẩu']);
    }
} elseif ($action === 'logout') {
    session_destroy();
    echo json_encode(['success' => true]);
} elseif ($action === 'me') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'loggedIn' => true,
            'username' => $_SESSION['username'],
            'role' => $_SESSION['role']
        ]);
    } else {
        echo json_encode([
            'loggedIn' => false,
            'role' => 'viewer'
        ]);
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid action']);
}
