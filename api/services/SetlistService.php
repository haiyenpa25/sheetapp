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

        $items = DB::query("SELECT * FROM setlist_items WHERE setlist_id = {$id} ORDER BY display_order ASC");
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

    public static function addItem(int $setlistId, string $songId, string $chordProfile, int $transposeKey): void {
        $order = DB::run("SELECT IFNULL(MAX(display_order), 0) + 1 FROM setlist_items WHERE setlist_id = ?", [$setlistId])->fetchColumn();
        DB::run("INSERT INTO setlist_items (setlist_id, song_id, display_order, chord_profile, transpose_key) VALUES (?, ?, ?, ?, ?)",
            [$setlistId, $songId, $order, $chordProfile, $transposeKey]);
    }

    public static function removeItem(int $itemId): void {
        DB::run("DELETE FROM setlist_items WHERE id = ?", [$itemId]);
    }
}
