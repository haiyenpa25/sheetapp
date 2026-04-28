<?php
/**
 * api/omr.php
 * Quản lý Trạm Nhận diện OMR (Upload, Status, Delete)
 */
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

require_once __DIR__ . '/db.php';

define('WORKSPACE_DIR',  __DIR__ . '/../storage/omr_workspace/');
if (!is_dir(WORKSPACE_DIR)) mkdir(WORKSPACE_DIR, 0775, true);

$method = $_SERVER['REQUEST_METHOD'];
$isAdmin = isset($_SESSION['role']) && $_SESSION['role'] === 'admin';

if (!$isAdmin) {
    http_response_code(403);
    echo json_encode(['error' => 'Chỉ Admin mới có quyền truy cập Trạm OMR']);
    exit;
}

try {
    switch ($method) {
        case 'GET':
            $stmt = $pdo->query("SELECT * FROM omr_workspace ORDER BY created_at DESC");
            $jobs = $stmt->fetchAll();
            echo json_encode($jobs, JSON_UNESCAPED_UNICODE);
            break;

        case 'POST':
            if (!isset($_FILES['file'])) {
                http_response_code(400); echo json_encode(['error' => 'Không có file']); exit;
            }
            $file = $_FILES['file'];
            if ($file['error'] !== UPLOAD_ERR_OK) {
                http_response_code(400); echo json_encode(['error' => 'Lỗi upload: ' . $file['error']]); exit;
            }

            $originalName = $file['name'];
            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            if (!in_array($ext, ['pdf', 'png', 'jpg', 'jpeg'])) {
                http_response_code(400); echo json_encode(['error' => 'Chỉ nhận PDF hoặc Hình ảnh']); exit;
            }

            $id = uniqid('omr_');
            $filename = $id . '.' . $ext;
            $path = WORKSPACE_DIR . $filename;
            
            move_uploaded_file($file['tmp_name'], $path);

            $stmt = $pdo->prepare("INSERT INTO omr_workspace (id, original_filename, status) VALUES (?, ?, 'waiting')");
            $stmt->execute([$id, $originalName]);

            // Kiểm tra OMR Engine (Docker) có sống không
            $engineUrl = 'http://localhost:5555/health';
            $engineOk  = false;
            $ctx = stream_context_create(['http' => ['timeout' => 3, 'ignore_errors' => true]]);
            $healthRes = @file_get_contents($engineUrl, false, $ctx);
            if ($healthRes) {
                $healthData = json_decode($healthRes, true);
                $engineOk = ($healthData['status'] ?? '') === 'ok';
            }

            if (!$engineOk) {
                $pdo->prepare("UPDATE omr_workspace SET status = 'error' WHERE id = ?")
                    ->execute([$id]);
                http_response_code(503);
                echo json_encode(['error' => 'OMR Engine chưa sẵn sàng. Kiểm tra Docker container sheetapp-omr.']);
                exit;
            }

            // Gọi OMR Worker ngầm (PHP CLI)
            $workerPath = realpath(__DIR__ . '/omr_worker.php');
            $phpBin     = PHP_BINARY;
            // Escape paths đúng cho Windows (dùng double quotes trong cmd)
            $logFile    = WORKSPACE_DIR . $id . '_worker.log';
            $command    = "start /b \"\" \"{$phpBin}\" \"{$workerPath}\" {$id} > \"{$logFile}\" 2>&1";
            pclose(popen($command, 'r'));

            echo json_encode(['success' => true, 'id' => $id]);
            break;

        case 'DELETE':
            $id = $_GET['id'] ?? null;
            if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); exit; }

            // Lấy thông tin
            $stmt = $pdo->prepare("SELECT * FROM omr_workspace WHERE id = ?");
            $stmt->execute([$id]);
            $job = $stmt->fetch();

            if ($job) {
                // Xoá vật lý file PDF/Ảnh
                $filesToDel = glob(WORKSPACE_DIR . $id . '.*');
                foreach ($filesToDel as $f) { @unlink($f); }
                
                // Xoá db
                $pdo->prepare("DELETE FROM omr_workspace WHERE id = ?")->execute([$id]);
            }
            
            echo json_encode(['success' => true]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Lỗi Database: ' . $e->getMessage()]);
}
