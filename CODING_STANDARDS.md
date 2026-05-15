# CODING_STANDARDS.md — Quy Tắc Code Bắt Buộc (SheetApp)

> ⚠ **AI AGENT: Đọc toàn bộ file này TRƯỚC khi viết bất kỳ dòng code nào.**
> Đây là nguồn sự thật duy nhất về tiêu chuẩn code của dự án.

---

## 1 · NGUYÊN TẮC KIẾN TRÚC

### 1.1 MVC — Tách biệt trách nhiệm

| Layer | Trách nhiệm | KHÔNG làm |
|-------|-------------|-----------|
| **Service (PHP)** | Business logic, DB queries | Render HTML, biết HTTP |
| **Controller (PHP)** | Parse request, gọi Service, trả Response | Chứa DB query, business logic |
| **UI Module (JS)** | Render DOM, lắng nghe event | Gọi fetch() trực tiếp |
| **ApiService (JS)** | Tập trung mọi fetch() call | Biết DOM, xử lý UI state |
| **Store (JS)** | Single source of truth cho app state | Gọi API, render DOM |

**Quy tắc vàng:** Module UI không bao giờ gọi `fetch()` trực tiếp. Luôn đi qua `ApiService`.

```
✅ UI Module → ApiService → Backend API
❌ UI Module → fetch() trực tiếp → Backend API
```

---

### 1.2 SOLID (áp dụng cho PHP & JS)

**S — Single Responsibility**
- Mỗi file/class/function làm đúng 1 việc
- Controller chỉ điều phối; Service chỉ xử lý logic
- Nếu hàm làm 2 việc → tách ra 2 hàm
- Nếu file JS vượt 400 dòng → xem xét tách module

**O — Open/Closed**
- Thêm tính năng bằng cách mở rộng, không sửa code hiện có
- Dùng EventBus để mở rộng thay vì chỉnh sửa module khác

**D — Dependency Inversion**
- Module JS cấp cao (app.js) phụ thuộc vào abstraction (ApiService, EventBus)
- Không import cụ thể giữa các UI module — dùng EventBus để giao tiếp

---

### 1.3 DRY — Don't Repeat Yourself

```
❌ SAI: Copy-paste logic ở 2+ nơi trong JS
✅ ĐÚNG: Tạo utility function hoặc tách vào module riêng
```

- Mọi hằng số chuỗi quan trọng (tên route, tên set) → khai báo ở đầu file
- Mọi API call pattern → ApiService (không fetch() rải rác)
- Logic tái sử dụng giữa module → util function trong module đó hoặc file riêng

---

### 1.4 Clean Code

**Đặt tên:**
```javascript
✅ loadSongById(id)          — rõ ràng, mô tả đúng
✅ isChordModeActive         — boolean bắt đầu bằng is/has/can
✅ MAX_UNDO_STEPS = 20       — constant viết hoa
✅ handleTransposeChange()   — event handler bắt đầu bằng handle
❌ getData()                 — quá chung
❌ flag, tmp, x              — không có nghĩa
❌ ChordSets_list()          — không nhất quán với camelCase
```

**Hàm:**
- Mỗi hàm ≤ 30 dòng; dài hơn → tách nhỏ
- Tham số ≤ 3; nhiều hơn → dùng object `{ param1, param2, ... }`
- Return sớm (early return) thay vì nested if-else sâu

**Comment:**
```javascript
// ✅ ĐÚNG: Giải thích TẠI SAO
// OSMD cursor chỉ available sau khi render xong, cần delay 1 frame
setTimeout(() => cursor.show(), 0);

// ❌ SAI: Mô tả lại những gì code đã nói
// Show cursor
setTimeout(() => cursor.show(), 0);
```

---

## 2 · QUY TẮC JAVASCRIPT (Vanilla ES6+)

### 2.1 Module Pattern (IIFE)

Tất cả modules dùng IIFE để tránh pollute global scope:

```javascript
/**
 * assets/js/my-module.js
 * Mô tả ngắn: module này làm gì.
 *
 * Phụ thuộc: EventBus, ApiService, Store (load trước trong index.php)
 * Public API: { init, doSomething }
 */
const MyModule = (() => {
  'use strict';

  // --- PRIVATE ---
  const SOME_CONSTANT = 'value';
  let _privateState = null;

  function _privateHelper() { ... }

  // --- PUBLIC ---
  function init() { ... }

  function doSomething(param) { ... }

  return { init, doSomething };
})();

window.MyModule = MyModule; // export ra global
```

### 2.2 Async/Await — Luôn xử lý error

```javascript
// ✅ ĐÚNG
async function loadSong(songId) {
  try {
    const data = await ApiService.songs.list();
    Store.set('currentSong', data.song);
    EventBus.emit('song:loaded', { song: data.song });
  } catch (err) {
    console.error('[MyModule] loadSong failed:', err);
    showToast('Không tải được bài hát', 'error');
  }
}

// ❌ SAI — crash nếu lỗi, không có feedback cho user
const data = await ApiService.songs.list();
```

### 2.3 Constants — Không hardcode string

```javascript
// ✅ Khai báo ở đầu module
const SET_HD      = 'HD';
const SET_DEFAULT = 'default';
const MAX_UNDO    = 20;

// ✅ Dùng constant
if (currentSet === SET_HD) { ... }

// ❌ Magic string rải rác
if (currentSet === 'HD') { ... }  // bug nếu typo
```

### 2.4 EventBus — Giao tiếp giữa modules

```javascript
// ✅ Module A phát sự kiện
EventBus.emit('song:loaded', { song, xml });

// ✅ Module B lắng nghe — không cần biết Module A tồn tại
EventBus.on('song:loaded', ({ song, xml }) => {
  renderSheet(xml);
});

// ❌ Module B gọi thẳng Module A
ChordCanvas.onSongLoaded(song); // coupling chặt, khó bảo trì
```

**Danh sách event chuẩn:**

| Event | Payload | Emit bởi | Lắng nghe bởi |
|-------|---------|----------|---------------|
| `song:selected` | `{ song }` | library-ui | app.js |
| `song:loaded` | `{ song, xml }` | song-loader | osmd-renderer, chord-canvas, ... |
| `song:cleared` | `{}` | app.js | tất cả modules |
| `transpose:changed` | `{ value }` | app-ui | chord-canvas, transpose-engine |
| `zoom:changed` | `{ value }` | app-ui | osmd-renderer |
| `chord:saved` | `{ measureIdx, noteIdx, chord }` | chord-canvas | chord-canvas-xml |

### 2.5 Store — State tập trung

```javascript
// ✅ Đọc state
const song = Store.get('currentSong');
const transpose = Store.get('currentTranspose');

// ✅ Ghi state (tự động emit event 'state:changed' và 'state:currentTranspose')
Store.set('currentTranspose', newValue);

// ❌ Lưu state trong module scope nếu đã có trong Store
let _currentTranspose = 0; // ❌ duplicate, out-of-sync
```

---

## 3 · QUY TẮC PHP (Backend)

### 3.1 Controller Pattern

```php
<?php
/**
 * api/controllers/FooController.php
 * Chỉ: parse request → gọi Service → trả Response
 * KHÔNG: chứa SQL, business logic
 */
class FooController {
    private FooService $service;

    public function __construct() {
        require_once __DIR__ . '/../core/DB.php';
        require_once __DIR__ . '/../core/Auth.php';
        require_once __DIR__ . '/../core/Response.php';
        require_once __DIR__ . '/../services/FooService.php';
        $this->service = new FooService();
    }

    public function handleRequest(string $method): void {
        match($method) {
            'GET'    => $this->get(),
            'POST'   => $this->post(),
            'DELETE' => $this->delete(),
            default  => Response::methodNotAllowed(),
        };
    }

    private function get(): void {
        $items = $this->service->getAll();
        Response::ok(['data' => $items]);
    }

    private function post(): void {
        Auth::requireLogin();
        $body = json_decode(file_get_contents('php://input'), true);
        // validate input...
        $result = $this->service->create($body);
        Response::ok(['data' => $result]);
    }
}
```

### 3.2 Service Pattern

```php
<?php
/**
 * api/services/FooService.php
 * Business logic + DB queries. KHÔNG biết HTTP.
 */
class FooService {
    private PDO $db;

    public function __construct() {
        $this->db = DB::getConnection();
    }

    public function getAll(): array {
        $stmt = $this->db->query('SELECT * FROM foo ORDER BY id');
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function create(array $data): array {
        $stmt = $this->db->prepare('INSERT INTO foo (name) VALUES (?)');
        $stmt->execute([$data['name']]);
        return ['id' => $this->db->lastInsertId(), 'name' => $data['name']];
    }
}
```

### 3.3 Response Format Chuẩn

```php
// ✅ Thành công
Response::ok(['data' => $items]);
// → {"success": true, "data": [...]}

// ✅ Lỗi
Response::error('Không tìm thấy bài hát', 404);
// → {"success": false, "error": "Không tìm thấy bài hát"}

// ❌ Trả JSON thủ công
echo json_encode(['result' => $items]); // không nhất quán
```

### 3.4 Validate Input

```php
// ✅ Validate trước khi dùng
$songId = (int)($_GET['songId'] ?? 0);
if ($songId <= 0) {
    Response::error('songId không hợp lệ');
    return;
}

// ❌ Dùng trực tiếp input từ user
$songId = $_GET['songId']; // SQL injection / type error
```

---

## 4 · QUY TẮC API LAYER (Frontend JS)

### 4.1 Mọi call qua ApiService

```javascript
// ✅ ĐÚNG — qua ApiService
const data = await ApiService.songs.list();
const result = await ApiService.chordSets.save(songId, name, chords);

// ❌ SAI — fetch trực tiếp trong module
const res = await fetch('api/index.php?route=songs');
```

### 4.2 Ngoại lệ: fetch() Static Asset

`fetch()` trực tiếp **được phép** khi tải file tĩnh (XML, image) từ server — không phải API call:

```javascript
// ✅ OK — tải file tĩnh, không phải API endpoint
// Phải có comment INTENTIONAL EXCEPTION giải thích lý do
const res = await fetch(song.xmlPath); // static XML file
```

**Điều kiện áp dụng ngoại lệ:**
1. URL là path đến static file (`.xml`, `.mxl`, `.json`, `.png`...)
2. Không phải endpoint `api/index.php?route=...`
3. Phải có comment `// INTENTIONAL EXCEPTION:` ngay trước dòng fetch()

### 4.2 Mở rộng ApiService khi có endpoint mới

```javascript
// Trong ApiService.js, thêm vào đúng domain object:
const foo = {
  list:   ()         => _request('api/index.php?route=foo'),
  create: (data)     => _json('POST', 'api/index.php?route=foo', data),
  delete: (id)       => _request(`api/index.php?route=foo&id=${id}`, { method: 'DELETE' }),
};

// Thêm vào return:
return { songs, chordSets, ..., foo };
```

---

## 5 · QUY TẮC FILE & THƯ MỤC

```
SheetApp/
├── api/
│   ├── core/           # Auth, Config, DB, Response — không sửa thường xuyên
│   ├── controllers/    # 1 file = 1 route (chỉ điều phối)
│   ├── services/       # 1 file = 1 domain (business logic + DB)
│   ├── index.php       # Front controller / Router
│   └── *.php           # Legacy endpoints (dần migrate sang MVC)
├── assets/
│   ├── css/
│   │   └── sheet.css   # CSS duy nhất — không tạo file CSS mới
│   └── js/
│       ├── core/       # ApiService, EventBus, Store — load đầu tiên
│       └── *.js        # Feature modules — mỗi file 1 module
├── includes/           # PHP view partials (toolbar, sidebar, modals)
├── docs/               # Tài liệu chi tiết theo tính năng
└── storage/            # SQLite DB, uploads — không commit vào git
```

**Quy tắc đặt tên:**

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| JS module | `kebab-case.js` | `chord-canvas.js`, `song-loader.js` |
| PHP Controller | `PascalCaseController.php` | `SongController.php` |
| PHP Service | `PascalCaseService.php` | `SongService.php` |
| CSS class | `kebab-case` | `.chord-overlay`, `.btn-primary` |
| JS const (local) | `UPPER_SNAKE` | `MAX_UNDO_STEPS` |
| JS function | `camelCase` | `loadSong()`, `handleKeyDown()` |

---

## 6 · CHECKLIST TRƯỚC KHI KẾT THÚC PHIÊN

```
☐ Mở browser → F12 Console → 0 lỗi đỏ
☐ Test tính năng vừa làm trên browser thực
☐ PHP: không có warning/deprecated trong log
☐ Mọi fetch() đi qua ApiService (không có fetch() rải rác)
☐ Mọi state quan trọng qua Store (không lưu trùng)
☐ Không có console.log debug còn sót
☐ Constants không hardcode trong function
☐ File mới đặt đúng thư mục + đăng ký trong index.php
☐ Cập nhật PROJECT_REGISTRY.md nếu tạo file mới
```

---

*Template này áp dụng riêng cho SheetApp (PHP + SQLite + Vanilla JS + OSMD).*
*Cập nhật: 2026-05-15*
