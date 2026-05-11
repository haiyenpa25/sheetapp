<?php
/**
 * api/services/ChordSetService.php
 */
class ChordSetService {
    public const BASE_DIR = __DIR__ . '/../../data/chord_sets';

    private static function getSongDir(string $songId): string {
        $safe = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $songId);
        $dir  = self::BASE_DIR . '/' . $safe;
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        return $dir;
    }

    private static function getSetFile(string $songId, string $name): string {
        $safe = preg_replace('/[^a-zA-Z0-9_\-\p{L}]/u', '_', $name);
        return self::getSongDir($songId) . '/' . $safe . '.json';
    }

    public static function listSets(string $songId): array {
        $dir   = self::getSongDir($songId);
        $files = glob($dir . '/*.json');
        $names = array_map(fn($f) => pathinfo($f, PATHINFO_FILENAME), $files ?: []);
        $names = array_map(fn($n) => str_replace('_', ' ', $n), $names);
        return array_values($names);
    }

    public static function loadSet(string $songId, string $name): array {
        $file = self::getSetFile($songId, $name);
        if (!file_exists($file)) return [];
        return json_decode(file_get_contents($file), true) ?? [];
    }

    public static function saveSet(string $songId, string $name, array $chords): bool {
        $file = self::getSetFile($songId, $name);
        return file_put_contents($file, json_encode($chords, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) !== false;
    }

    public static function deleteSet(string $songId, string $name): void {
        $file = self::getSetFile($songId, $name);
        if (file_exists($file)) unlink($file);
    }
}
