<?php
/**
 * api/controllers/AuthController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/UserService.php';

class AuthController {
    public function handleRequest(string $method): void {
        $action = $_GET['action'] ?? '';

        switch ($action) {
            case 'login':
                $data     = json_decode(file_get_contents('php://input'), true) ?? [];
                $username = trim($data['username'] ?? '');
                $password = $data['password'] ?? '';
                if (!$username || !$password) { Response::error('Thiếu username/password'); return; }

                // Business logic ở UserService, không SQL trong Controller
                $user = UserService::findByUsername($username);
                if ($user && password_verify($password, $user['password_hash'])) {
                    $_SESSION['user_id']  = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['role']     = $user['role'];
                    Response::ok(['role' => $user['role'], 'username' => $user['username']]);
                } else {
                    Response::error('Sai tài khoản hoặc mật khẩu', 401);
                }
                break;

            case 'logout':
                session_destroy();
                Response::ok();
                break;

            case 'me':
                if (Auth::isLoggedIn()) {
                    Response::ok(['loggedIn' => true, 'username' => Auth::username(), 'role' => $_SESSION['role']]);
                } else {
                    // INTENTIONAL: trả {loggedIn: false} dù không có session
                    Response::ok(['loggedIn' => false, 'role' => 'viewer']);
                }
                break;

            default:
                Response::error('Invalid action');
        }
    }
}
