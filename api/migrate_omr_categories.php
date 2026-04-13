<?php
/**
 * api/migrate_omr_categories.php
 * Script tự động chạy 1 lần để cấu trúc DB cho OMR + Categories
 */
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

try {
    // 1. Tạo bảng categories
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            slug TEXT NOT NULL UNIQUE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    // 2. Chèn Category mặc định
    $stmt = $pdo->prepare("INSERT OR IGNORE INTO categories (id, name, slug) VALUES (1, 'Thánh ca', 'thanh-ca')");
    $stmt->execute();

    // 3. Thêm cột category_id vào songs nếu chưa có
    try {
        $pdo->exec("ALTER TABLE songs ADD COLUMN category_id INTEGER DEFAULT 1");
    } catch (\PDOException $e) {
        // Có thể cột đã tồn tại (bỏ qua lỗi)
        // Lỗi phổ biến: "duplicate column name: category_id"
    }

    // Gán category_id=1 cho toàn bộ bài đang có nếu chưa có (Tránh trường hợp bị NULL cũ)
    $pdo->exec("UPDATE songs SET category_id = 1 WHERE category_id IS NULL");

    // 4. Tạo bảng omr_workspace
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS omr_workspace (
            id TEXT PRIMARY KEY,
            original_filename TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'waiting', -- waiting, processing, completed, error
            musicxml_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    ");

    echo json_encode([
        'success' => true,
        'message' => 'Migrate OMR Categories thành công!',
    ], JSON_UNESCAPED_UNICODE);

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Lỗi Migrate DB: ' . $e->getMessage()]);
}
