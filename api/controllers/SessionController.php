<?php
/**
 * api/controllers/SessionController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../services/SessionService.php';

class SessionController {
    public function handleRequest(string $method): void {
        if ($method === 'GET') {
            $songId = $_GET['songId'] ?? '';
            if (!$songId) { Response::error('Missing songId'); return; }
            // SessionService::load() trả về {songId, userSettings, perfNotes}
            Response::ok(SessionService::load($songId));
        } elseif ($method === 'POST') {
            $body   = json_decode(file_get_contents('php://input'), true) ?? [];
            $songId = $body['songId'] ?? '';
            if (!$songId) { Response::error('Missing songId'); return; }

            $result = [];
            if (isset($body['userSettings'])) {
                $result['userSettings'] = SessionService::saveUserSettings($songId, $body['userSettings']);
            }
            if (isset($body['perfNotes'])) {
                $result['perfNotes'] = SessionService::savePerfNotes($songId, $body['perfNotes']);
            }
            Response::ok($result);
        } else {
            Response::methodNotAllowed();
        }
    }
}
