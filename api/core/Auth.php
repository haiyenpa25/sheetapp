<?php
/**
 * api/core/Auth.php — Session auth helpers
 */
class Auth {
    public static function isAdmin(): bool {
        return (isset($_SESSION['role']) && $_SESSION['role'] === 'admin');
    }

    public static function isLoggedIn(): bool {
        return isset($_SESSION['user_id']);
    }

    public static function userId(): ?int {
        return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    }

    public static function username(): string {
        return $_SESSION['username'] ?? '';
    }

    public static function requireAdmin(): void {
        if (!self::isAdmin()) {
            Response::forbidden('Chỉ Admin mới có quyền thực hiện');
            exit;
        }
    }

    public static function requireLogin(): void {
        if (!self::isLoggedIn()) {
            Response::forbidden('Cần đăng nhập');
            exit;
        }
    }
}
