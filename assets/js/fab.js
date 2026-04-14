/**
 * fab.js — Floating Action Button (Assistive Touch)
 * v2: Fixed z-index, backdrop at body level, arc all UP-LEFT (không che nội dung)
 */
const FAB = (() => {

  let _isDragging = false;
  let _dragStartX = 0, _dragStartY = 0;
  let _fabStartX  = 0, _fabStartY  = 0;
  let _moved  = false;
  let _open   = false;
  const STORAGE_KEY = 'sheetapp_fab_pos_v2';

  /* ---------- INIT ---------- */
  function init() {
    _createFAB();
    _createBackdrop();
    _restorePosition();
    _bindEvents();
  }

  /* ---------- BACKDROP (body level — không bị ẩn sau z-index khác) ---------- */
  function _createBackdrop() {
    if (document.getElementById('fab-backdrop')) return;
    const bd = document.createElement('div');
    bd.id = 'fab-backdrop';
    bd.className = 'fab-backdrop';
    bd.addEventListener('click', _close);
    document.body.appendChild(bd);
  }

  /* ---------- BUILD FAB DOM ---------- */
  function _createFAB() {
    document.getElementById('fab-wrap')?.remove();

    const items = [
      { id: 'fab-lyric',    icon: '🎵', label: 'Lời Nhạc',  action: () => document.getElementById('btn-lyric-view')?.click()        },
      { id: 'fab-chord',    icon: '🎼', label: 'Hợp Âm',    action: () => document.getElementById('btn-add-chord-mode')?.click()    },
      { id: 'fab-annotate', icon: '✏️', label: 'Ghi Chú',   action: () => document.getElementById('btn-add-annotate-mode')?.click() },
      { id: 'fab-options',  icon: '⚙️', label: 'Tùy Chọn', action: () => document.getElementById('btn-more-options')?.click()       },
      { id: 'fab-print',    icon: '🖨️', label: 'In Nhạc',   action: _doPrint                                                        },
    ];

    const wrap = document.createElement('div');
    wrap.id    = 'fab-wrap';
    wrap.className = 'fab-wrap';

    // Items ring
    items.forEach((item, i) => {
      const btn = document.createElement('button');
      btn.id        = item.id;
      btn.className = 'fab-item';
      btn.title     = item.label;
      btn.dataset.index = String(i);
      btn.innerHTML = `<span class="fab-item-icon">${item.icon}</span><span class="fab-item-label">${item.label}</span>`;
      btn.addEventListener('click', e => { e.stopPropagation(); item.action(); _close(); });
      wrap.appendChild(btn);
    });

    // Main button
    const main = document.createElement('button');
    main.id        = 'fab-btn';
    main.className = 'fab-btn';
    main.title     = 'Tính năng';
    main.innerHTML = `
      <svg class="fab-icon-menu" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="5"  r="1.5" fill="currentColor"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
        <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
      </svg>
      <svg class="fab-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="display:none;">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>`;
    main.addEventListener('click', e => {
      e.stopPropagation();
      if (_moved) { _moved = false; return; }
      _open ? _close() : _openMenu();
    });
    wrap.appendChild(main);

    document.body.appendChild(wrap);
  }

  /* ---------- OPEN / CLOSE ---------- */
  function _openMenu() {
    _open = true;
    document.getElementById('fab-wrap')?.classList.add('fab-open');
    document.getElementById('fab-backdrop')?.classList.add('active');
    const iconMenu  = document.querySelector('.fab-icon-menu');
    const iconClose = document.querySelector('.fab-icon-close');
    if (iconMenu)  iconMenu.style.display  = 'none';
    if (iconClose) iconClose.style.display = '';
  }

  function _close() {
    _open = false;
    document.getElementById('fab-wrap')?.classList.remove('fab-open');
    document.getElementById('fab-backdrop')?.classList.remove('active');
    const iconMenu  = document.querySelector('.fab-icon-menu');
    const iconClose = document.querySelector('.fab-icon-close');
    if (iconMenu)  iconMenu.style.display  = '';
    if (iconClose) iconClose.style.display = 'none';
  }

  /* ---------- ACTIONS ---------- */
  function _doPrint() {
    const btn = document.getElementById('btn-print');
    if (btn && !btn.disabled) window.print();
    else if (window.App?.showToast) App.showToast('Mở bài hát trước khi in', 'info');
  }

  /* ---------- DRAG ---------- */
  function _bindEvents() {
    const wrap = document.getElementById('fab-wrap');
    const main = document.getElementById('fab-btn');
    if (!wrap || !main) return;

    main.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      _isDragging = true;
      _moved = false;
      const rect = wrap.getBoundingClientRect();
      _fabStartX = rect.left;
      _fabStartY = rect.top;
      _dragStartX = e.clientX;
      _dragStartY = e.clientY;
      main.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    main.addEventListener('pointermove', e => {
      if (!_isDragging) return;
      const dx = e.clientX - _dragStartX;
      const dy = e.clientY - _dragStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) _moved = true;
      if (!_moved) return;

      const sz = 56;
      const W  = window.innerWidth;
      const H  = window.innerHeight;
      let nx = Math.max(8, Math.min(_fabStartX + dx, W - sz - 8));
      let ny = Math.max(8, Math.min(_fabStartY + dy, H - sz - 8));

      wrap.style.cssText = `position:fixed; left:${nx}px; top:${ny}px; right:auto; bottom:auto; z-index:9999;`;
    });

    main.addEventListener('pointerup', () => {
      if (_isDragging && _moved) _savePosition();
      _isDragging = false;
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _open) _close();
    });
  }

  /* ---------- POSITION ---------- */
  function _savePosition() {
    const wrap = document.getElementById('fab-wrap');
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: r.left, y: r.top, mode: 'xy' })); } catch(e) {}
  }

  function _restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved || saved.mode !== 'xy') return;
      const wrap = document.getElementById('fab-wrap');
      if (!wrap) return;
      const W = window.innerWidth, H = window.innerHeight, sz = 56;
      const x = Math.max(8, Math.min(saved.x, W - sz - 8));
      const y = Math.max(8, Math.min(saved.y, H - sz - 8));
      wrap.style.cssText = `position:fixed; left:${x}px; top:${y}px; right:auto; bottom:auto; z-index:9999;`;
    } catch(e) {}
  }

  /* ---------- PUBLIC ---------- */
  function updateItemState(id, active) {
    document.getElementById(id)?.classList.toggle('fab-item-active', !!active);
  }

  // DOM đã sẵn sàng (script ở cuối body) — gọi init() ngay
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init(); // DOM đã ready
  }

  return { init, updateItemState, close: _close };
})();

window.FAB = FAB;
