/**
 * library-ui.js  v2
 * Sidebar: danh sách 903 bài, số thứ tự, tổng count, search gọn nhẹ.
 * v3: + Lyric Search, + Favorites, + Recently Viewed
 */
const LibraryUI = (() => {

  let songs         = [];
  let categories    = [];
  let activeSongId  = null;
  let onSelectCb    = null;
  let onDeleteCb    = null;
  let _lyricDebounce = null;
  let _searchMode   = 'title'; // 'title' | 'lyric'

  const listEl   = () => document.getElementById('song-list');
  const searchEl = () => document.getElementById('search-input');
  const countEl  = () => document.getElementById('library-count');

  function init() {
    searchEl()?.addEventListener('input', _onSearch);
    loadCategories();
    loadSongs();

    // Prev/Next buttons in toolbar
    document.getElementById('btn-prev-song')?.addEventListener('click', () => App?.navigatePrev?.());
    document.getElementById('btn-next-song')?.addEventListener('click', () => App?.navigateNext?.());

    // Lyric search toggle button
    document.getElementById('btn-search-lyrics')?.addEventListener('click', _toggleSearchMode);

    // History tab updates
    if (window.HistoryManager) {
      HistoryManager.init(_renderHistory);
      _renderHistory();
    }

    // Favorites tab
    document.getElementById('sidebar-tab-favs')?.addEventListener('click', () => _showFavorites());
    document.getElementById('sidebar-tab-lib')?.addEventListener('click', () => {
      _searchMode = 'title';
      render(songs);
      _renderHistory();
    });
  }

  async function loadCategories() {
    try {
      const res = await fetch('api/categories.php');
      categories = await res.json();
      const select = document.getElementById('category-filter');
      if (select && Array.isArray(categories)) {
        const optionsHtml = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        select.innerHTML = '<option value="">Tất cả danh mục</option>' + optionsHtml;
        select.addEventListener('change', _onSearch);

        const editSelect = document.getElementById('edit-song-category');
        if (editSelect) editSelect.innerHTML = optionsHtml;
      }
    } catch(err) {
      console.error('[Library] Lỗi tải categories:', err);
    }
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

      // Auto-load song from URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlSongId = urlParams.get('song');
      if (urlSongId) {
          selectSong(urlSongId, false); // false để không pushState trùng lặp
      }
    } catch (err) {
      console.error('[Library] Lỗi tải danh sách:', err);
      songs = [];
      render([]);
    }
  }

  function render(list, opts = {}) {
    const el = listEl();
    if (!el) return;

    if (!list || list.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🎶</span>
          <p>${opts.emptyMsg || 'Không tìm thấy bài hát'}</p>
          <small>${opts.emptyHint || 'Thử từ khóa khác'}</small>
        </div>`;
      return;
    }

    el.innerHTML = list.map(song => _songItemHTML(song)).join('');

    el.querySelectorAll('.song-item').forEach(item => {
      item.addEventListener('click', e => {
        if (e.target.closest('.song-delete-btn') || e.target.closest('.song-add-setlist-btn') || e.target.closest('.song-fav-btn')) return;
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
      item.querySelector('.song-fav-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        const id    = item.dataset.id;
        const song  = songs.find(s => s.id === id) || list.find(s => s.id === id);
        if (song && window.HistoryManager) {
          const added = HistoryManager.toggleFavorite(song);
          const btn   = e.currentTarget;
          btn.textContent = added ? '★' : '☆';
          btn.title = added ? 'Bỏ yêu thích' : 'Thêm yêu thích';
          btn.classList.toggle('fav-active', added);
          App?.showToast(added ? '★ Đã thêm vào Yêu Thích' : 'Đã bỏ Yêu Thích', 'success');
        }
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

  function selectSong(songId, updateUrl = true) {
    activeSongId = songId;
    _highlightActive(songId);
    
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('song', songId);
      window.history.pushState({}, '', url);
    }
    
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

  function _toggleSearchMode() {
    _searchMode = _searchMode === 'title' ? 'lyric' : 'title';
    const btn = document.getElementById('btn-search-lyrics');
    if (btn) {
      btn.classList.toggle('active', _searchMode === 'lyric');
      btn.title = _searchMode === 'lyric' ? 'Đang tìm theo Lời (click để tìm theo Tên)' : 'Tìm theo Lời bài hát';
    }
    const q = searchEl()?.value?.trim() || '';
    if (q) _onSearch();
  }

  function _onSearch() {
    const q     = (searchEl()?.value || '').trim();
    const catId = document.getElementById('category-filter')?.value || '';

    // Lyric search mode
    if (_searchMode === 'lyric' && q.length >= 2) {
      clearTimeout(_lyricDebounce);
      _lyricDebounce = setTimeout(() => _searchByLyric(q), 350);
      return;
    }

    if (!q && !catId) { render(songs); _renderHistory(); return; }

    const normalized = _removeAccents(q.toLowerCase());
    const num        = parseInt(q, 10);

    const filtered = songs.filter(s => {
      if (catId && String(s.category_id) !== String(catId)) return false;
      if (!q) return true;
      if (!isNaN(num) && s.httlvnId === num) return true;
      if (s.title.toLowerCase().includes(q.toLowerCase())) return true;
      if (_removeAccents(s.title.toLowerCase()).includes(normalized)) return true;
      if (s.defaultKey && s.defaultKey.toLowerCase().includes(q.toLowerCase())) return true;
      return false;
    });

    _renderHistory();
    render(filtered);
  }

  async function _searchByLyric(q) {
    const listE = listEl();
    if (!listE) return;
    listE.innerHTML = '<div class="empty-state"><span class="empty-icon">🔍</span><p>Đang tìm theo lời...</p></div>';
    try {
      const res  = await fetch('api/songs.php?lyric_search=' + encodeURIComponent(q));
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        render([], { emptyMsg: 'Không tìm thấy bài nào', emptyHint: 'Thử từ khác hoặc chuyển sang tìm tên' });
        return;
      }
      // Render với lyric snippet
      listE.innerHTML = data.map(song => _songItemHTML(song, song.lyric_snippet)).join('');
      listE.querySelectorAll('.song-item').forEach(item => {
        item.addEventListener('click', () => selectSong(item.dataset.id));
      });
      if (activeSongId) _highlightActive(activeSongId);
    } catch(err) {
      render([], { emptyMsg: 'Lỗi tìm kiếm lời', emptyHint: err.message });
    }
  }

  /* ---- INTERNAL ---- */

  function _songItemHTML(song, lyricSnippet) {
    const num      = song.httlvnId ? String(song.httlvnId).padStart(3, '0') : '';
    const keyBadge = song.defaultKey ? `<span class="tag tag-purple">${song.defaultKey}</span>` : '';
    const isFav    = window.HistoryManager ? HistoryManager.isFavorite(song.id) : false;
    const snippetHtml = lyricSnippet
      ? `<div class="song-item-snippet">${_esc(lyricSnippet)}</div>`
      : '';

    return `
      <div class="song-item" data-id="${_esc(song.id)}" title="${_esc(song.title)}">
        <div class="song-item-num">${num}</div>
        <div class="song-item-info">
          <div class="song-item-title">${_esc(song.title)}</div>
          <div class="song-item-meta">${keyBadge}${snippetHtml}</div>
        </div>
        <div class="song-item-actions">
          <button class="icon-btn-xs song-fav-btn ${isFav ? 'fav-active' : ''}" title="${isFav ? 'Bỏ yêu thích' : 'Yêu thích'}">${isFav ? '★' : '☆'}</button>
          <button class="icon-btn-xs song-add-setlist-btn hidden" title="Thêm vào Setlist">✚</button>
          <button class="icon-btn-xs song-delete-btn" title="Xoá bài hát">🗑</button>
        </div>
      </div>`;
  }

  /* ---- RECENTLY VIEWED ---- */

  function _renderHistory() {
    if (!window.HistoryManager) return;
    const container = document.getElementById('recently-viewed-section');
    if (!container) return;
    const history = HistoryManager.getHistory();
    if (!history || history.length === 0) {
      container.style.display = 'none';
      return;
    }
    const top5 = history.slice(0, 5);
    container.style.display = '';
    container.innerHTML = `
      <div class="recent-header">
        <span>🕒 Gần Đây</span>
        <button id="btn-clear-history" class="icon-btn-xs" title="Xóa lịch sử" style="font-size:.7rem; opacity:.6;">✕</button>
      </div>
      <div class="recent-list">
        ${top5.map(s => `
          <div class="recent-item" data-id="${_esc(s.id)}" title="${_esc(s.title)}">
            <span class="recent-num">${s.httlvnId ? String(s.httlvnId).padStart(3,'0') : ''}</span>
            <span class="recent-title">${_esc(s.title)}</span>
            ${s.defaultKey ? `<span class="tag tag-purple" style="font-size:.65rem;padding:.1rem .35rem;">${s.defaultKey}</span>` : ''}
          </div>`).join('')}
      </div>`;
    container.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => selectSong(item.dataset.id));
    });
    container.querySelector('#btn-clear-history')?.addEventListener('click', e => {
      e.stopPropagation();
      HistoryManager.clearHistory();
    });
  }

  function _showFavorites() {
    if (!window.HistoryManager) return;
    const favs = HistoryManager.getFavorites();
    if (favs.length === 0) {
      render([], { emptyMsg: '⭐ Chưa có bài yêu thích', emptyHint: 'Bấm ☆ bên cạnh mỗi bài để thêm' });
    } else {
      render(favs.slice().reverse()); // Mới nhất trước
    }
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
