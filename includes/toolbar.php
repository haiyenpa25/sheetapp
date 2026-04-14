<!-- TOP TOOLBAR -->
<header class="toolbar" id="toolbar">
  <!-- MOBILE HAMBURGER MENU -->
  <button id="btn-open-sidebar" class="icon-btn mobile-only" title="Mở danh sách bài hát">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  </button>
  
  <div class="toolbar-left">
    <!-- PREV/NEXT NAV -->
    <div class="nav-arrows" id="nav-arrows">
      <button id="btn-prev-song" class="icon-btn" title="Bài trước (↑)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button id="btn-next-song" class="icon-btn" title="Bài tiếp theo (↓)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  </div>

  <div class="toolbar-controls" id="toolbar-controls">


    <!-- PLAY AUDIO -->
    <div class="control-group">
      <button id="btn-play-audio" class="btn btn-ghost btn-sm" disabled title="Phát nhạc đệm (Audio)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;fill:currentColor;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Phát
      </button>
      <!-- STOP AUDIO -->
      <button id="btn-stop-audio" class="btn btn-ghost btn-sm hidden" title="Dừng phát nhạc" style="color:var(--danger)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;fill:currentColor;"><rect x="6" y="6" width="12" height="12"></rect></svg>
        Dừng
      </button>
      <!-- AUDIO SPEED -->
      <select id="audio-speed" class="form-input" style="padding: 0.2rem 0.4rem; height: 26px; font-size: 0.75rem; border-color: transparent;" disabled title="Tốc độ phát">
        <option value="0.5">0.5x</option>
        <option value="0.75">0.75x</option>
        <option value="1.0" selected>1.0x</option>
        <option value="1.25">1.25x</option>
        <option value="1.5">1.5x</option>
      </select>
    </div>

    <!-- AUTO SCROLL -->
    <div class="control-group">
      <button id="btn-auto-scroll" class="btn btn-ghost btn-sm" disabled title="Tự động cuộn bản nhạc">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
        Cuộn
      </button>
      <select id="scroll-speed" class="form-input" style="padding: 0.2rem 0.4rem; height: 26px; font-size: 0.75rem; border-color: transparent;" disabled title="Tốc độ cuộn">
        <option value="1">Rùa</option>
        <option value="2" selected>Chậm</option>
        <option value="3">Vừa</option>
        <option value="4">Nhanh</option>
      </select>
    </div>

    <!-- COMPACT MODE -->
    <div class="control-group" style="position: relative; display: flex; align-items: center;">
      <button id="btn-compact-mode" class="btn btn-ghost btn-sm" title="Bật/Tắt chế độ Gọn Nhẹ" style="padding-right: 0.2rem;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:4px;"><path d="M4 14h6v6H4zm10 0h6v6h-6zM4 4h6v6H4zm10 0h6v6h-6z"></path><line x1="14" y1="14" x2="20" y2="20"></line><line x1="20" y1="14" x2="14" y2="20"></line></svg>
        <span class="hidden-mobile">Gọn Nhẹ</span>
      </button>
      <button id="btn-compact-settings" class="btn btn-ghost btn-sm" style="padding: 0 0.5rem;" title="Tuỳ chỉnh cấu hình">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h-.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      </button>
      <div id="compact-settings-panel" class="dropdown-menu hidden" style="position: absolute; top: calc(100% + 4px); right: 0; padding: 0.8rem; width: max-content; box-shadow: var(--shadow-md); border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-surface); z-index: 50; flex-direction: column; gap: 0.5rem; text-align: left; font-size: 0.85rem;">
         <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="chk-compact-bass" class="form-input" style="margin-right:8px; width:14px; height:14px;" checked> Ẩn Khóa Fa</label>
         <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="chk-compact-voices" class="form-input" style="margin-right:8px; width:14px; height:14px;" checked> Ẩn Bè Phụ</label>
         <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="chk-compact-chordnotes" class="form-input" style="margin-right:8px; width:14px; height:14px;" checked> Ẩn Nốt Dưới (Nốt Chùm)</label>
         <label style="display:flex; align-items:center; cursor:pointer; padding-top: 4px; border-top: 1px solid rgba(0,0,0,0.1);"><input type="checkbox" id="chk-compact-texts" class="form-input" style="margin-right:8px; width:14px; height:14px;" checked> Tối giản Nhạc Sĩ/Tác Giả</label>
         <label style="display:flex; align-items:center; cursor:pointer;"><input type="checkbox" id="chk-compact-title" class="form-input" style="margin-right:8px; width:14px; height:14px;"> Ẩn Tên Bài Hát</label>
      </div>
    </div>

    <!-- MORE OPTIONS DROPDOWN -->
    <details class="control-group dropdown-details" id="more-options-dropdown" style="position: relative;">
      <summary class="btn btn-ghost btn-sm" title="Tuỳ chọn thêm" style="list-style: none; cursor: pointer;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        <span class="btn-text">Tuỳ Chọn</span>
      </summary>
      <div class="dropdown-menu" id="main-dropdown-menu">
        
        <button id="btn-mixer" class="btn btn-ghost btn-sm" disabled title="Bật/Tắt nhạc cụ" style="justify-content: flex-start; padding: 0.4rem 0.5rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:8px;"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
          Mixer
        </button>

        <button id="btn-dark-mode" class="btn btn-ghost btn-sm" title="Bật giao diện Sân Khấu (Kéo màn hình đen)" style="justify-content: flex-start; padding: 0.4rem 0.5rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:8px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          Sân Khấu
        </button>



        <button id="btn-session-panel" class="btn btn-ghost btn-sm" disabled style="justify-content: flex-start; padding: 0.4rem 0.5rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Nhật Ký
        </button>

        <button id="btn-print" class="btn btn-ghost btn-sm" disabled title="In sheet nhạc" style="justify-content: flex-start; padding: 0.4rem 0.5rem;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:8px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          In Bản Nhạc
        </button>

      </div>
    </details>
    
    <script>
      (function() {
        const details = document.getElementById('more-options-dropdown');
        const menu = details?.querySelector('.dropdown-menu');
        if (!details || !menu) return;

        // Dùng position:fixed và body.appendChild để thoát overflow clipping (mobile/tablet Webkit bug)
        function positionDropdown() {
          if (menu.parentNode !== document.body) {
              document.body.appendChild(menu);
          }
          const sumRect = details.querySelector('summary').getBoundingClientRect();
          const menuW = menu.offsetWidth || 160;
          let left = sumRect.right - menuW;
          // Đảm bảo không bị cắt mép trái
          if (left < 8) left = 8;
          // Đảm bảo không bị cắt mép phải
          if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
          menu.style.position = 'fixed';
          menu.style.top = (sumRect.bottom + 5) + 'px';
          menu.style.left = left + 'px';
          menu.style.right = 'auto';
          menu.style.zIndex = '99999';
        }

        details.addEventListener('toggle', function() {
          if (details.open) {
              menu.style.display = '';
              positionDropdown();
          } else {
              menu.style.display = 'none';
          }
        });

        // Đóng dropdown khi click ra ngoài
        document.addEventListener('click', function(e) {
          if (details && !details.contains(e.target)) {
            details.removeAttribute('open');
          }
        });

        // Tự đóng khi cuộn trang
        window.addEventListener('scroll', function() {
          if (details.hasAttribute('open')) {
            details.removeAttribute('open');
          }
        }, { passive: true });

        // Đóng khi bấm nút bên trong
        details.querySelectorAll('.dropdown-menu .btn').forEach(btn => {
          btn.addEventListener('click', () => details.removeAttribute('open'));
        });

        // Cập nhật lại vị trí khi resize/scroll (phòng trường hợp toolbar scroll ngang)
        window.addEventListener('resize', function() {
          if (details.open) positionDropdown();
        });
      })();
    </script>

    <!-- AUTH / LOGIN -->
    <div class="control-group">
      <button id="btn-auth" class="btn btn-ghost btn-sm" title="Đăng nhập / Phân quyền">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        <span id="auth-username" style="margin-left: 4px; font-weight: 600;">Khách</span>
      </button>
    </div>

    <!-- FULLSCREEN -->
    <div class="control-group">
      <button id="btn-fullscreen" class="icon-btn" title="Toàn màn hình (F)" disabled>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      </button>
    </div>

  </div>
</header>
