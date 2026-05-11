<?php
/**
 * api/core/Response.php — JSON response helpers
 */
class Response {
    public static function ok(mixed $data = [], bool $pretty = false): void {
        $flags = JSON_UNESCAPED_UNICODE | ($pretty ? JSON_PRETTY_PRINT : 0);
        echo json_encode(is_array($data) ? array_merge(['success' => true], $data) : $data, $flags);
    }

    public static function error(string $message, int $code = 400): void {
        http_response_code($code);
        echo json_encode(['success' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    }

    public static function notFound(string $msg = 'Không tìm thấy'): void {
        self::error($msg, 404);
    }

    public static function forbidden(string $msg = 'Không có quyền'): void {
        self::error($msg, 403);
    }

    public static function methodNotAllowed(): void {
        self::error('Method không được hỗ trợ', 405);
    }
}
