<?php
/**
 * api/controllers/ChordSetController.php
 * FIX: Thêm require_once Auth.php — thiếu dòng này gây HTTP 500 khi gọi Auth::requireBanhat()
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/ChordSetService.php';

class ChordSetController {
    public function handleRequest(string $method): void {
        try {
            if ($method === 'GET') {
                $action = $_GET['action'] ?? '';
                $songId = trim($_GET['songId'] ?? '');

                if (!$songId) { Response::error('Thiếu songId'); return; }

                if ($action === 'list') {
                    $names = ChordSetService::listSets($songId);
                    Response::ok(['sets' => $names]);
                    return;
                }

                if ($action === 'load') {
                    $name = trim($_GET['name'] ?? '');
                    if (!$name) { Response::error('Thiếu name'); return; }
                    $chords = ChordSetService::loadSet($songId, $name);
                    Response::ok(['chords' => $chords]);
                    return;
                }

                Response::error('action không hợp lệ');

            } elseif ($method === 'POST') {
                // Yêu cầu ít nhất quyền Ban Hát để lưu/xóa hợp âm
                Auth::requireBanhat();

                $body = json_decode(file_get_contents('php://input'), true);
                if (!$body) { Response::error('Body không hợp lệ'); return; }

                $action = trim($body['action'] ?? '');
                $songId = trim($body['songId'] ?? '');
                $name   = trim($body['name']   ?? '');

                if (!$songId || !$name) { Response::error('Thiếu songId hoặc name'); return; }

                if ($action === 'save') {
                    $chords = $body['chords'] ?? [];
                    if (!is_array($chords)) { Response::error('chords phải là array'); return; }
                    $ok = ChordSetService::saveSet($songId, $name, $chords);
                    $ok ? Response::ok(['message' => 'Đã lưu ' . count($chords) . ' hợp âm'])
                        : Response::error('Lỗi ghi file — kiểm tra quyền thư mục data/chord_sets');
                    return;
                }

                if ($action === 'delete') {
                    ChordSetService::deleteSet($songId, $name);
                    Response::ok();
                    return;
                }

                Response::error('action không hợp lệ');

            } else {
                Response::methodNotAllowed();
            }
        } catch (Throwable $e) {
            Response::error('Lỗi hệ thống: ' . $e->getMessage(), 500);
        }
    }
}
