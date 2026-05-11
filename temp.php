<?php
$db = new PDO('sqlite:' . __DIR__ . '/storage/data/app.sqlite');
$stmt = $db->prepare("SELECT xmlPath FROM songs WHERE id LIKE '%thanh-ca-001%'");
$stmt->execute();
$res = $stmt->fetch(PDO::FETCH_ASSOC);
if ($res) {
    echo file_get_contents(__DIR__ . '/' . $res['xmlPath']);
} else {
    echo "Not found";
}
