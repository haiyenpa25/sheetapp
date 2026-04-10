<?php
/**
 * api/import_helpers.php
 * Chứa các hàm tiện ích cho việc parse MusicXML, lưu lịch sử bài hát, tạo slug, v.v.
 */

function _fetchUrl(string $url, int $timeout = 15): string|false {
    $ctx = stream_context_create([
        'http' => [
            'timeout'          => $timeout,
            'follow_location'  => 1,
            'max_redirects'    => 5,
            'user_agent'       => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 SheetApp/1.0',
            'header'           => "Accept: text/html,application/xhtml+xml,application/xml,*/*\r\nAccept-Language: vi-VN,vi;q=0.9,en;q=0.5\r\n",
        ],
        'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    return @file_get_contents($url, false, $ctx);
}

function _isValidMusicXML(string $content, string $ext): bool {
    if (empty($content)) return false;
    if ($ext === 'mxl') return substr($content, 0, 2) === 'PK';
    return (
        strpos($content, 'score-partwise') !== false ||
        strpos($content, 'score-timewise') !== false ||
        strpos($content, '<?xml')          !== false
    );
}

function _detectKey(string $xmlContent): string {
    if (preg_match('/<fifths>(-?\d+)<\/fifths>/', $xmlContent, $m)) {
        $fifths = (int)$m[1];
        $keys   = ['Cb','Gb','Db','Ab','Eb','Bb','F','C','G','D','A','E','B','F#','C#'];
        $idx    = $fifths + 7;
        return $keys[$idx] ?? 'C';
    }
    return '';
}

function _extractTitle(string $html): string {
    if (preg_match('/<title>([^<]+)<\/title>/i', $html, $m)) {
        $t = html_entity_decode(trim($m[1]));
        $t = preg_replace('/\s*[|–-].*$/', '', $t);
        return trim($t);
    }
    if (preg_match('/<h1[^>]*>([^<]+)<\/h1>/i', $html, $m)) {
        return html_entity_decode(trim(strip_tags($m[1])));
    }
    return '';
}

function _resolveUrl(string $url, string $baseUrl): string {
    if (str_starts_with($url, 'http')) return $url;
    $parsed = parse_url($baseUrl);
    $base   = $parsed['scheme'] . '://' . $parsed['host'];
    if (str_starts_with($url, '//')) return $parsed['scheme'] . ':' . $url;
    if (str_starts_with($url, '/')) return $base . $url;
    $basePath = dirname($parsed['path'] ?? '/');
    return $base . $basePath . '/' . $url;
}

function _generateFilename(string $title, string $ext): string {
    $slug = _slugify($title);
    $slug = $slug ?: 'sheet-' . time();
    $filename = $slug . '.' . $ext;
    $i = 1;
    while (file_exists(SHEETS_DIR . $filename)) {
        $filename = $slug . '-' . $i++ . '.' . $ext;
    }
    return $filename;
}

function _saveSong(string $title, string $xmlPath, string $key, string $source): array {
    $songs = file_exists(SONGS_FILE) ? json_decode(file_get_contents(SONGS_FILE), true) : [];
    if (!is_array($songs)) $songs = [];

    $id = _slugify($title) ?: 'song-' . time();
    $baseId  = $id;
    $counter = 1;
    $existingIds = array_column($songs, 'id');
    while (in_array($id, $existingIds)) { $id = $baseId . '-' . $counter++; }

    $song = [
        'id'         => $id,
        'title'      => $title,
        'xmlPath'    => $xmlPath,
        'defaultKey' => $key,
        'source'     => $source,
        'dateAdded'  => date('Y-m-d'),
    ];
    array_unshift($songs, $song);
    file_put_contents(SONGS_FILE, json_encode($songs, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return $song;
}

function _slugify(string $text): string {
    $text = mb_strtolower($text, 'UTF-8');
    $from = ['à','á','ả','ã','ạ','ă','ắ','ặ','ằ','ẳ','ẵ','â','ấ','ậ','ầ','ẩ','ẫ','đ',
             'è','é','ẻ','ẽ','ẹ','ê','ế','ệ','ề','ể','ễ','ì','í','ỉ','ĩ','ị',
             'ò','ó','ỏ','õ','ọ','ô','ố','ộ','ồ','ổ','ỗ','ơ','ớ','ợ','ờ','ở','ỡ',
             'ù','ú','ủ','ũ','ụ','ư','ứ','ự','ừ','ử','ữ','ỳ','ý','ỷ','ỹ','ỵ'];
    $to   = ['a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','a','d',
             'e','e','e','e','e','e','e','e','e','e','e','i','i','i','i','i',
             'o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o','o',
             'u','u','u','u','u','u','u','u','u','u','u','y','y','y','y','y'];
    $text = str_replace($from, $to, $text);
    $text = preg_replace('/[^a-z0-9\s-]/', '', $text);
    $text = preg_replace('/[\s-]+/', '-', trim($text));
    return substr($text, 0, 80);
}

function _error(string $msg, int $code = 400): void {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
