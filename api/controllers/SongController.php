<?php
/**
 * api/controllers/SongController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/SongService.php';

class SongController {
    public function handleRequest(string $method): void {
        try {
            switch ($method) {
                case 'GET':
                    $lyric = trim($_GET['lyric_search'] ?? '');
                    // Return plain array for backward compat with frontend (Response::ok prepends success: true)
                    // Wait, frontend expects array. So I shouldn't use Response::ok here if frontend wants raw array.
                    $data = $lyric !== '' ? SongService::searchByLyric($lyric) : SongService::getAll();
                    echo json_encode($data, JSON_UNESCAPED_UNICODE);
                    break;

                case 'POST':
                    Auth::requireAdmin();
                    $action = $_GET['action'] ?? '';
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    
                    if ($action === 'save_xml') {
                        if (empty($body['filepath']) || empty($body['xml'])) {
                            Response::error('Lỗi: Thiếu tham số filepath hoặc xml.');
                            return;
                        }
                        $result = SongService::saveXml($body['filepath'], $body['xml']);
                        if (!$result['success']) {
                            Response::error($result['message']);
                        } else {
                            Response::ok(['message' => $result['message']]);
                        }
                        return;
                    }

                    echo json_encode(SongService::add($body), JSON_UNESCAPED_UNICODE);
                    break;

                case 'PUT':
                    Auth::requireAdmin();
                    $id   = $_GET['id'] ?? null;
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    if (!$id) { Response::error('Missing id'); return; }
                    echo json_encode(SongService::update($id, $body), JSON_UNESCAPED_UNICODE);
                    break;

                case 'DELETE':
                    Auth::requireAdmin();
                    $id = $_GET['id'] ?? null;
                    if (!$id) { Response::error('Missing id'); return; }
                    echo json_encode(SongService::delete($id), JSON_UNESCAPED_UNICODE);
                    break;

                default:
                    Response::methodNotAllowed();
            }
        } catch (PDOException $e) {
            Response::error('Lỗi Database: ' . $e->getMessage(), 500);
        }
    }
}
