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
            echo json_encode(SessionService::load($songId), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
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
            echo json_encode(array_merge(['success' => true], $result), JSON_UNESCAPED_UNICODE);
        } else {
            Response::methodNotAllowed();
        }
    }
}
