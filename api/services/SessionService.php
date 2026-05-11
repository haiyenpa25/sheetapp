<?php
/**
 * api/services/SessionService.php — Business logic cho Sessions
 */
class SessionService {
    private const DIR = __DIR__ . '/../../storage/data/sessions/';

    public static function load(string $songId): array {
        $file = self::file($songId);
        if (!file_exists($file)) return self::defaults($songId);
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data)) return self::defaults($songId);
        $data['userSettings'] ??= self::defaultSettings();
        $data['perfNotes']    ??= (object)[];
        return $data;
    }

    public static function saveUserSettings(string $songId, array $settings): array {
        $existing = self::load($songId);
        $merged = array_merge($existing['userSettings'], $settings);
        if (isset($merged['history']) && is_array($merged['history'])) {
            usort($merged['history'], fn($a,$b) => strcmp($a['date']??'', $b['date']??''));
            $merged['history'] = array_slice($merged['history'], -50);
        }
        self::write($songId, array_merge($existing, ['lastSaved' => date('c'), 'userSettings' => $merged]));
        return $merged;
    }

    public static function savePerfNotes(string $songId, array $notes): array {
        $existing = self::load($songId);
        $safe = [
            'key'       => substr(trim($notes['key']  ?? ''), 0, 20),
            'bpm'       => substr(trim($notes['bpm']  ?? ''), 0, 10),
            'text'      => substr(trim($notes['text'] ?? ''), 0, 2000),
            'updatedAt' => $notes['updatedAt'] ?? date('c'),
        ];
        self::write($songId, array_merge($existing, ['lastSaved' => date('c'), 'perfNotes' => $safe]));
        return $safe;
    }

    private static function file(string $songId): string {
        if (!is_dir(self::DIR)) mkdir(self::DIR, 0775, true);
        $prefix = preg_replace('/[^a-z0-9\-]/', '', strtolower(substr($songId, 0, 30)));
        $hash   = substr(md5($songId), 0, 8);
        return self::DIR . ($prefix ? "{$prefix}_{$hash}" : $hash) . '.json';
    }

    private static function write(string $songId, array $data): void {
        file_put_contents(self::file($songId), json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    private static function defaults(string $songId): array {
        return ['songId' => $songId, 'userSettings' => self::defaultSettings(), 'perfNotes' => (object)[]];
    }

    private static function defaultSettings(): array {
        return ['lastTranspose' => 0, 'zoomLevel' => 1.0, 'chordOverrides' => [], 'history' => []];
    }
}
