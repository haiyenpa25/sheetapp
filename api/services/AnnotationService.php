<?php
/**
 * api/services/AnnotationService.php
 */
class AnnotationService {
    public const BASE_DIR = __DIR__ . '/../../data/annotations';

    private static function getFile(string $songId): string {
        if (!is_dir(self::BASE_DIR)) mkdir(self::BASE_DIR, 0755, true);
        $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
        return self::BASE_DIR . '/' . $safe . '.json';
    }

    public static function load(string $songId): array {
        $file = self::getFile($songId);
        if (!file_exists($file)) return [];
        return json_decode(file_get_contents($file), true) ?? [];
    }

    public static function save(string $songId, array $annotations): bool {
        $file = self::getFile($songId);
        return file_put_contents($file, json_encode($annotations, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) !== false;
    }
}
