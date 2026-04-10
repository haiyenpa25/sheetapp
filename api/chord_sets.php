<?php
/**
 * api/chord_sets.php — CRUD cho bộ hợp âm theo người/tên
 *
 * GET  ?action=list&songId=xxx
 * GET  ?action=load&songId=xxx&name=Hoai+Dinh
 * POST action=save → body JSON: {songId, name, chords:[{measureIdx,noteIdx,chord}]}
 * POST action=delete → body JSON: {songId, name}
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Thư mục lưu chord sets (tạo nếu chưa có)
$BASE_DIR = __DIR__ . '/../data/chord_sets';

function songDir(string $songId): string {
    global $BASE_DIR;
    $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
    $dir  = $BASE_DIR . '/' . $safe;
    if (!is_dir($dir)) mkdir($dir, 0755, true);
    return $dir;
}

function setFile(string $songId, string $name): string {
    $safe = preg_replace('/[^a-zA-Z0-9_\-\p{L}]/u', '_', $name);
    return songDir($songId) . '/' . $safe . '.json';
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    $songId = trim($_GET['songId'] ?? '');

    if (!$songId) { echo json_encode(['success'=>false,'message'=>'Thiếu songId']); exit; }

    if ($action === 'list') {
        $dir   = songDir($songId);
        $files = glob($dir . '/*.json');
        $names = array_map(fn($f) => pathinfo($f, PATHINFO_FILENAME), $files ?: []);
        $names = array_map(fn($n) => str_replace('_', ' ', $n), $names);
        echo json_encode(['success'=>true,'sets'=>array_values($names)]);
        exit;
    }

    if ($action === 'load') {
        $name = trim($_GET['name'] ?? '');
        if (!$name) { echo json_encode(['success'=>false,'message'=>'Thiếu name']); exit; }
        $file = setFile($songId, $name);
        if (!file_exists($file)) {
            echo json_encode(['success'=>true,'chords'=>[]]);
            exit;
        }
        $data = json_decode(file_get_contents($file), true) ?? [];
        echo json_encode(['success'=>true,'chords'=>$data]);
        exit;
    }

    echo json_encode(['success'=>false,'message'=>'action không hợp lệ']);
    exit;
}

if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body) { echo json_encode(['success'=>false,'message'=>'Body không hợp lệ']); exit; }

    $action = $body['action'] ?? '';
    $songId = trim($body['songId'] ?? '');
    $name   = trim($body['name']   ?? '');

    if (!$songId || !$name) { echo json_encode(['success'=>false,'message'=>'Thiếu songId hoặc name']); exit; }

    if ($action === 'save') {
        $chords = $body['chords'] ?? [];
        $file   = setFile($songId, $name);
        $ok = file_put_contents($file, json_encode($chords, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo json_encode(['success'=> $ok !== false]);
        exit;
    }

    if ($action === 'delete') {
        $file = setFile($songId, $name);
        if (file_exists($file)) unlink($file);
        echo json_encode(['success'=>true]);
        exit;
    }

    echo json_encode(['success'=>false,'message'=>'action không hợp lệ']);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Method không được hỗ trợ']);
