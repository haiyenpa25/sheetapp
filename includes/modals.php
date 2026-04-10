<!-- ===== SESSION PANEL (SLIDE-IN) ===== -->
<div id="session-panel" class="session-panel hidden">
  <div class="panel-header">
    <h3>📋 Nhật Ký Biểu Diễn</h3>
    <button id="btn-close-session" class="icon-btn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  </div>
  <div class="panel-body">
    <div class="session-current">
      <h4>Phiên Hiện Tại</h4>
      <div class="session-meta">
        <span id="session-date" class="tag"></span>
        <span id="session-tone" class="tag tag-purple"></span>
      </div>
      <textarea id="session-note" placeholder="Ghi chú cho buổi hôm nay..." rows="3"></textarea>
      <button id="btn-save-session" class="btn btn-primary btn-sm">💾 Lưu Phiên</button>
    </div>
    <div class="session-history">
      <h4>Lịch Sử</h4>
      <div id="session-history-list" class="history-list">
        <p class="text-muted">Chưa có lịch sử</p>
      </div>
    </div>
  </div>
</div>

<!-- ===== IMPORT MODAL ===== -->
<div id="import-modal" class="modal-overlay hidden">
  <div class="modal-box">
    <div class="modal-header">
      <h3>📥 Import Bài Hát</h3>
      <button id="btn-close-import" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <!-- TAB SWITCHER -->
      <div class="tab-switcher" id="import-tabs">
        <button class="tab-btn active" data-tab="url">🌐 URL Thánh Ca</button>
        <button class="tab-btn" data-tab="upload">📁 Upload File</button>
        <button class="tab-btn" data-tab="direct">🔗 URL Direct XML</button>
      </div>

      <!-- TAB: URL Thánh Ca -->
      <div id="tab-url" class="tab-content active">
        <p class="help-text">Dán link bài hát từ <strong>thanhca.httlvn.org</strong></p>
        <div class="input-group">
          <input id="import-url-input" type="url" class="form-input" 
            placeholder="https://thanhca.httlvn.org/thanh-ca-1/ten-bai-hat?op=sheet">
          <button id="btn-fetch-url" class="btn btn-primary">Tải Về</button>
        </div>
        <div class="form-row">
          <label class="form-label">Tên hiển thị</label>
          <input id="import-url-title" type="text" class="form-input" placeholder="VD: Cúi Xin Vua Thánh Ngự Lại">
        </div>
        <div id="url-examples" class="url-examples">
          <p class="text-xs text-muted">Ví dụ:</p>
          <code class="url-example-code">https://thanhca.httlvn.org/thanh-ca-1/cui-xin-vua-thanh-ngu-lai?op=sheet</code>
        </div>
      </div>

      <!-- TAB: Upload File -->
      <div id="tab-upload" class="tab-content hidden">
        <p class="help-text">Tải file MusicXML (<code>.xml</code> hoặc <code>.mxl</code>) từ máy tính</p>
        <div id="drop-zone" class="drop-zone">
          <div class="drop-icon">📂</div>
          <p>Kéo thả file vào đây</p>
          <small>hoặc</small>
          <label class="btn btn-ghost btn-sm mt-1">
            Chọn File
            <input id="file-input" type="file" accept=".xml,.mxl,.musicxml" style="display:none">
          </label>
        </div>
        <div id="file-selected" class="file-selected hidden">
          <span class="file-icon">🎵</span>
          <span id="file-name-display"></span>
          <button id="btn-clear-file" class="icon-btn-xs">✕</button>
        </div>
        <div class="form-row mt-1">
          <label class="form-label">Tên hiển thị</label>
          <input id="import-upload-title" type="text" class="form-input" placeholder="Nhập tên bài hát">
        </div>
        <button id="btn-do-upload" class="btn btn-primary w-full mt-1" disabled>📤 Upload & Thêm Vào Thư Viện</button>
      </div>

      <!-- TAB: Direct URL -->
      <div id="tab-direct" class="tab-content hidden">
        <p class="help-text">URL trực tiếp đến file .xml hoặc .mxl</p>
        <div class="input-group">
          <input id="import-direct-input" type="url" class="form-input" 
            placeholder="https://example.com/sheet.xml">
          <button id="btn-fetch-direct" class="btn btn-primary">Tải Về</button>
        </div>
        <div class="form-row mt-1">
          <label class="form-label">Tên hiển thị</label>
          <input id="import-direct-title" type="text" class="form-input" placeholder="Nhập tên bài hát">
        </div>
      </div>

      <!-- PROGRESS -->
      <div id="import-progress" class="import-progress hidden">
        <div class="progress-bar-wrap">
          <div id="import-progress-bar" class="progress-bar"></div>
        </div>
        <p id="import-progress-text" class="text-sm text-muted mt-half">Đang xử lý...</p>
      </div>

      <!-- RESULT -->
      <div id="import-result" class="import-result hidden"></div>
    </div>
  </div>
</div>

<!-- ===== INSTRUMENT MIXER MODAL ===== -->
<div id="mixer-modal" class="modal-overlay hidden">
  <div class="modal-box" style="max-width: 400px;">
    <div class="modal-header">
      <h3>🎛 Bộ Trộn Nhạc Cụ (Mixer)</h3>
      <button id="btn-close-mixer" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <p class="help-text" style="margin-bottom:0;">Bật/tắt các dải nhạc cụ để hiển thị sheet gọng gàng hơn.</p>
      <div id="mixer-instruments-list" style="display:flex;flex-direction:column;gap:.5rem;margin-top:.5rem;max-height:300px;overflow-y:auto;padding:.5rem;background:var(--bg-overlay);border-radius:var(--radius-sm);border:1px solid var(--border);">
        <p class="text-muted text-sm text-center">Chưa có bài nhạc nào được tải.</p>
      </div>
      <button id="btn-mixer-apply" class="btn btn-primary w-full mt-1">Áp Dụng & Tải Lại</button>
    </div>
  </div>
</div>

<!-- ===== TOAST NOTIFICATION ===== -->
<div id="toast-container" class="toast-container"></div>
