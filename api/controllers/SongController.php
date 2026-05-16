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
                    // INTENTIONAL: Trả raw array vì LibraryUI.loadSongs() expect Array.isArray() trực tiếp.
                    // Để đổi sang Response::ok(): cần sửa đồng thời ApiService.songs.list() + library-ui.js + admin-ui.js.
                    $data = $lyric !== '' ? SongService::searchByLyric($lyric) : SongService::getAll();
                    echo json_encode($data, JSON_UNESCAPED_UNICODE);
                    break;

                case 'POST':
                    $action = $_GET['action'] ?? '';
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];

                    if ($action === 'save_xml') {
                        // Lưu hợp âm vào XML gốc — Ban Hát và Admin đều có quyền
                        Auth::requireBanhat();
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

                    // Thêm bài hát mới — chỉ Admin
                    Auth::requireAdmin();
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
