<?php
// migrate_setlists.php
require_once __DIR__ . '/api/db.php';

try {
    // Thêm cột transpose_key vào setlist_items nếu chưa có
    $pdo->exec("ALTER TABLE setlist_items ADD COLUMN transpose_key INTEGER DEFAULT 0");
    echo "Thêm cột transpose_key thành công!\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'duplicate column name') !== false) {
         echo "Cột transpose_key đã tồn tại.\n";
    } else {
         echo "Lỗi: " . $e->getMessage() . "\n";
    }
}
