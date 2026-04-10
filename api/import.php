<?php
/**
 * api/import.php
 * Xử lý import MusicXML từ 3 nguồn: scrape, url, upload
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

define('SHEETS_DIR',  __DIR__ . '/../storage/sheets/');
define('SONGS_FILE',  __DIR__ . '/../storage/data/songs.json');

foreach ([SHEETS_DIR, dirname(SONGS_FILE)] as $dir) {
    if (!is_dir($dir)) mkdir($dir, 0775, true);
}

require_once __DIR__ . '/import_helpers.php';
require_once __DIR__ . '/import_scrapers.php';

// Detect mode
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
$isMultipart = strpos($contentType, 'multipart/form-data') !== false;
$queryType   = $_GET['type'] ?? '';

if ($isMultipart || $queryType === 'upload') {
    _handleUpload();
} else {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $type = $body['type'] ?? 'url';
    match($type) {
        'scrape' => _handleScrape($body),
        'url'    => _handleDirectUrl($body),
        default  => _error('Unknown import type: ' . $type),
    };
}

// ================================================================
// HANDLER: Upload file từ máy tính
// ================================================================
function _handleUpload(): void {
    if (!isset($_FILES['file'])) { _error('Không có file được gửi lên'); return; }
    $file  = $_FILES['file'];
    $title = trim($_POST['title'] ?? '') ?: pathinfo($file['name'], PATHINFO_FILENAME);

    if ($file['error'] !== UPLOAD_ERR_OK) { _error('Lỗi upload: ' . $file['error']); return; }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['xml','mxl','musicxml'])) {
        _error('Chỉ chấp nhận file .xml, .mxl, .musicxml'); return;
    }

    $content = file_get_contents($file['tmp_name']);
    if (!_isValidMusicXML($content, $ext)) { _error('File không hợp lệ — không phải MusicXML'); return; }

    $filename = _generateFilename($title, $ext);
    $path     = SHEETS_DIR . $filename;
    move_uploaded_file($file['tmp_name'], $path);

    $key  = _detectKey($content);
    $song = _saveSong($title, 'storage/sheets/' . $filename, $key, '');

    echo json_encode(['success' => true, 'title' => $title, 'song' => $song], JSON_UNESCAPED_UNICODE);
}

// ================================================================
// HANDLER: Scrape từ thanhca.httlvn.org
// ================================================================
function _handleScrape(array $body): void {
    $pageUrl = trim($body['url'] ?? '');
    $title   = trim($body['title'] ?? '');

    if (!$pageUrl) { _error('URL không được để trống'); return; }

    $html = _fetchUrl($pageUrl, 15);
    if ($html === false) { _error('Không thể tải trang. Kiểm tra URL hoặc kết nối mạng.'); return; }

    if (!$title) {
        $title = _extractTitle($html) ?: basename(parse_url($pageUrl, PHP_URL_PATH));
        $title = preg_replace('/^Sheet\s+Thánh\s+Ca\s+\d+\s+/iu', '', $title);
    }

    $xmlUrl = _extractXmlUrl($html, $pageUrl) ?: _guessHttlvnXmlUrl($pageUrl, $html) ?: _extractXmlFromScript($html, $pageUrl);

    if (!$xmlUrl) {
        _error('Không tìm thấy file MusicXML. Hãy thử lấy URL trực tiếp file .xml từ Network tab của browser.'); return;
    }

    $xmlContent = _fetchUrl($xmlUrl, 20);
    if (!$xmlContent) {
        $base       = parse_url($pageUrl, PHP_URL_SCHEME) . '://' . parse_url($pageUrl, PHP_URL_HOST);
        $xmlUrl2    = $base . (str_starts_with($xmlUrl, '/') ? $xmlUrl : '/' . $xmlUrl);
        $xmlContent = _fetchUrl($xmlUrl2, 20);
    }

    if (!$xmlContent || !_isValidMusicXML($xmlContent, 'xml')) {
        _error('Tải được link nhưng nội dung không phải MusicXML hợp lệ. URL thử: ' . $xmlUrl); return;
    }

    $ext      = str_ends_with(strtolower($xmlUrl), '.mxl') ? 'mxl' : 'xml';
    $filename = _generateFilename($title, $ext);
    file_put_contents(SHEETS_DIR . $filename, $xmlContent);

    $key  = _detectKey($xmlContent);
    $song = _saveSong($title, 'storage/sheets/' . $filename, $key, $pageUrl);

    echo json_encode(['success' => true, 'title' => $title, 'xmlUrl' => $xmlUrl, 'key' => $key, 'song' => $song], JSON_UNESCAPED_UNICODE);
}

// ================================================================
// HANDLER: Direct URL đến file XML
// ================================================================
function _handleDirectUrl(array $body): void {
    $xmlUrl = trim($body['url'] ?? '');
    $title  = trim($body['title'] ?? '');

    if (!$xmlUrl) { _error('URL không được để trống'); return; }

    $content = _fetchUrl($xmlUrl, 20);
    if ($content === false) { _error('Không thể tải file từ URL đã cho'); return; }

    $ext = (str_ends_with(strtolower($xmlUrl), '.mxl')) ? 'mxl' : 'xml';
    if (!_isValidMusicXML($content, $ext)) { _error('File tải về không phải MusicXML hợp lệ'); return; }

    if (!$title) $title = pathinfo(parse_url($xmlUrl, PHP_URL_PATH), PATHINFO_FILENAME) ?: 'Bài hát mới';

    $filename = _generateFilename($title, $ext);
    file_put_contents(SHEETS_DIR . $filename, $content);

    $key  = _detectKey($content);
    $song = _saveSong($title, 'storage/sheets/' . $filename, $key, $xmlUrl);

    echo json_encode(['success' => true, 'title' => $title, 'song' => $song], JSON_UNESCAPED_UNICODE);
}
