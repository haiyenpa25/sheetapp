<?php
/**
 * api/services/UserService.php
 */
require_once __DIR__ . '/../core/DB.php';

class UserService {
    public static function getAll(): array {
        return DB::query("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC");
    }

    /**
     * T\u00ecm user theo username (d\u00f9ng cho AuthController login).
     * Tr\u1ea3 false n\u1ebfu kh\u00f4ng t\u00ecm th\u1ea5y.
     */
    public static function findByUsername(string $username): array|false {
        return DB::run(
            "SELECT id, username, password_hash, role FROM users WHERE username = ?",
            [$username]
        )->fetch();
    }

    public static function create(string $username, string $password, string $role): int {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        DB::run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [$username, $hash, $role]);
        return (int)DB::lastId();
    }

    public static function updateRole(int $id, string $role): void {
        DB::run("UPDATE users SET role = ? WHERE id = ?", [$role, $id]);
    }

    public static function updatePassword(int $id, string $password): void {
        $hash = password_hash($password, PASSWORD_DEFAULT);
        DB::run("UPDATE users SET password_hash = ? WHERE id = ?", [$hash, $id]);
    }

    public static function delete(int $id): void {
        DB::run("DELETE FROM users WHERE id = ?", [$id]);
    }
}
