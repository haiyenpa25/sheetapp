<?php
// index.php — Smart Sheet Music WebApp
?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SheetApp — Nhạc Thánh Ca Tương Tác</title>
  <meta name="description" content="Ứng dụng xem, dịch giọng và ghi chép nhạc thánh ca tương tác. Hỗ trợ MusicXML, transpose và nhật ký biểu diễn.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<?php
function cssTag(string $file): string {
    $path = __DIR__ . '/assets/css/' . $file;
    $v    = file_exists($path) ? filemtime($path) : time();
    return "  <link rel=\"stylesheet\" href=\"assets/css/{$file}?v={$v}\">\n";
}
echo cssTag('base.css');
echo cssTag('layout.css');
echo cssTag('sheet.css');
echo cssTag('components.css');
?>
  <!-- OSMD & TONE.JS (Audio Player) -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/osmd-audio-player/umd/OsmdAudioPlayer.min.js"></script>
  <!-- TONAL.JS (Music Theory & Transposition) -->
  <script src="https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js"></script>
</head>
<body>

<?php require_once __DIR__ . '/includes/sidebar.php'; ?>
<div id="sidebar-overlay" class="sidebar-overlay hidden"></div>

<!-- ===== MAIN CONTENT ===== -->
<main id="main" class="main-content">
  <?php require_once __DIR__ . '/includes/toolbar.php'; ?>
  <?php require_once __DIR__ . '/includes/sheet_viewer.php'; ?>
</main>

<?php require_once __DIR__ . '/includes/modals.php'; ?>
<?php require_once __DIR__ . '/includes/admin_console.php'; ?>

<!-- ===== SCRIPTS ===== -->
<!-- OSMD from CDN -->
<script src="https://cdn.jsdelivr.net/npm/opensheetmusicdisplay@1.8.6/build/opensheetmusicdisplay.min.js"></script>

<?php
// Auto cache-bust: dùng thời gian sửa file — không cần tăng số tay
function jsTag(string $file): string {
    $path = __DIR__ . '/assets/js/' . $file;
    $v    = file_exists($path) ? filemtime($path) : time();
    return "<script src=\"assets/js/{$file}?v={$v}\"></script>\n";
}
echo jsTag('osmd-renderer.js');
echo jsTag('lyric-extractor.js');
echo jsTag('transpose-engine.js');
echo jsTag('session-tracker.js');
echo jsTag('auth.js');
echo jsTag('library-ui.js');
echo jsTag('setlist-ui.js');
echo jsTag('importer.js');
echo jsTag('admin-ui.js');
echo jsTag('display-settings.js');
echo jsTag('chord-canvas-xml.js');
echo jsTag('chord-canvas-ui.js');
echo jsTag('chord-canvas.js');
echo jsTag('annotation-canvas.js');
echo jsTag('instruments.js');
echo jsTag('audio-player.js');
echo jsTag('auto-scroller.js');
echo jsTag('page-nav.js');
echo jsTag('app-ui.js');
echo jsTag('app.js');
?>

</body>
</html>
