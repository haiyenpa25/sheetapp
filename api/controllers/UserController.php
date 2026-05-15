<?php
/**
 * api/controllers/UserController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/UserService.php';

class UserController {
    public function handleRequest(string $method): void {
        Auth::requireAdmin();

        try {
            switch ($method) {
                case 'GET':
                    Response::ok(['users' => UserService::getAll()]);
                    break;

                case 'POST':
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    $username = trim($body['username'] ?? '');
                    $password = $body['password'] ?? '';
                    $role = $body['role'] ?? 'viewer';

                    if (empty($username) || empty($password)) {
                        Response::error('Vui lòng nhập tên đăng nhập và mật khẩu.');
                        return;
                    }

                    try {
                        $id = UserService::create($username, $password, $role);
                        Response::ok(['id' => $id]);
                    } catch (PDOException $e) {
                        if ($e->getCode() == 23000) {
                            Response::error('Tên đăng nhập này đã tồn tại.');
                        } else {
                            throw $e;
                        }
                    }
                    break;

                case 'PUT':
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    $id = (int)($body['id'] ?? 0);
                    $role = $body['role'] ?? null;
                    $password = $body['password'] ?? null;

                    if (!$id) {
                        Response::error('Thiếu ID người dùng');
                        return;
                    }

                    if ($role) {
                        UserService::updateRole($id, $role);
                    }
                    if ($password) {
                        UserService::updatePassword($id, $password);
                    }
                    Response::ok();
                    break;

                case 'DELETE':
                    $id = (int)($_GET['id'] ?? 0);
                    if (!$id || $id === Auth::userId()) {
                        Response::error('Không thể xoá tài khoản này.');
                        return;
                    }

                    UserService::delete($id);
                    Response::ok();
                    break;

                default:
                    Response::methodNotAllowed();
            }
        } catch (Exception $e) {
            Response::error('Lỗi Server: ' . $e->getMessage(), 500);
        }
    }
}
