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
                    // Keep returning raw array for frontend compatibility if Response::ok() breaks it, 
                    // but wait, Response::ok() works if frontend accepts {success: true, data: ...}
                    // Currently `ApiService.js` expects raw array for categories? Let's check `api/categories.php`.
                    // Yes, `api/categories.php` returned raw array. We will keep raw array to not break frontend.
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
