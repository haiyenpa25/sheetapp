/**
 * library-ui.js  v2
 * Sidebar: danh sách 903 bài, số thứ tự, tổng count, search gọn nhẹ.
 */
const LibraryUI = (() => {

  let songs         = [];
  let activeSongId  = null;
  let onSelectCb    = null;
  let onDeleteCb    = null;

  const listEl   = () => document.getElementById('song-list');
  const searchEl = () => document.getElementById('search-input');
  const countEl  = () => document.getElementById('library-count');

  /* ---- PUBLIC ---- */

  function init() {
    searchEl()?.addEventListener('input', _onSearch);
    loadSongs();

    // Prev/Next buttons in toolbar
    document.getElementById('btn-prev-song')?.addEventListener('click', () => App?.navigatePrev?.());
    document.getElementById('btn-next-song')?.addEventListener('click', () => App?.navigateNext?.());
  }

  async function loadSongs() {
    try {
      const res = await fetch('api/songs.php');
      songs = await res.json();
      if (!Array.isArray(songs)) songs = [];
      // Sắp xếp theo httlvnId nếu có
      songs.sort((a, b) => (a.httlvnId || 0) - (b.httlvnId || 0));
      render(songs);
      _updateCount(songs.length);
    } catch (err) {
      console.error('[Library] Lỗi tải danh sách:', err);
      songs = [];
      render([]);
    }
  }

  function render(list) {
    const el = listEl();
    if (!el) return;

    if (!list || list.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🎶</span>
          <p>Không tìm thấy bài hát</p>
          <small>Thử từ khóa khác</small>
        </div>`;
      return;
    }

    el.innerHTML = list.map(song => _songItemHTML(song)).join('');

    el.querySelectorAll('.song-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.song-delete-btn') || e.target.closest('.song-add-setlist-btn')) return;
        selectSong(item.dataset.id);
      });
      item.querySelector('.song-delete-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        const id   = item.dataset.id;
        const name = songs.find(s => s.id === id)?.title || 'bài này';
        if (confirm(`Xoá "${name}" khỏi thư viện?`)) deleteSong(id);
      });
      item.querySelector('.song-add-setlist-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        const id = item.dataset.id;
        _promptAddToSetlist(id);
      });
    });

    if (activeSongId) _highlightActive(activeSongId);
    
    // Toggle admin buttons
    if (window.Auth && window.Auth.isAdmin()) {
      el.querySelectorAll('.song-add-setlist-btn').forEach(b => b.classList.remove('hidden'));
    }
  }

  async function _promptAddToSetlist(songId) {
    const res = await fetch('api/setlists.php');
    const data = await res.json();
    if (!data.success || data.data.length === 0) {
      window.App?.showToast('Chưa có Setlist nào được tạo', 'error');
      return;
    }
    const sls = data.data.map(sl => `${sl.id}: ${sl.title}`).join('\\n');
    const setId = prompt(`Nhập ID của Setlist muốn thêm vào:\\n${sls}`);
    if (!setId) return;
    
    await fetch('api/setlists.php?action=add_item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setlist_id: parseInt(setId), song_id: songId, chord_profile: 'default' })
    });
    window.App?.showToast('Đã thêm bài hát vào Setlist', 'success');
  }

  function selectSong(songId) {
    activeSongId = songId;
    _highlightActive(songId);
    const song = songs.find(s => String(s.id) === String(songId));
    if (song && onSelectCb) onSelectCb(song);
  }

  function addSong(song) {
    // Tránh trùng
    if (!songs.find(s => String(s.id) === String(song.id))) {
      songs.push(song);
      songs.sort((a, b) => (a.httlvnId || 0) - (b.httlvnId || 0));
    }
    render(songs);
    _updateCount(songs.length);
    selectSong(song.id);
  }

  async function deleteSong(songId) {
    try {
      await fetch(`api/songs.php?id=${encodeURIComponent(songId)}`, { method: 'DELETE' });
      songs = songs.filter(s => s.id !== songId);
      if (activeSongId === songId) activeSongId = null;
      render(songs);
      _updateCount(songs.length);
      if (onDeleteCb) onDeleteCb(songId);
    } catch (err) {
      console.error('[Library] Lỗi xoá:', err);
      App?.showToast('Không thể xoá bài hát', 'error');
    }
  }

  function onSelect(cb) { onSelectCb = cb; }
  function onDelete(cb) { onDeleteCb = cb; }
  function getSongs()      { return songs; }
  function getActiveSong() { return songs.find(s => s.id === activeSongId) || null; }

  /* ---- SEARCH ---- */

  function _onSearch(e) {
    const q = e.target.value.trim();
    if (!q) { render(songs); return; }

    const normalized = _removeAccents(q.toLowerCase());
    const num        = parseInt(q, 10);

    const filtered = songs.filter(s => {
      // Tìm theo số bài
      if (!isNaN(num) && s.httlvnId === num) return true;
      // Tìm theo tên có dấu
      if (s.title.toLowerCase().includes(q.toLowerCase())) return true;
      // Tìm theo tên không dấu
      if (_removeAccents(s.title.toLowerCase()).includes(normalized)) return true;
      // Tìm theo key
      if (s.defaultKey && s.defaultKey.toLowerCase().includes(q.toLowerCase())) return true;
      return false;
    });

    render(filtered);
  }

  /* ---- INTERNAL ---- */

  function _songItemHTML(song) {
    const num    = song.httlvnId ? String(song.httlvnId).padStart(3, '0') : '';
    const keyBadge = song.defaultKey
      ? `<span class="tag tag-purple">${song.defaultKey}</span>`
      : '';

    return `
      <div class="song-item" data-id="${_esc(song.id)}" title="${_esc(song.title)}">
        <div class="song-item-num">${num}</div>
        <div class="song-item-info">
          <div class="song-item-title">${_esc(song.title)}</div>
          <div class="song-item-meta">${keyBadge}</div>
        </div>
        <div class="song-item-actions">
          <button class="icon-btn-xs song-add-setlist-btn hidden" title="Thêm vào Setlist">✚</button>
          <button class="icon-btn-xs song-delete-btn" title="Xoá bài hát">🗑</button>
        </div>
      </div>`;
  }

  function _updateCount(n) {
    const el = countEl();
    if (el) el.textContent = n.toLocaleString('vi-VN');
    _buildQuickJump(n);
  }

  function _buildQuickJump(total) {
    const container = document.getElementById('quick-jump-btns');
    if (!container || total === 0) return;

    const STEP = 100;
    const groups = [];
    for (let start = 1; start <= total; start += STEP) {
      const end = Math.min(start + STEP - 1, total);
      groups.push({ start, end });
    }

    // Nếu chỉ 1 nhóm → ẩn quick jump
    const jumpEl = document.getElementById('quick-jump');
    if (groups.length <= 1) { if (jumpEl) jumpEl.style.display = 'none'; return; }
    if (jumpEl) jumpEl.style.display = '';

    container.innerHTML = groups.map(g =>
      `<button class="quick-jump-btn" data-start="${g.start}" data-end="${g.end}" title="Bài ${g.start}–${g.end}">
        ${g.start}–${g.end}
      </button>`
    ).join('');

    container.querySelectorAll('.quick-jump-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const start = parseInt(btn.dataset.start);
        const end   = parseInt(btn.dataset.end);
        const filtered = songs.filter(s => s.httlvnId >= start && s.httlvnId <= end);

        // Clear search box
        const sEl = searchEl();
        if (sEl) sEl.value = '';

        // Highlight active jump button
        container.querySelectorAll('.quick-jump-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        render(filtered);
      });
    });

    // Nút "Tất cả" để reset
    const allBtn = document.createElement('button');
    allBtn.className = 'quick-jump-btn quick-jump-all';
    allBtn.textContent = 'Tất cả';
    allBtn.title = 'Hiện tất cả bài';
    allBtn.addEventListener('click', () => {
      container.querySelectorAll('.quick-jump-btn').forEach(b => b.classList.remove('active'));
      allBtn.classList.add('active');
      if (searchEl()) searchEl().value = '';
      render(songs);
    });
    container.prepend(allBtn);
    allBtn.classList.add('active'); // Mặc định "Tất cả" active
  }

  function _highlightActive(id) {
    listEl()?.querySelectorAll('.song-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === id);
    });

    // Scroll active vào view
    const activeEl = listEl()?.querySelector('.song-item.active');
    activeEl?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function _esc(str) {
    return String(str || '').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }

  return { init, loadSongs, render, selectSong, addSong, deleteSong, onSelect, onDelete, getSongs, getActiveSong, getSongObj: (id) => songs.find(s => String(s.id) === String(id)) };
})();
