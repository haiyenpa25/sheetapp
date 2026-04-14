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

<!-- ===== HELP MODAL ===== -->
<div id="help-modal" class="modal-overlay hidden" style="align-items:flex-start; padding: 1rem;">
  <div class="modal-box" style="max-width:740px; width:100%; margin:auto; max-height:90vh; display:flex; flex-direction:column;">
    <div class="modal-header" style="flex-shrink:0;">
      <div style="display:flex; align-items:center; gap:.75rem;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <h3 style="margin:0; font-size:1rem;">Huong Dan Su Dung SheetApp</h3>
      </div>
      <button id="btn-close-help" class="icon-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
    <div style="display:flex;gap:.3rem;padding:.65rem 1rem .25rem;border-bottom:1px solid var(--border);flex-shrink:0;overflow-x:auto;scrollbar-width:none;">
      <button class="help-tab active" data-tab="basics">Nhac</button>
      <button class="help-tab" data-tab="transpose">Dich Giong</button>
      <button class="help-tab" data-tab="chords">Hop Am</button>
      <button class="help-tab" data-tab="lyric">Loi Nhac</button>
      <button class="help-tab" data-tab="compact">Gon Nhe</button>
      <button class="help-tab" data-tab="tips">Meo</button>
    </div>
    <div class="help-body" style="flex:1;overflow-y:auto;padding:1.25rem;">
      <div class="help-pane active" id="help-tab-basics">
        <p>Chon bai hat tu sidebar trai. Zoom bang thanh truot. Phat nhac MIDI bang nut Phat. Cuon tu dong bang menu Cuon.</p>
        <h4>Tim kiem</h4>
        <ul><li>Ten bai hat (VD: "Phuoc Nguyen")</li><li>So bai (VD: "028")</li><li>Loc danh muc qua dropdown</li></ul>
      </div>
      <div class="help-pane hidden" id="help-tab-transpose">
        <p>Bam nut tang/giam tong trong thanh trang phia tren ban nhac. Reset de ve tong goc. Trang thai luu tu dong.</p>
      </div>
      <div class="help-pane hidden" id="help-tab-chords">
        <p>Bam "Them Hop Am" de vao che do sua. Bam cham tim (+) de them hop am. Bam chu hop am do de sua/xoa.</p>
      </div>
      <div class="help-pane hidden" id="help-tab-lyric">
        <p>Bam "Loi Nhac" tren toolbar. Hop am hien thi mau do phia tren loi ca. Ho tro dich giong. Bam "Ban Nhac" de quay lai.</p>
      </div>
      <div class="help-pane hidden" id="help-tab-compact">
        <p>Bam "Gon Nhe" tren toolbar. Bam gear de chon: An Khoa Fa / An Be Phu / An Not Chum / An Ten Bai.</p>
      </div>
      <div class="help-pane hidden" id="help-tab-tips">
        <h4>Phim tat</h4>
        <ul><li>Up/Down: Bai truoc/tiep</li><li>Left/Right: Trang truoc/tiep</li><li>Ctrl+/-: Zoom</li><li>Esc: Dong popup</li><li>?: Mo huong dan nay</li></ul>
      </div>
    </div>
    <div style="padding:.75rem 1.25rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
      <span style="font-size:.78rem;color:var(--text-secondary);">SheetApp - 983 bai Thanh Ca</span>
      <button id="btn-close-help-footer" class="btn btn-ghost btn-sm">Dong</button>
    </div>
  </div>
</div>
<style>
.help-tab{padding:.35rem .8rem;border-radius:20px;border:1px solid var(--border);background:transparent;color:var(--text-secondary);font-size:.78rem;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .15s;}
.help-tab:hover{background:var(--bg-overlay);color:var(--text);}
.help-tab.active{background:var(--accent);color:#fff;border-color:var(--accent);}
.help-pane{display:none;}.help-pane.active{display:block;}
.help-body h4{font-size:.9rem;font-weight:600;margin:.75rem 0 .4rem;padding-bottom:.35rem;border-bottom:1px solid var(--border);}
.help-body p,.help-body li{font-size:.87rem;color:var(--text-secondary);line-height:1.6;}
.help-body ul{padding-left:1.2rem;}
</style>
<script>
(function(){document.addEventListener('DOMContentLoaded',function(){
  var modal=document.getElementById('help-modal');
  var btnOpen=document.getElementById('btn-help');
  var btnClose=document.getElementById('btn-close-help');
  var btnCloseF=document.getElementById('btn-close-help-footer');
  function open(){modal&&modal.classList.remove('hidden');}
  function close(){modal&&modal.classList.add('hidden');}
  if(btnOpen)btnOpen.addEventListener('click',open);
  if(btnClose)btnClose.addEventListener('click',close);
  if(btnCloseF)btnCloseF.addEventListener('click',close);
  if(modal)modal.addEventListener('click',function(e){if(e.target===modal)close();});
  document.addEventListener('keydown',function(e){
    if(e.key==='?'&&!e.ctrlKey&&!e.metaKey&&document.activeElement.tagName!=='INPUT'&&document.activeElement.tagName!=='TEXTAREA'){
      if(modal&&modal.classList.contains('hidden'))open();
    }
    if(e.key==='Escape'&&modal&&!modal.classList.contains('hidden'))close();
  });
  document.querySelectorAll('.help-tab').forEach(function(tab){
    tab.addEventListener('click',function(){
      document.querySelectorAll('.help-tab').forEach(function(t){t.classList.remove('active');});
      document.querySelectorAll('.help-pane').forEach(function(p){p.classList.remove('active');p.classList.add('hidden');});
      tab.classList.add('active');
      var pane=document.getElementById('help-tab-'+tab.dataset.tab);
      if(pane){pane.classList.remove('hidden');pane.classList.add('active');}
    });
  });
});})();
</script>
