<?php
/**
 * tools/setup_hd_sets.php
 * Tạo bộ hợp âm "HD" rỗng cho tất cả bài hát qua WEB (không cần PHP CLI).
 * Truy cập: http://yourdomain/sheetapp/tools/setup_hd_sets.php
 *
 * BẢO MẬT: Xóa hoặc đổi tên file này sau khi chạy xong!
 */
header('Content-Type: text/plain; charset=utf-8');

// Khóa đơn giản tránh chạy tùy tiện
$secret = $_GET['key'] ?? '';
if ($secret !== 'setup2025hd') {
    http_response_code(403);
    echo "Forbidden. Thêm ?key=setup2025hd vào URL.";
    exit;
}

require_once __DIR__ . '/../api/db.php';

$BASE_DIR   = __DIR__ . '/../data/chord_sets';
$SET_NAME   = 'HD';
$EMPTY_JSON = '[]';

echo "=== Tạo bộ hợp âm HD cho tất cả bài hát ===\n\n";

$stmt  = $pdo->query("SELECT id FROM songs ORDER BY id ASC");
$songs = $stmt->fetchAll(PDO::FETCH_COLUMN);
$total = count($songs);
echo "Tổng số bài: $total\n\n";

$created = 0;
$skipped = 0;
$errors  = 0;

foreach ($songs as $songId) {
    $safeSong = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
    $dir      = $BASE_DIR . '/' . $safeSong;

    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            echo "  [ERROR] Không tạo được thư mục: $dir\n";
            $errors++;
            continue;
        }
    }

    $file = $dir . '/' . $SET_NAME . '.json';

    if (file_exists($file)) {
        $skipped++;
        continue;
    }

    if (file_put_contents($file, $EMPTY_JSON) !== false) {
        echo "  [OK]    $songId\n";
        $created++;
    } else {
        echo "  [ERROR] $songId — Không ghi được file\n";
        $errors++;
    }
}

echo "\n=== KẾT QUẢ ===\n";
echo "  Tạo mới : $created\n";
echo "  Bỏ qua  : $skipped (đã tồn tại)\n";
echo "  Lỗi     : $errors\n";
echo "  Tổng    : $total bài\n";
echo "\nHoàn thành! Hãy xóa file này sau khi chạy.\n";
