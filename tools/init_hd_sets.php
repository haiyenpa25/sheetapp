<?php
/**
 * tools/init_hd_sets.php — Migration: Tạo bộ HD rỗng cho TẤT CẢ bài hát
 *
 * RULE: Mọi bài đều có bộ "HD" (dù rỗng) để:
 *   1. ChordCanvas luôn có HD làm set mặc định khi load
 *   2. User không cần tạo thủ công cho từng bài
 *   3. TLH (gốc) vẫn hiện khi HD rỗng — không mất hợp âm
 *
 * Chạy 1 lần: truy cập http://localhost/SheetApp/tools/init_hd_sets.php
 * (Chỉ admin mới nên chạy — thêm auth nếu cần)
 */

$DB_PATH   = __DIR__ . '/../data/songs.db';
$SETS_DIR  = __DIR__ . '/../data/chord_sets';

// ───── Kết nối SQLite ─────
if (!file_exists($DB_PATH)) {
    die(json_encode(['error' => 'Không tìm thấy songs.db']));
}

$pdo = new PDO("sqlite:$DB_PATH");
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// ───── Lấy danh sách tất cả songId ─────
$stmt = $pdo->query("SELECT id FROM songs ORDER BY id");
$songs = $stmt->fetchAll(PDO::FETCH_COLUMN);

$created = 0;
$existed = 0;
$errors  = [];

foreach ($songs as $songId) {
    // Safe filename giống chord_sets.php
    $safeSongId = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
    $songDir    = $SETS_DIR . '/' . $safeSongId;

    if (!is_dir($songDir)) {
        mkdir($songDir, 0755, true);
    }

    // Safe name cho "HD"
    $safeHD  = preg_replace('/[^a-zA-Z0-9_\-\p{L}]/u', '_', 'HD');
    $hdFile  = $songDir . '/' . $safeHD . '.json';

    if (!file_exists($hdFile)) {
        // Tạo file HD rỗng (empty array = chưa có hợp âm)
        $ok = file_put_contents($hdFile, json_encode([], JSON_PRETTY_PRINT));
        if ($ok !== false) {
            $created++;
        } else {
            $errors[] = "Không ghi được: $hdFile";
        }
    } else {
        $existed++;
    }
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'success'  => true,
    'message'  => "Hoàn tất! Đã tạo $created bộ HD mới, $existed đã tồn tại.",
    'created'  => $created,
    'existed'  => $existed,
    'total'    => count($songs),
    'errors'   => $errors,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
