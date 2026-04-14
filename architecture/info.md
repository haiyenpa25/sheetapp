# SheetApp — Architecture & Info Guide

> **Mục đích:** Tài liệu tham chiếu khi sửa chữa, debug, hoặc đề xuất tính năng mới.  
> **Cập nhật:** 2026-04-14 | **Tổng bài:** 983 | **Stack:** PHP + SQLite + Vanilla JS + OSMD

---

## 🏗️ Cấu Trúc Thư Mục

```
SheetApp/
├── index.php                  # Entry point (SPA loader)
├── includes/
│   ├── toolbar.php            # Thanh công cụ trên (header)
│   ├── sidebar.php            # Danh sách bài hát (trái)
│   ├── main-content.php       # Vùng nội dung chính
│   └── modals.php             # Các modal popup (auth, import, v.v.)
├── assets/
│   ├── css/
│   │   ├── layout.css         # Layout, toolbar, sidebar, responsive
│   │   ├── sheet.css          # OSMD container, chord bar, page bar
│   │   └── components.css     # Nút, modal, badge, dropdown
│   └── js/
│       ├── app.js             # 🎯 Controller chính — loadSong, transpose
│       ├── app-ui.js          # Toast, loading state, song info display
│       ├── osmd-renderer.js   # OSMD wrapper — load/render/zoom MusicXML
│       ├── chord-canvas.js    # Chord overlay engine (add/edit/delete)
│       ├── chord-canvas-ui.js # Popup UI cho chord editing
│       ├── chord-canvas-xml.js# Ghi/đọc hợp âm vào XML file
│       ├── display-settings.js# Compact mode, chord prefs, lyric toggle
│       ├── lyric-extractor.js # Parse XML → hiển thị lời ca + hợp âm
│       ├── transpose-engine.js# Tính toán transpose (Tonal.js)
│       ├── session-tracker.js # Lưu/restore trạng thái bài hát
│       ├── library-ui.js      # Sidebar: render danh sách, tìm kiếm
│       ├── setlist-ui.js      # Quản lý setlist (playlist biểu diễn)
│       ├── page-nav.js        # Điều hướng trang (prev/next/go-to)
│       ├── auto-scroller.js   # Tự cuộn trang (karaoke style)
│       ├── audio-player.js    # Play/Pause/Stop OSMD MIDI
│       ├── instruments.js     # InstrumentMixer (ẩn/hiện parts)
│       ├── annotation-canvas.js# Ghi chú vẽ tay lên sheet
│       ├── auth.js            # Đăng nhập/phân quyền
│       ├── admin-ui.js        # Giao diện quản trị
│       └── importer.js        # Import MusicXML từ URL/file
├── api/
│   ├── songs.php              # GET danh sách bài / metadata
│   ├── chord_sets.php         # CRUD custom chord sets
│   ├── setlists.php           # CRUD setlists
│   ├── annotations.php        # CRUD annotations
│   └── auth.php               # Login, session
├── storage/
│   └── Thanh ca/              # 983 file MusicXML (.xml)
├── data/
│   └── songs.db               # SQLite: songs, users, setlists, chord_sets
└── architecture/
    └── info.md                # File này
```

---

## 🔄 Luồng Dữ Liệu (Data Flow)

```
[User chọn bài]
     ↓
library-ui.js → app.js.loadSong(slug)
     ↓
API: songs.php → trả XML + metadata
     ↓
session-tracker.js → restore (zoom, transpose, chord_set)
     ↓
osmd-renderer.js: setZoomSilent() + load(xml, transpose)
     ↓
preprocessXML() → compact mode transformations
     ↓
OSMD render SVG → onReadyCallback()
     ↓
chord-canvas.js.onOSMDRendered()
     ↓
ChordCanvasXML.readXmlChords() → _build() → place dots/hitboxes
```

---

## 🧩 Module Map

| Module | Phụ thuộc chính | `window.*` |
|--------|----------------|------------|
| `app.js` | tất cả | `window.App` |
| `osmd-renderer.js` | OSMD lib (CDN) | `window.OSMDRenderer` |
| `chord-canvas.js` | chord-canvas-ui, chord-canvas-xml, transpose-engine | `window.ChordCanvas` |
| `chord-canvas-xml.js` | App API (songs.php) | `window.ChordCanvasXML` |
| `display-settings.js` | osmd-renderer, lyric-extractor | `window.DisplaySettings` |
| `lyric-extractor.js` | transpose-engine | `window.LyricExtractor` |
| `transpose-engine.js` | Tonal.js (CDN) | `window.TransposeEngine` |
| `session-tracker.js` | localStorage | `window.SessionTracker` |
| `auth.js` | api/auth.php | `window.Auth` |
| `annotation-canvas.js` | HTML5 Canvas API | `window.AnnotationCanvas` |

---

## 🎛️ Tính Năng Chi Tiết

### 1. Hiển Thị Sheet Nhạc
- **Engine:** OpenSheetMusicDisplay (OSMD) v1.x
- **Format:** MusicXML 3.1 Partwise (Finale, MuseScore export)
- **File chính:** `osmd-renderer.js`
- **Config quan trọng:**
  ```js
  ChordSymbolTextHeight: 2.2   // Cỡ chữ hợp âm (default 2.2)
  ChordSymbolYOffset: 0.8      // Khoảng cách chord-khuông (default 0.8)
  pageFormat: 'Endless'        // Cuộn dọc vô hạn
  ```
- **Chú ý double-render:** Dùng `setZoomSilent()` trước `load()` để tránh render 2 lần

### 2. Dịch Giọng (Transpose)
- **Files:** `transpose-engine.js` + `app.js._commitTranspose()`
- **Thư viện:** Tonal.js (`Note.transpose`, `Chord.transpose`)
- **State:** `currentTranspose` (số nguyên, bán cung, lưu trong session)
- **3 nơi cần update khi transpose:**
  1. OSMD native: `Sheet.Transpose` + `updateGraphic()`
  2. Custom chord sets: `_applyTranspose()` trong chord-canvas.js
  3. Lyric view: `_transposeChordText()` trong lyric-extractor.js (dùng Tonal.Note fallback cho chord ngắn như "Eb")

### 3. Thêm/Sửa Hợp Âm (Chord Canvas)
- **Files:** `chord-canvas.js`, `chord-canvas-ui.js`, `chord-canvas-xml.js`
- **Flow:**
  ```
  Bấm "⊕ Thêm" → setAddMode(true) → _build() tạo dots+hitboxes
  Click ô trống (+) → createPopup() → nhập → _saveChord() → injectXml() → reloadXML
  Click chord đỏ (hitbox 60×26px) → createPopup() existing → edit/delete
  ```
- **Lưu trữ:** Trực tiếp vào file XML (`<harmony>` elements)
- **Hitbox:** `opacity:0, width:60px, height:26px, pointer-events:auto` khi edit mode

### 4. Custom Chord Sets (Bộ Hợp Âm)
- Mỗi bài có thể có nhiều "bộ hợp âm" (VD: "Mặc định", "Hoài Dinh")
- **Lưu trữ:** SQLite qua `api/chord_sets.php`
- **UI:** Dropdown **"Hợp Âm: [tên]"** trong page bar
- **Lưu ý:** Chord lưu ở **tông gốc (0)**, display transpose qua `_applyTranspose()`

### 5. Lyric View (Lời Nhạc)
- **File:** `lyric-extractor.js` + `display-settings.js`
- Parse `<lyric>` elements từ XML → text-based display với hợp âm đỏ phía trên
- Khi quay lại Sheet: `App.reloadCurrentXML()` để OSMD rebuild (giữ scroll position)

### 6. Compact Mode (Gọn Nhẹ)
- **Options:** Ẩn Khóa Fa | Ẩn Bè Phụ | Ẩn Nốt Chùm | Tối Giản | Ẩn Tên Bài
- **preprocessXML():** Xóa notes/voices khỏi XML DOM trước khi OSMD render
- **⚠️ Critical:** Sau khi xóa voices, PHẢI xóa `<slur>/<tied>` orphan để OSMD không vẽ arc khổng lồ:
  ```js
  doc.querySelectorAll("notations slur").forEach(el => el.remove());
  doc.querySelectorAll("notations tied").forEach(el => el.remove());
  doc.querySelectorAll("note > tie").forEach(el => el.remove());
  ```

### 7. Performance
- **ResizeObserver debounce:** 400ms (tránh triple-render)
- **setZoomSilent():** Set zoom level trước load(), không trigger render
- **_compactTitleSVG():** Flag `_titleCompacted` — chỉ compact title 1 lần/load
- **onOSMDRendered():** `setTimeout + rAF(350ms)` để đảm bảo SVG layout xong

---

## 🗄️ Database Schema (SQLite)

```sql
songs (id, slug, title, category, key_signature, file_path, created_at)
users (id, username, password_hash, role, created_at)
setlists (id, user_id, name, songs_json, created_at)
chord_sets (id, song_id, user_id, name, chords_json, created_at)
annotations (id, song_id, user_id, data_json, created_at)
```

---

## 🐛 Known Bugs & Fixes

| Issue | File | Root Cause | Fix Applied |
|-------|------|-----------|-------------|
| Compact mode arc khổng lồ | `osmd-renderer.js:preprocessXML` | Orphan `<slur>` sau xóa voices | Xóa slur/tied sau remove |
| Chord dots lệch sau zoom | `chord-canvas.js:onOSMDRendered` | Race condition SVG layout | `rAF + 350ms` |
| Lyric view không update khi transpose | `app.js:_commitTranspose` | OSMD hidden → skip reload | Gọi `renderLyricViewIfActive` trong `finally` |
| Double render khi load | `app.js + osmd-renderer.js` | `load() + setZoom()` = 2× render | `setZoomSilent()` trước load |
| `_compactTitleSVG` nhầm chord text | `osmd-renderer.js` | Threshold 75% quá thấp | Target max-size only, exclude OSMDChordFont |
| Hitbox chord quá nhỏ | `chord-canvas.js:_placeDot` | `30×20px` miss click | Tăng `60×26px` |

---

## 📝 Template Đề Xuất Tính Năng Mới

```
### Tính Năng: [Tên ngắn gọn]

**Vị trí UI:** [Toolbar / Sidebar / Page Bar / Modal / Sheet overlay]
**File cần sửa:** [danh sách file JS/PHP/CSS]
**Data cần lưu:** [localStorage / SQLite / XML / Không]
**Ảnh hưởng:** [OSMD render / Chord Canvas / Lyric View / Performance]

**Mô tả chi tiết:**
...

**Edge cases cần xét:**
- Mobile/tablet
- Khi chưa load bài
- Khi compact mode bật
```

---

## 🚀 Deploy SOP

```bash
# Đang có SSH running: sheet5566@172.20.0.239
cd /var/www/sheetapp
git pull origin main
# Reload PHP-FPM nếu cần
sudo systemctl reload php-fpm
```

> ⚠️ File XML trong `storage/` KHÔNG commit git (gitignored, ~200MB)  
> ⚠️ Database `songs.db` KHÔNG push — migrate riêng nếu có schema changes
