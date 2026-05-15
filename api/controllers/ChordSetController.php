<?php
/**
 * api/controllers/ChordSetController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../services/ChordSetService.php';

class ChordSetController {
    public function handleRequest(string $method): void {
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
            $body = json_decode(file_get_contents('php://input'), true);
            if (!$body) { Response::error('Body không hợp lệ'); return; }

            $action = $body['action'] ?? '';
            $songId = trim($body['songId'] ?? '');
            $name   = trim($body['name']   ?? '');

            if (!$songId || !$name) { Response::error('Thiếu songId hoặc name'); return; }

            if ($action === 'save') {
                $chords = $body['chords'] ?? [];
                $ok = ChordSetService::saveSet($songId, $name, $chords);
                $ok ? Response::ok() : Response::error('Lỗi lưu chord set');
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
    }
}
