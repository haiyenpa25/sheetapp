# SheetApp Coding Standards & Architecture

Tài liệu này quy định các tiêu chuẩn viết code (Coding Standards) cho dự án SheetApp, nhằm đảm bảo mã nguồn luôn sạch sẽ, dễ đọc, và dễ bảo trì khi dự án phình to.

## 1. Quy Tắc Kích Thước File (File Size Limits)
- **Javascript / PHP Logic:** Không có file nào được vượt quá **300 dòng code**.
- **Nếu một file vượt quá 300 dòng**, lập trình viên **bắt buộc** phải tìm cách Refactor hoặc chia nhỏ nó ra thành các modules nhỏ hơn.
- **HTML/UI (PHP):** Không viết toàn bộ cấu trúc HTML vào một file `index.php`. Mỗi thành phần (Sidebar, Toolbar, Modal) phải được tách ra một file riêng trong thư mục `includes/` hoặc `components/`.

## 2. Javascript Architecture
- Tiếp tục sử dụng Module Pattern (`const ModuleName = (() => { ... })();`) để đóng gói logic, tránh gây ô nhiễm global scope.
- Các module phải tuân thủ nguyên tắc **Single Responsibility Principle (SRP)**. Thay vì một file làm tất cả (như `app.js` cũ), hãy chia thành:
    - `State` (Quản lý trạng thái)
    - `UI` (Thao tác DOM, Render giao diện)
    - `Actions / API` (Gọi API, xử lý business logic)
- Ràng buộc các file bằng thẻ `<script>` có trật tự rõ ràng trong `index.php` (hoặc thông qua một bundler nếu sau này dự án dùng Webpack/Vite).

## 3. Kiến trúc Thư mục
```text
/SheetApp
├── api/                  # Scripts backend xử lý request
├── assets/
│   ├── css/              # Stylesheets chia nhỏ theo thành phần (base.css, layout.css, components.css)
│   └── js/               # Javascript chia nhỏ theo module (app-core.js, app-ui.js, chord-canvas-*.js)
├── includes/             # PHP partials cho giao diện (sidebar.php, toolbar.php, modals.php)
├── data/                 # Thư mục lưu trữ database/file tĩnh (XML/MXL)
└── index.php             # Điểm vao của ứng dụng (Entry point), chỉ chứa require các includes
```

## 4. PHP Backend
- Tránh viết logic xử lý dữ liệu và UI chung một file.
- Trong thư mục `api/`, nếu xử lý phức tạp, hãy tách các logic chung thành các helper function thay vì viết tất cả trong một script.
- Giới hạn kích thước file áp dụng cho cả trong API.

*(Các tiêu chuẩn này cần được tuân thủ nghiêm ngặt trong mọi pull request hoặc code thay đổi mới)*
