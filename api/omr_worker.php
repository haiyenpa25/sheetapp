<?php
/**
 * api/omr_worker.php
 * Trình chạy ngầm xử lý OMR thông qua phần mềm thứ 3.
 * Cách gọi trên Windows: start /B php api/omr_worker.php <job_id>
 */
require_once __DIR__ . '/db.php';

$job_id = $argv[1] ?? null;
if (!$job_id) {
    die("Thiếu Job ID\n");
}

define('WORKSPACE_DIR',  __DIR__ . '/../storage/omr_workspace/');

try {
    // 1. Kiểm tra tồn tại
    $stmt = $pdo->prepare("SELECT * FROM omr_workspace WHERE id = ? AND status = 'waiting'");
    $stmt->execute([$job_id]);
    $job = $stmt->fetch();

    if (!$job) {
        die("Không tìm thấy Job hoặc đã xử lý\n");
    }

    // 2. Chuyển trạng thái: Processing
    $pdo->prepare("UPDATE omr_workspace SET status = 'processing' WHERE id = ?")->execute([$job_id]);

    // Các biến đường dẫn
    $ext = pathinfo($job['original_filename'], PATHINFO_EXTENSION);
    $inputFile = realpath(WORKSPACE_DIR) . DIRECTORY_SEPARATOR . $job_id . '.' . $ext;
    $outputDir = realpath(WORKSPACE_DIR);
    $musicXmlFile = $job_id . '.mxl'; // Audiveris xuất file tên thư mục .mxl hoặc file chuẩn
    
    // ----------- CALL ENGINE (OEMER) -------------
    // Gọi oemer của Python để nhận diện ảnh thành musicxml
    $outputBaseName = $job_id;
    
    // Tìm đường dẫn thực thi của Oemer trên máy người dùng Windows
    $oemerExe = 'oemer'; // Mặc định cho Docker (linux)
    if (file_exists('C:\Users\haing\AppData\Roaming\Python\Python310\Scripts\oemer.exe')) {
        $oemerExe = 'C:\Users\haing\AppData\Roaming\Python\Python310\Scripts\oemer.exe';
    }

    $command = sprintf(
        '%s %s -o %s 2>&1',
        escapeshellarg($oemerExe),
        escapeshellarg($inputFile),
        escapeshellarg($outputDir)
    );

    // Chạy CLI Oemer
    exec($command, $output, $returnVar);

    // GHI LOG (Tuỳ chọn để debug)
    file_put_contents(WORKSPACE_DIR . $job_id . '_log.txt', implode("\n", $output));

    if ($returnVar === 0) {
        // oemer xuất file có tên input + .musicxml
        $folderName = pathinfo($inputFile, PATHINFO_FILENAME);
        $generatedFile = $outputDir . DIRECTORY_SEPARATOR . $folderName . '.musicxml';
        
        if (file_exists($generatedFile)) {
            $finalPath = $outputDir . DIRECTORY_SEPARATOR . $musicXmlFile;
            
            // Chạy công cụ đồng bộ XML (omr_sync)
            $templatePath = realpath(__DIR__ . '/../storage/Thanh ca/001 HỠI THÁNH VƯƠNG, KÍP NGỰ LAI.xml');
            if (file_exists($templatePath)) {
                $syncCommand = sprintf(
                    'php %s %s %s %s 2>&1',
                    escapeshellarg(realpath(__DIR__ . '/../tools/omr_sync.php')),
                    escapeshellarg($templatePath),
                    escapeshellarg($generatedFile),
                    escapeshellarg($finalPath)
                );
                exec($syncCommand, $syncOutput, $syncReturnVar);
                file_put_contents(WORKSPACE_DIR . $job_id . '_sync_log.txt', implode("\n", $syncOutput));
                
                if ($syncReturnVar !== 0) {
                     // Nếu sync fail, fallback dùng trực tiếp XML của oemer
                     rename($generatedFile, $finalPath);
                } else {
                     // Xóa file raw của oemer
                     @unlink($generatedFile);
                }
            } else {
                // Nếu không có template, dùng luôn file do oemer tạo
                rename($generatedFile, $finalPath);
            }
            
            // Cập nhật Database
            $pdo->prepare("UPDATE omr_workspace SET status = 'completed', musicxml_path = ? WHERE id = ?")
                ->execute([$musicXmlFile, $job_id]);
        } else {
            // Không tìm thấy file xml/mxl nào
            $pdo->prepare("UPDATE omr_workspace SET status = 'error' WHERE id = ?")->execute([$job_id]);
        }

        // Dọn dẹp thư mục tạm Audiveris sinh ra (nếu muốn)
        // ...
        
    } else {
        // Xảy ra lỗi crash hoặc return code != 0
        $pdo->prepare("UPDATE omr_workspace SET status = 'error' WHERE id = ?")->execute([$job_id]);
    }

} catch (Exception $e) {
    // Log exception
    $pdo->prepare("UPDATE omr_workspace SET status = 'error' WHERE id = ?")->execute([$job_id]);
    file_put_contents(WORKSPACE_DIR . $job_id . '_error.txt', $e->getMessage());
}
