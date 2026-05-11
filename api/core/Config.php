<?php
/**
 * api/core/Config.php
 * Quản lý các cấu hình toàn cục.
 */
class Config {
    public static function get(string $key, $default = null) {
        $env = getenv($key);
        if ($env !== false) {
            return $env;
        }

        $config = [
            'OMR_ENGINE_URL' => 'http://localhost:5555', // Mặc định cho Docker
            'DB_PATH' => __DIR__ . '/../../storage/data/sheetapp.sqlite'
        ];

        return $config[$key] ?? $default;
    }
}
