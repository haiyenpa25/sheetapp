<?php
/**
 * api/services/SetlistService.php
 */
require_once __DIR__ . '/../core/DB.php';

class SetlistService {
    public static function getAll(): array {
        return DB::query("SELECT s.*, (SELECT COUNT(*) FROM setlist_items WHERE setlist_id = s.id) as item_count FROM setlists s ORDER BY s.created_at DESC");
    }

    public static function getById(int $id): ?array {
        $setlist = DB::run("SELECT * FROM setlists WHERE id = ?", [$id])->fetch();
        if (!$setlist) return null;

        $items = DB::run("SELECT * FROM setlist_items WHERE setlist_id = ? ORDER BY display_order ASC", [$id])->fetchAll(PDO::FETCH_ASSOC);
        $setlist['items'] = $items;
        return $setlist;
    }

    public static function create(string $title, string $date, ?int $userId): int {
        DB::run("INSERT INTO setlists (title, scheduled_date, created_by) VALUES (?, ?, ?)", [$title, $date, $userId]);
        return (int)DB::lastId();
    }

    public static function delete(int $id): void {
        DB::run("DELETE FROM setlists WHERE id = ?", [$id]);
    }

    public static function addItem(int $setlistId, string $songId, string $chordProfile, int $transposeKey, ?int $bpm = null, ?int $beatsPerMeasure = null): void {
        $order = DB::run("SELECT IFNULL(MAX(display_order), 0) + 1 FROM setlist_items WHERE setlist_id = ?", [$setlistId])->fetchColumn();
        DB::run(
            "INSERT INTO setlist_items (setlist_id, song_id, display_order, chord_profile, transpose_key, bpm, beats_per_measure) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [$setlistId, $songId, $order, $chordProfile, $transposeKey, $bpm, $beatsPerMeasure]
        );
    }

    /**
     * Update BPM và beats_per_measure cho 1 item (PATCH)
     * Fields được phép update: chord_profile, transpose_key, bpm, beats_per_measure, display_order
     */
    public static function updateItem(int $itemId, array $data): bool {
        $allowed = ['chord_profile', 'transpose_key', 'bpm', 'beats_per_measure', 'display_order'];
        $fields = []; $params = [];
        foreach ($allowed as $f) {
            if (array_key_exists($f, $data)) {
                $fields[] = "$f = ?";
                $params[] = $data[$f] !== '' && $data[$f] !== null ? (in_array($f, ['transpose_key','bpm','beats_per_measure','display_order']) ? (int)$data[$f] : $data[$f]) : null;
            }
        }
        if (!$fields) return false;
        $params[] = $itemId;
        DB::run("UPDATE setlist_items SET " . implode(', ', $fields) . " WHERE id = ?", $params);
        return true;
    }

    public static function removeItem(int $itemId): void {
        DB::run("DELETE FROM setlist_items WHERE id = ?", [$itemId]);
    }
}
