<?php
/**
 * api/controllers/CategoryController.php
 */
require_once __DIR__ . '/../core/Response.php';
require_once __DIR__ . '/../core/Auth.php';
require_once __DIR__ . '/../services/CategoryService.php';

class CategoryController {
    public function handleRequest(string $method): void {
        try {
            switch ($method) {
                case 'GET':
                    $categories = CategoryService::getAll();
                    // INTENTIONAL: Trả raw array (không bọc Response::ok()) vì
                    // ApiService.categories.list() và LibraryUI expect Array.isArray() trực tiếp.
                    // Để đổi: cần sửa đồng thời ApiService + library-ui.js + admin-ui.js.
                    echo json_encode($categories, JSON_UNESCAPED_UNICODE);
                    break;

                case 'POST':
                    Auth::requireAdmin();
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    if (empty($body['name'])) { 
                        Response::error('Missing name'); 
                        return; 
                    }
                    $result = CategoryService::create($body['name']);
                    echo json_encode($result, JSON_UNESCAPED_UNICODE);
                    break;

                case 'PUT':
                    Auth::requireAdmin();
                    $id   = $_GET['id'] ?? null;
                    $body = json_decode(file_get_contents('php://input'), true) ?? [];
                    if (!$id || empty($body['name'])) { 
                        Response::error('Missing id or name'); 
                        return; 
                    }
                    $result = CategoryService::update($id, $body['name']);
                    echo json_encode($result, JSON_UNESCAPED_UNICODE);
                    break;

                case 'DELETE':
                    Auth::requireAdmin();
                    $id = $_GET['id'] ?? null;
                    if (!$id) { Response::error('Missing id'); return; }
                    $result = CategoryService::delete($id);
                    echo json_encode($result, JSON_UNESCAPED_UNICODE);
                    break;

                default:
                    Response::methodNotAllowed();
            }
        } catch (PDOException $e) {
            Response::error('Lỗi Database: ' . $e->getMessage(), 500);
        }
    }
}
