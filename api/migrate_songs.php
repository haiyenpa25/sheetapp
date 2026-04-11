<?php
// api/migrate_songs.php
// Đọc storage/data/songs.json và Insert vào SQLite bảng `songs`
require_once __DIR__ . '/db.php';

$jsonFile = __DIR__ . '/../storage/data/songs.json';
$bakFile = __DIR__ . '/../storage/data/songs.json.bak';

if (!file_exists($jsonFile)) {
    die("Không tìm thấy storage/data/songs.json. Có thể đã di cư trước đó rồi.");
}

$jsonData = file_get_contents($jsonFile);
$songs = json_decode($jsonData, true);

if (!is_array($songs)) {
    die("Dữ liệu JSON không hợp lệ.");
}

$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare("INSERT OR REPLACE INTO songs (id, title, httlvnId, xmlPath, defaultKey) VALUES (?, ?, ?, ?, ?)");
    $count = 0;
    foreach ($songs as $s) {
        $id = $s['id'] ?? '';
        $title = $s['title'] ?? 'Không tên';
        $hId = isset($s['httlvnId']) && $s['httlvnId'] !== '' ? intval($s['httlvnId']) : null;
        $xmlPath = $s['xmlPath'] ?? '';
        $defaultKey = $s['defaultKey'] ?? null;
        
        if ($id && $xmlPath) {
            $stmt->execute([$id, $title, $hId, $xmlPath, $defaultKey]);
            $count++;
        }
    }
    $pdo->commit();
    echo "<h3>Thành công! Đã chèn {$count} bài hát vào Cơ sở dữ liệu SQLite bảng `songs`.</h3>";

    // Đổi tên file để tránh đụng độ
    if (rename($jsonFile, $bakFile)) {
        echo "<p>Đã đổi tên file `songs.json` thành `songs.json.bak` an toàn.</p>";
    } else {
        echo "<p>Cảnh báo: Không thể đổi tên file `songs.json`.</p>";
    }

} catch (PDOException $e) {
    $pdo->rollBack();
    die("Lỗi Database trong quá trình di cư: " . $e->getMessage());
}
