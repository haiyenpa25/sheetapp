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
        <button class="tab-btn" data-tab="omr">🤖 OMR Station</button>
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

      <!-- TAB: OMR Station -->
      <div id="tab-omr" class="tab-content hidden">
        <p class="help-text">Tải file <strong>PDF / Hình ảnh</strong> để nhận diện tự động thành MusicXML (Audiveris).</p>
        <div id="omr-drop-zone" class="drop-zone">
          <div class="drop-icon">📷</div>
          <p>Kéo thả file hình/PDF vào đây</p>
          <label class="btn btn-ghost btn-sm mt-1">
            Chọn File
            <input id="omr-file-input" type="file" accept=".pdf,image/*" style="display:none">
          </label>
        </div>
        
        <div class="omr-queue mt-1 hidden" id="omr-queue-container" style="background:var(--bg-overlay); border:1px solid var(--border); border-radius:var(--radius-sm); padding:.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: .25rem;">
            <p class="help-text" style="margin:0; font-weight:bold;">Hàng chờ xử lý</p>
            <button id="btn-omr-refresh" class="icon-btn-xs" title="Làm mới">🔄</button>
          </div>
          <div id="omr-queue-list" style="max-height: 150px; overflow-y: auto; font-size:.8rem;">
            <!-- Rendered via JS -->
          </div>
        </div>

        <div id="omr-review-container" class="mt-1 hidden" style="border: 1px dashed var(--accent); padding: .5rem; border-radius: var(--radius-sm); background: var(--bg-surface);">
          <p class="help-text" style="color:var(--accent); font-weight:bold;">Duyệt bài hát</p>
          <input type="hidden" id="omr-review-id">
          <div class="form-row">
            <label class="form-label">Tên hiển thị</label>
            <input id="omr-review-title" type="text" class="form-input" placeholder="Tên bài hát sau khi nhận diện">
          </div>
          <div class="form-row mt-half">
            <label class="form-label">Danh mục (Category)</label>
            <select id="omr-review-category" class="form-input">
                <!-- Rendered via JS -->
            </select>
          </div>
          <div style="display:flex; gap:.5rem; margin-top:.5rem;">
            <button id="btn-omr-publish" class="btn btn-primary flex-1">Đưa Vào Kho</button>
            <button id="btn-omr-preview" class="btn btn-ghost flex-1">Xem Thử (Preview)</button>
          </div>
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

<!-- ===== AUTH MODAL ===== -->
<div id="auth-modal" class="modal-overlay hidden">
  <div class="modal-box" style="max-width: 320px;">
    <div class="modal-header">
      <h3>🔒 Đăng Nhập</h3>
      <button id="btn-close-auth" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body">
      <div id="auth-login-form">
        <div class="form-row">
          <label class="form-label">Tài khoản</label>
          <input id="auth-username-input" type="text" class="form-input" placeholder="Tên đăng nhập" autocomplete="username">
        </div>
        <div class="form-row mt-1">
          <label class="form-label">Mật khẩu</label>
          <input id="auth-password-input" type="password" class="form-input" placeholder="Mật khẩu" autocomplete="current-password">
        </div>
        <p id="auth-error" class="text-sm text-danger mt-half hidden"></p>
        <button id="btn-do-login" class="btn btn-primary w-full mt-1">Đăng Nhập</button>
      </div>
      <div id="auth-logged-in" class="hidden text-center">
        <p class="text-muted mb-1">Đang đăng nhập với quyền <strong id="auth-role-display"></strong></p>
        <button id="btn-do-logout" class="btn btn-danger w-full mt-1">Đăng Xuất</button>
      </div>
    </div>
  </div>
</div>

<!-- ===== TOAST NOTIFICATION ===== -->
<div id="toast-container" class="toast-container"></div>

<!-- ===== ADD TO SETLIST MODAL ===== -->
<div id="add-to-setlist-modal" class="modal-overlay hidden">
  <div class="modal-box">
    <div class="modal-header">
      <h3>📋 Thêm vào Setlist</h3>
      <button id="btn-close-add-setlist" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div class="modal-body" style="min-height: 150px; max-height: 300px; overflow-y: auto;">
      <p style="margin-bottom: 0.5rem; color: var(--text-secondary);">Chọn một Setlist để lưu bài hát này:</p>
      <div id="add-to-setlist-options" class="song-list" style="padding: 0;"></div>
    </div>
  </div>
</div>
