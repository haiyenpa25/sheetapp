<?php
// api/init_db.php
// Chạy file này 1 lần duy nhất từ trình duyệt để khởi tạo Database SQLite

require_once __DIR__ . '/db.php';

try {
    // 1. Tạo bảng users
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    // 2. Tạo bảng songs (Danh mục kho nhạc)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS songs (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            httlvnId INTEGER,
            xmlPath TEXT NOT NULL,
            defaultKey TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ");

    // 3. Tạo bảng setlists
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS setlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            created_by INTEGER,
            scheduled_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    ");

    // 3. Tạo bảng setlist_items
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS setlist_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            setlist_id INTEGER NOT NULL,
            song_id TEXT NOT NULL,
            display_order INTEGER NOT NULL,
            chord_profile TEXT,
            FOREIGN KEY (setlist_id) REFERENCES setlists(id) ON DELETE CASCADE
        )
    ");

    // 4. Tạo tài khoản mặc định (nếu chưa có)
    $stmt = $pdo->query("SELECT COUNT(*) FROM users");
    $count = $stmt->fetchColumn();

    if ($count == 0) {
        $defaultUser = 'banhat';
        $defaultPass = '123456';
        $hash = password_hash($defaultPass, PASSWORD_DEFAULT);
        
        $insert = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)");
        $insert->execute([$defaultUser, $hash, 'admin']);
        echo "<p>Đã tạo tài khoản mặc định: <b>{$defaultUser}</b> / <b>{$defaultPass}</b> (Quyền: Admin)</p>";
    }

    // 5. Khoá tải file SQLite qua .htaccess
    $htaccessPath = __DIR__ . '/../storage/data/.htaccess';
    $htaccessRule = "<FilesMatch \"\\.(sqlite|json|db)$\">\nOrder allow,deny\nDeny from all\n</FilesMatch>";
    
    // Ngoại lệ: Nếu có folder chord_sets là file tĩnh có thể đang bị chặn, ta chỉ cản file đuôi sqlite
    $htaccessRule = "<FilesMatch \"\\.sqlite$\">\nRequire all denied\n</FilesMatch>";

    if (!file_exists($htaccessPath) || strpos(file_get_contents($htaccessPath), '.sqlite') === false) {
        file_put_contents($htaccessPath, $htaccessRule . "\n", FILE_APPEND);
        echo "<p>Đã ghi file bảo vệ .htaccess để ngăn tải CSDL</p>";
    }

    echo "<h3>Quá trình khởi tạo Cơ sở dữ liệu SQLite thành công!</h3>";

} catch (PDOException $e) {
    echo "Lỗi: " . $e->getMessage();
}
