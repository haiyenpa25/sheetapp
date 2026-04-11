<?php
// api/db.php
// Tích hợp SQLite Database
$dbFile = __DIR__ . '/../storage/data/app.sqlite';

try {
    $pdo = new PDO('sqlite:' . $dbFile);
    // Kích hoạt thông báo báo lỗi ngoại lệ
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON;');
} catch (PDOException $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}
