<?php
/**
 * api/controllers/SetlistController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/SetlistService.php';

class SetlistController {
    public function handleRequest(string $method): void {
        $action = $_GET['action'] ?? '';
        $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
        $userId = Auth::userId();

        try {
            if ($method === 'GET' && empty($action)) {
                if ($id > 0) {
                    $setlist = SetlistService::getById($id);
                    if (!$setlist) {
                        Response::notFound('Setlist không tồn tại');
                        return;
                    }
                    Response::ok(['data' => $setlist]);
                } else {
                    Response::ok(['data' => SetlistService::getAll()]);
                }
            } elseif ($method === 'POST' && empty($action)) {
                $data = json_decode(file_get_contents('php://input'), true) ?? [];
                $title = $data['title'] ?? 'Setlist Mới';
                $date = $data['scheduled_date'] ?? date('Y-m-d');
                $newId = SetlistService::create($title, $date, $userId);
                Response::ok(['id' => $newId]);
            } elseif ($method === 'DELETE' && empty($action)) {
                if ($id > 0) {
                    SetlistService::delete($id);
                    Response::ok();
                }
            } elseif ($method === 'POST' && $action === 'add_item') {
                $data = json_decode(file_get_contents('php://input'), true) ?? [];
                $setlist_id = $data['setlist_id'] ?? 0;
                $song_id = $data['song_id'] ?? '';
                $chord_profile = $data['chord_profile'] ?? 'default';
                $transpose_key = isset($data['transpose_key']) ? (int)$data['transpose_key'] : 0;
                
                SetlistService::addItem($setlist_id, $song_id, $chord_profile, $transpose_key);
                Response::ok();
            } elseif ($method === 'DELETE' && $action === 'remove_item') {
                if ($id > 0) {
                    SetlistService::removeItem($id);
                    Response::ok();
                }
            } else {
                Response::methodNotAllowed();
            }
        } catch (PDOException $e) {
            Response::error('Lỗi Database: ' . $e->getMessage(), 500);
        }
    }
}
