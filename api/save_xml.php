<?php
header('Content-Type: application/json');

// Kiểm tra method REST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Lỗi: Chỉ chấp nhận method POST.']);
    exit;
}

// Nhận dữ liệu POST raw
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['filepath']) || !isset($data['xml'])) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: Thiếu tham số filepath hoặc xml.']);
    exit;
}

$filepath = $data['filepath'];
$xmlContent = $data['xml'];

// Root path của storage
$storageRoot = realpath(__DIR__ . '/../storage');

// Giải mã absolute/relative path
$targetPath = realpath($filepath);

// Fallback: nếu filepath chỉ truyên relative từ client
if (!$targetPath && !file_exists($filepath)) {
    // Thử ghép với root thư mục
    $targetPath = realpath(__DIR__ . '/../' . ltrim($filepath, '/\\'));
}

if (!$targetPath || !file_exists($targetPath)) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: File gốc không tồn tại trên server: ' . htmlspecialchars($filepath)]);
    exit;
}

// BẢO MẬT: Phải đảm bảo file muốn ghi nằm BÊN TRONG thư mục storage/Thanh ca/ (không cho hack path traversal)
if (strpos($targetPath, $storageRoot) !== 0) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: Truy cập file ngoài vùng quản lý bị từ chối.']);
    exit;
}

if (pathinfo($targetPath, PATHINFO_EXTENSION) !== 'xml') {
     echo json_encode(['success' => false, 'message' => 'Lỗi: Chỉ cho phép ghi file .xml']);
     exit;
}

// Lưu dữ liệu
$result = file_put_contents($targetPath, $xmlContent);

if ($result === false) {
    echo json_encode(['success' => false, 'message' => 'Lỗi: Không có quyền ghi đè (Permission denied). Hãy kiểm tra Folder Permissions!']);
} else {
    echo json_encode(['success' => true, 'message' => 'Đã lưu vĩnh viễn hợp âm vào file gốc.']);
}
?>
