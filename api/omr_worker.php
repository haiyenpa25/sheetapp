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
    
    // ----------- CALL ENGINE (AUDIVERIS) -------------
    // Lưu ý: Cần chắc chắn command 'Audiveris' đã có trong Windows PATH hoặc trỏ đường dẫn tuyệt đối tới bin/Audiveris.bat
    // Ví dụ lệnh: Audiveris -batch -export -output "C:\...\omr_workspace" "C:\...\omr_workspace\omr_123.pdf"
    
    $command = sprintf(
        'Audiveris -batch -export -output %s %s 2>&1',
        escapeshellarg($outputDir),
        escapeshellarg($inputFile)
    );

    // Chạy CLI
    exec($command, $output, $returnVar);

    // GHI LOG (Tuỳ chọn để debug)
    file_put_contents(WORKSPACE_DIR . $job_id . '_log.txt', implode("\n", $output));

    if ($returnVar === 0) {
        // Cập nhật thành công. 
        // Tuy nhiên Audiveris xuất file ra thư mục con có tên giống tên file input (trừ đuôi).
        // Ví dụ: omr_workspace/omr_123/omr_123.mxl
        // Do đó cần logic dò tìm file mxl/xml trong folder vừa tạo và di chuyển nó ra ngoài, sau đó đổi tên thành $musicXmlFile.
        
        $folderName = pathinfo($inputFile, PATHINFO_FILENAME);
        $audiverisFolder = $outputDir . DIRECTORY_SEPARATOR . $folderName;
        
        // Dò file .mxl sinh ra
        $mxlFiles = glob($audiverisFolder . DIRECTORY_SEPARATOR . '*.mxl');
        if (empty($mxlFiles)) {
             $mxlFiles = glob($audiverisFolder . DIRECTORY_SEPARATOR . '*.xml'); // fallback
        }

        if (!empty($mxlFiles)) {
            $generatedFile = $mxlFiles[0];
            $finalPath = $outputDir . DIRECTORY_SEPARATOR . $musicXmlFile;
            rename($generatedFile, $finalPath);
            
            // Cập nhật thành công
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
