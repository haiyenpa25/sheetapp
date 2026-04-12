<!-- SHEET VIEWER -->
<div class="sheet-viewer-wrapper" id="sheet-viewer-wrapper">
  <!-- WELCOME SCREEN -->
  <div id="welcome-screen" class="welcome-screen">
    <div class="welcome-content">
      <div class="welcome-icon">🎼</div>
      <h2>Chào mừng đến SheetApp</h2>
      <p>Hiển thị thánh ca tương tác với khả năng dịch giọng và ghi chú hợp âm</p>
      <div class="welcome-features">
        <div class="feature-item">
          <span class="feat-icon">🎵</span>
          <div>
            <strong>Hiển thị Sheet Nhạc</strong>
            <small>Render MusicXML sắc nét qua OSMD</small>
          </div>
        </div>
        <div class="feature-item">
          <span class="feat-icon">🎹</span>
          <div>
            <strong>Dịch Giọng Tức Thì</strong>
            <small>Tăng/giảm tông, hợp âm tự động theo</small>
          </div>
        </div>
        <div class="feature-item">
          <span class="feat-icon">✏️</span>
          <div>
            <strong>Chỉnh Hợp Âm</strong>
            <small>Click vào hợp âm để thay đổi</small>
          </div>
        </div>
        <div class="feature-item">
          <span class="feat-icon">📋</span>
          <div>
            <strong>Nhật Ký Biểu Diễn</strong>
            <small>Lưu lịch sử mỗi buổi tập</small>
          </div>
        </div>
      </div>
      <button id="btn-import-welcome" class="btn btn-primary btn-lg mt-2">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Import Bài Đầu Tiên
      </button>
    </div>
  </div>

  <!-- LOADING SPINNER -->
  <div id="loading-screen" class="loading-screen hidden">
    <div class="spinner-wrap">
      <div class="spinner"></div>
      <p id="loading-text">Đang tải sheet nhạc...</p>
    </div>
  </div>

  <!-- OSMD PAGE BAR -->
  <div id="page-bar" class="page-bar hidden">
    <div class="page-bar-left">
      <button id="btn-page-prev" class="icon-btn" title="Trang trước (PageUp)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <span id="page-indicator" class="page-indicator">Trang 1 / 1</span>
      <button id="btn-page-next" class="icon-btn" title="Trang tiếp (PageDown)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>

      <!-- TRANSPOSE -->
      <div class="control-group" style="margin-left: 1rem; flex-direction: row; align-items: center;">
        <label class="control-label" style="display: none;">Transpose</label>
        <div class="transpose-controls" style="background: var(--bg-overlay); border-radius: var(--radius-sm); border: 1px solid var(--border);">
          <button id="btn-transpose-down" class="icon-btn transpose-btn" title="Hạ 1 cung" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <span id="transpose-display" class="transpose-display">0</span>
          <button id="btn-transpose-up" class="icon-btn transpose-btn" title="Tăng 1 cung" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
        </div>
        <button id="btn-transpose-reset" class="btn btn-ghost btn-xs" disabled style="padding: 0.2rem 0.4rem;">Reset</button>
        <!-- AI CAPO BADGE -->
        <span id="capo-badge" class="hidden" style="margin-left:8px; font-size:11px; background:var(--primary); color:white; padding: 2px 6px; border-radius:12px; font-weight:600; cursor:help; white-space:nowrap;" title="Đề xuất kẹp Capo tự động để dễ bấm hợp âm nhất">Capo 0</span>
      </div>

    </div>
    <div class="page-bar-right">
      <!-- ZOOM -->
      <div class="control-group" style="flex-direction: row; align-items: center; margin-right: 1rem;">
        <label class="control-label" style="margin-bottom: 0; margin-right: 0.5rem; display: none;">Zoom <span id="zoom-value-label">100%</span></label>
        <div class="zoom-slider-wrap" style="background: var(--bg-overlay); padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); border: 1px solid var(--border);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="zoom-icon-sm"><circle cx="11" cy="11" r="8"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          <input id="zoom-slider" type="range" min="50" max="250" value="100" step="5" disabled style="width: 80px;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="zoom-icon-sm"><circle cx="11" cy="11" r="8"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
        </div>
      </div>

      <!-- ── Chord Set Selector ── -->
      <div class="chord-set-bar" id="chord-set-bar">
        <label for="chord-set-selector" class="chord-set-label">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
          Hợp âm:
        </label>
        <select id="chord-set-selector" class="chord-set-select" disabled
                onchange="ChordCanvas.switchSet(this.value)">
          <option value="default">Mặc định</option>
        </select>
        <button id="btn-new-chord-set" class="btn btn-xs btn-outline-primary"
                title="Tạo bộ hợp âm mới theo người"
                onclick="ChordCanvas.showNewSetModal()">
          + Tạo mới
        </button>
        <button id="btn-delete-chord-set" class="btn btn-xs btn-danger"
                title="Xóa bộ hợp âm đang chọn"
                style="display:none"
                onclick="ChordCanvas.confirmDeleteSet()">
          🗑
        </button>
      </div>

      <!-- ── Annotate Mode Button ── -->
      <button id="btn-add-annotate-mode" class="btn btn-sm btn-ghost" title="Bật chế độ ghi chú tự do">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Nốt Ghi Chú
      </button>
      <span id="add-annotate-hint" class="add-chord-hint hidden" style="color:#059669;">
        Click vào ô trống phía trên nốt để dán ghi chú •
        <button id="btn-cancel-add-annotate" class="link-btn" style="color:#059669;">Hủy</button>
      </span>

      <!-- ── Edit Mode Button ── -->
      <button id="btn-add-chord-mode" class="btn btn-sm btn-ghost" title="Bật chế độ chỉnh hợp âm (phím C)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        Thêm Hợp Âm
      </button>
      <span id="add-chord-hint" class="add-chord-hint hidden">
        Click vào ô trên nốt để nhập hợp âm •
        <button id="btn-clear-all-chords" class="link-btn text-danger hidden" style="margin-right:0.5rem;" onclick="if(confirm('Bạn chắc muốn xoá TOÀN BỘ hợp âm trong hồ sơ này?')) window.ChordCanvas.clearAllChords()">Xoá Toàn Bộ</button>
        <button id="btn-cancel-add-chord" class="link-btn">Hủy</button>
      </span>
    </div>
  </div>

  <!-- OSMD CONTAINER -->
  <div id="sheet-area" class="sheet-area hidden">
    <div id="osmd-container" class="osmd-container"></div>
  </div>
</div>
