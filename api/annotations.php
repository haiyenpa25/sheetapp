<?php
/**
 * api/annotations.php — CRUD cho ghi chú tự do
 *
 * GET  ?action=load&songId=xxx
 * POST action=save → body JSON: {songId, annotations:[{measureIdx,noteIdx,text,color}]}
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$BASE_DIR = __DIR__ . '/../data/annotations';
if (!is_dir($BASE_DIR)) mkdir($BASE_DIR, 0755, true);

function getFile(string $songId): string {
    global $BASE_DIR;
    $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
    return $BASE_DIR . '/' . $safe . '.json';
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $action = $_GET['action'] ?? '';
    $songId = trim($_GET['songId'] ?? '');

    if (!$songId) { echo json_encode(['success'=>false,'message'=>'Thiếu songId']); exit; }

    if ($action === 'load') {
        $file = getFile($songId);
        if (!file_exists($file)) {
            echo json_encode(['success'=>true,'annotations'=>[]]);
            exit;
        }
        $data = json_decode(file_get_contents($file), true) ?? [];
        echo json_encode(['success'=>true,'annotations'=>$data]);
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

    if (!$songId) { echo json_encode(['success'=>false,'message'=>'Thiếu songId']); exit; }

    if ($action === 'save') {
        $annotations = $body['annotations'] ?? [];
        $file = getFile($songId);
        $ok = file_put_contents($file, json_encode($annotations, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo json_encode(['success'=> $ok !== false]);
        exit;
    }

    echo json_encode(['success'=>false,'message'=>'action không hợp lệ']);
    exit;
}

echo json_encode(['success'=>false,'message'=>'Method không được hỗ trợ']);
