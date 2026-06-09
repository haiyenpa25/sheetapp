<?php
/**
 * migrate_bpm.php — Thêm cột bpm và beats_per_measure vào setlist_items
 * Chạy 1 lần từ trình duyệt: http://localhost:8080/SheetApp/migrate_bpm.php
 */
require_once __DIR__ . '/api/core/DB.php';
$pdo = DB::get();

$cols = $pdo->query('PRAGMA table_info(setlist_items)')->fetchAll(PDO::FETCH_ASSOC);
$names = array_column($cols, 'name');

$changed = [];
if (!in_array('bpm', $names)) {
    $pdo->exec('ALTER TABLE setlist_items ADD COLUMN bpm INTEGER DEFAULT NULL');
    $changed[] = 'bpm INTEGER DEFAULT NULL';
}
if (!in_array('beats_per_measure', $names)) {
    $pdo->exec('ALTER TABLE setlist_items ADD COLUMN beats_per_measure INTEGER DEFAULT NULL');
    $changed[] = 'beats_per_measure INTEGER DEFAULT NULL';
}

if ($changed) {
    echo '<h3 style="color:green">✅ Migration OK</h3>';
    echo '<p>Đã thêm các cột: <code>' . implode(', ', $changed) . '</code></p>';
} else {
    echo '<h3 style="color:blue">ℹ️ Không cần migration</h3>';
    echo '<p>Các cột bpm và beats_per_measure đã tồn tại.</p>';
}

// Confirm schema
$cols2 = $pdo->query('PRAGMA table_info(setlist_items)')->fetchAll(PDO::FETCH_ASSOC);
echo '<pre>';
foreach ($cols2 as $c) echo $c['name'] . " \t" . $c['type'] . ' (default: ' . $c['dflt_value'] . ")\n";
echo '</pre>';
