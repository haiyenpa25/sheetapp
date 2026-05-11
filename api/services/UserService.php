<?php
/**
 * api/services/UserService.php
 */
require_once __DIR__ . '/../core/DB.php';

class UserService {
    public static function getAll(): array {
        return DB::query("SELECT id, username, role, created_at FROM users ORDER BY created_at DESC");
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
