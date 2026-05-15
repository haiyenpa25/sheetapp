<?php
/**
 * api/migrate_role.php
 * Script 1 lần: đổi role user 'banhat' thành 'banhat' role.
 * ⚠️ XÓA FILE NÀY SAU KHI CHẠY!
 */
require_once __DIR__ . '/core/DB.php';

// Bảo vệ: chỉ chạy từ localhost hoặc có secret key
$secret = $_GET['key'] ?? '';
if ($secret !== 'sheet_migrate_2026') {
    http_response_code(403);
    die('Forbidden. Thêm ?key=sheet_migrate_2026 vào URL.');
}

try {
    $pdo = DB::get();

    // 1. Cập nhật user 'banhat' → role 'banhat'
    $stmt = $pdo->prepare("UPDATE users SET role = 'banhat' WHERE username = 'banhat' AND role != 'admin'");
    $stmt->execute();
    $changed = $stmt->rowCount();

    // 2. Hiển thị danh sách users hiện tại
    $users = $pdo->query("SELECT id, username, role, created_at FROM users ORDER BY id")->fetchAll(PDO::FETCH_ASSOC);

    echo '<style>body{font-family:sans-serif;padding:2rem;} table{border-collapse:collapse;} td,th{border:1px solid #ccc;padding:8px 16px;} .ok{color:green;} .warn{color:orange;}</style>';
    echo '<h2>🔧 Migration: Phân quyền role</h2>';

    if ($changed > 0) {
        echo "<p class='ok'>✅ Đã đổi user <b>banhat</b> → role <b>banhat</b></p>";
    } else {
        echo "<p class='warn'>ℹ️ Không đổi (user 'banhat' có thể đang là admin hoặc đã là banhat)</p>";
    }

    echo '<h3>Danh sách users hiện tại:</h3>';
    echo '<table><tr><th>ID</th><th>Username</th><th>Role</th><th>Created</th></tr>';
    foreach ($users as $u) {
        $color = $u['role'] === 'admin' ? '#fef3c7' : ($u['role'] === 'banhat' ? '#d1fae5' : '#f3f4f6');
        echo "<tr style='background:{$color}'><td>{$u['id']}</td><td><b>{$u['username']}</b></td><td>{$u['role']}</td><td>{$u['created_at']}</td></tr>";
    }
    echo '</table>';
    echo '<br><p style="color:red;font-weight:bold;">⚠️ Hãy xóa file này ngay sau khi chạy xong:<br><code>rm ~/public_html/api/migrate_role.php</code></p>';

} catch (Exception $e) {
    echo 'Lỗi: ' . $e->getMessage();
}
