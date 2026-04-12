<?php
require_once __DIR__ . '/db.php';

try {
    $pdo->exec("ALTER TABLE setlist_items ADD COLUMN transpose_key INTEGER DEFAULT 0;");
    echo "<h1>Thanh cong! Da them cot transpose_key.</h1> <p>Ban co the xoa file nay di.</p>";
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'duplicate column name') !== false) {
         echo "<h1>Cot transpose_key da ton tai rọi! Ban khong can sua gi then.</h1>";
    } else {
         echo "<h1>Loi: " . $e->getMessage() . "</h1>";
    }
}
