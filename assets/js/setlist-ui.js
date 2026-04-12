/**
 * setlist-ui.js -> Quản lý tải và hiển thị danh sách mục Setlist
 */
const SetlistUI = (() => {
  'use strict';

  let _setlists = [];
  let _currentSetlist = null; // object setlist hiện tại
  let _currentIndex = -1;
  let _addingToSetlistId = null;

  async function fetchSetlists() {
    try {
      const res = await fetch('api/setlists.php');
      const data = await res.json();
      if (data.success) {
        _setlists = data.data;
        renderList();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function renderList() {
    const listEl = document.getElementById('setlist-list');
    if (!listEl) return;
    
    if (_setlists.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <p>Chưa có Setlist nào</p>
          <small>Chỉ Quản trị mới có thể tạo</small>
        </div>`;
      return;
    }

    listEl.innerHTML = '';
    _setlists.forEach(sl => {
      const item = document.createElement('div');
      item.className = 'song-item';
      item.innerHTML = `
        <div class="song-item-info">
          <div class="song-item-title">${sl.title}</div>
          <div class="song-item-meta">${sl.scheduled_date} • ${sl.item_count} bài hát</div>
        </div>
        ${window.Auth && window.Auth.isAdmin() ? `<button class="icon-btn-xs text-danger btn-del" title="Xoá">✕</button>` : ''}
      `;
      
      item.addEventListener('click', (e) => {
        if (e.target.closest('.btn-del')) return;
        viewSetlistDetail(sl.id);
      });
      
      const delBtn = item.querySelector('.btn-del');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`Bạn chắc muốn xoá setlist: ${sl.title}?`)) {
            await fetch(`api/setlists.php?id=${sl.id}`, { method: 'DELETE' });
            if (_currentSetlist?.id === sl.id) backToSetlists();
            fetchSetlists();
          }
        });
      }
      listEl.appendChild(item);
    });
  }

  async function viewSetlistDetail(id) {
    window.App?.showLoading?.('Đang tải Setlist...');
    try {
      const res = await fetch(`api/setlists.php?id=${id}`);
      const data = await res.json();
      if (data.success) {
        _currentSetlist = data.data;
        document.getElementById('setlist-list')?.classList.add('hidden');
        document.getElementById('setlist-detail')?.classList.remove('hidden');
        
        const titleEl = document.getElementById('setlist-detail-title');
        if (titleEl) titleEl.textContent = _currentSetlist.title;
        
        const addContainer = document.getElementById('setlist-add-container');
        if (addContainer) {
          addContainer.style.display = window.Auth && window.Auth.isAdmin() ? 'flex' : 'none';
        }
        
        renderSetlistItems();
      }
    } catch (e) {
      console.error(e);
    }
    window.App?.hideLoading?.();
  }

  async function renderSetlistItems() {
    const itemsEl = document.getElementById('setlist-items');
    if (!itemsEl) return;
    itemsEl.innerHTML = '';
    
    if (!_currentSetlist.items || _currentSetlist.items.length === 0) {
      itemsEl.innerHTML = '<p class="text-sm text-muted text-center py-2">Chưa có bài hát nào</p>';
      return;
    }

    await ensureSongsLoaded(); // Fix race condition cho danh sách đã lưu

    _currentSetlist.items.forEach((item, idx) => {
      const songObj = _allSongsCache.find(s => String(s.id) === String(item.song_id)) || window.LibraryUI?.getSongObj?.(item.song_id);
      const title = songObj ? songObj.title : 'Bài hát không tồn tại';
      
      const el = document.createElement('div');
      el.className = 'song-item';
      if (_currentIndex === idx) el.classList.add('active');
      
      const toneBadge = item.transpose_key && item.transpose_key != 0 ? `<span class="tag tag-purple">Tone: ${item.transpose_key > 0 ? '+' : ''}${item.transpose_key}</span>` : '';
      const chordBadge = item.chord_profile !== 'default' ? `<span class="tag">🎸 ${item.chord_profile}</span>` : '';

      el.innerHTML = `
        <div class="song-item-info">
          <div class="song-item-title">${idx + 1}. ${title}</div>
          <div class="song-item-meta text-xs" style="display:flex;gap:4px;margin-top:4px;">
            ${toneBadge} ${chordBadge}
          </div>
        </div>
        ${window.Auth && window.Auth.isAdmin() ? `<button class="icon-btn-xs text-danger btn-del-item" title="Xóa khỏi list">✕</button>` : ''}
      `;
      
      el.addEventListener('click', (e) => {
        if (e.target.closest('.btn-del-item')) return;
        _currentIndex = idx;
        renderSetlistItems();
        playCurrentItem();
      });
      
      const delBtn = el.querySelector('.btn-del-item');
      if (delBtn) {
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await fetch(`api/setlists.php?action=remove_item&id=${item.id}`, { method: 'DELETE' });
          viewSetlistDetail(_currentSetlist.id);
        });
      }
      itemsEl.appendChild(el);
    });
  }

  function backToSetlists() {
    document.getElementById('setlist-detail')?.classList.add('hidden');
    document.getElementById('setlist-list')?.classList.remove('hidden');
    document.querySelector('.toolbar-left')?.classList.remove('in-setlist');
    _currentSetlist = null;
    _currentIndex = -1;
    fetchSetlists();
  }

  async function playCurrentItem() {
    if (!_currentSetlist || !_currentSetlist.items || _currentSetlist.items.length === 0) {
       window.App?.showToast?.('Setlist trống', 'error');
       return;
    }
    if (_currentIndex >= _currentSetlist.items.length) {
       window.App?.showToast?.('Đã kết thúc Setlist!', 'success');
       _currentIndex = -1;
       renderSetlistItems();
       document.querySelector('.toolbar-left')?.classList.remove('in-setlist');
       return;
    }

    const item = _currentSetlist.items[_currentIndex];
    const songId = item.song_id;
    
    await ensureSongsLoaded();
    const songObj = _allSongsCache.find(s => String(s.id) === String(songId)) || window.LibraryUI?.getSongObj?.(songId);
    
    if (!songObj) {
      window.App?.showToast?.(`Lỗi: Không tìm thấy bài hát ID ${songId}`, 'error');
      return;
    }

    // Đưa cả profile lẫn transpose_key qua bên App
    window.App?.loadSongWithProfile?.(songObj, item.chord_profile, item.transpose_key);
    document.querySelector('.toolbar-left')?.classList.add('in-setlist');
    
    // Đánh dấu active trong detail view
    renderSetlistItems();
  }

  function promptAddSong(songId) {
    if (!_setlists || _setlists.length === 0) {
      window.App?.showToast?.('Chưa có Setlist nào. Hãy tạo Setlist trước!', 'error');
      return;
    }
    
    const modal = document.getElementById('add-to-setlist-modal');
    const optionsContainer = document.getElementById('add-to-setlist-options');
    if (!modal || !optionsContainer) return;
    
    optionsContainer.innerHTML = '';
    _setlists.forEach(sl => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost w-full text-left song-item';
      btn.style.justifyContent = 'flex-start';
      btn.textContent = sl.title;
      btn.addEventListener('click', async () => {
        await addSongToSetlist(sl.id, songId);
        modal.classList.add('hidden');
      });
      optionsContainer.appendChild(btn);
    });
    
    modal.classList.remove('hidden');
  }

  async function addSongToSetlist(setId, songId) {
    if (!window.Auth || !window.Auth.isAdmin()) {
      window.App?.showToast?.('Chỉ admin mới được thêm bài hát', 'error'); return;
    }
    const songIndex = _currentSetlist && _currentSetlist.items ? _currentSetlist.items.length : 0;
    
    let toneStr = prompt("Nhập số cung dịch giọng cho bài này (vd: -2, 0, +1):", "0");
    if (toneStr === null) return; // Hủy
    let transpose_key = parseInt(toneStr) || 0;

    try {
      const res = await fetch('api/setlists.php?action=add_item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setlist_id: setId, song_id: songId, order_index: songIndex, transpose_key: transpose_key })
      });
      const data = await res.json();
      if (data.success) {
        window.App?.showToast?.('Đã thêm vào Setlist!', 'success');
        if (_currentSetlist?.id === setId) viewSetlistDetail(setId); // Refresh detail
        fetchSetlists(); // Refresh count
      } else {
        window.App?.showToast?.(data.error || 'Lỗi thêm bài hát', 'error');
      }
    } catch(err) { console.error(err); }
  }

  function next() {
    if (_currentSetlist && _currentIndex >= 0 && _currentIndex < _currentSetlist.items.length - 1) {
      _currentIndex++;
      playCurrentItem();
    }
  }

  function prev() {
    if (_currentSetlist && _currentIndex > 0) {
      _currentIndex--;
      playCurrentItem();
    }
  }

  let _allSongsCache = [];
  let _songsPromise = null;

  async function ensureSongsLoaded() {
    if (_allSongsCache.length > 0) return;
    if (!_songsPromise) {
      _songsPromise = fetch('api/songs.php').then(r => r.json()).then(data => {
        _allSongsCache = Array.isArray(data) ? data : [];
      }).catch(e => console.error('Failed to load songs for SetlistUI', e));
    }
    await _songsPromise;
  }

  function init() {
    ensureSongsLoaded(); // Pre-load
    // Sụ kiện chuyển Tab
    const tabs = document.querySelectorAll('.sidebar-tab');
    tabs.forEach(t => {
      t.addEventListener('click', () => {
        tabs.forEach(tt => {
          tt.classList.remove('active');
          tt.style.color = 'var(--text-secondary)';
        });
        t.classList.add('active');
        t.style.color = 'var(--accent)';
        
        document.getElementById('tab-content-library').classList.add('hidden');
        document.getElementById('tab-content-setlist').classList.add('hidden');
        
        // Hiện layout mới
        if (t.dataset.tab === 'library') {
          document.getElementById('tab-content-library').classList.remove('hidden');
          document.getElementById('btn-import-sheet')?.classList.remove('hidden');
          document.getElementById('btn-create-setlist')?.classList.add('hidden');
          
          document.querySelector('.sidebar-search')?.classList.remove('hidden');
          document.querySelector('.quick-jump')?.classList.remove('hidden');
        } else {
          document.getElementById('tab-content-setlist').classList.remove('hidden');
          document.getElementById('btn-import-sheet')?.classList.add('hidden');
          if (window.Auth && window.Auth.isAdmin()) {
            document.getElementById('btn-create-setlist')?.classList.remove('hidden');
          }
          
          document.querySelector('.sidebar-search')?.classList.add('hidden');
          document.querySelector('.quick-jump')?.classList.add('hidden');
          fetchSetlists();
        }
      });
    });

    document.getElementById('btn-create-setlist')?.addEventListener('click', async () => {
      const title = prompt("Tên Setlist mới (VD: Worship CN 20/4):");
      if (!title) return;
      const res = await fetch('api/setlists.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, scheduled_date: new Date().toISOString().split('T')[0] })
      });
      const data = await res.json();
      if (data.success) fetchSetlists();
    });

    document.getElementById('btn-back-setlists')?.addEventListener('click', backToSetlists);
    
    document.getElementById('btn-play-setlist')?.addEventListener('click', () => {
      if (_currentSetlist && _currentSetlist.items && _currentSetlist.items.length > 0) {
        _currentIndex = 0;
        renderSetlistItems();
        playCurrentItem();
      }
    });

    const addInput = document.getElementById('setlist-search-song-input');
    const addResults = document.getElementById('setlist-search-results');
    if (addInput && addResults) {
      const normalize = (str) => String(str).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
      
      const renderSearchResults = (val) => {
        const allSongs = _allSongsCache;
        let matches = [];
        
        if (!val) {
          matches = allSongs.slice(0, 20); // Hiện 20 bài đầu tiên nếu chưa gõ
        } else {
          const num = parseInt(val, 10);
          matches = allSongs.filter(s => {
            if (!isNaN(num) && s.httlvnId === num) return true;
            const t = normalize(s.title || '');
            const i = normalize(s.id || '');
            const h = String(s.httlvnId || '');
            return t.includes(val) || i.includes(val) || h === val;
          }).slice(0, 20);
        }
        
        if (matches.length === 0) {
          addResults.innerHTML = '<div class="p-2 text-muted text-xs text-center">Không tìm thấy</div>';
        } else {
          let html = '';
          matches.forEach(m => {
            if (!m) return;
            const mId = m.id || '';
            const mHtt = m.httlvnId ? m.httlvnId + ' - ' : '';
            const mTitle = m.title || 'Bài hát';
            html += '<div class="song-item" style="cursor: pointer; padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--border);" data-id="' + mId + '"><div style="font-size: 0.85rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">' + mHtt + mTitle + '</div></div>';
          });
          addResults.innerHTML = html;
          
          addResults.querySelectorAll('.song-item').forEach(el => {
            el.addEventListener('click', async () => {
              addInput.value = '';
              addResults.classList.add('hidden');
              if (_currentSetlist) await addSongToSetlist(_currentSetlist.id, el.dataset.id);
            });
          });
        }
        addResults.classList.remove('hidden');
      };

      addInput.addEventListener('input', (e) => {
        const val = normalize(e.target.value).trim();
        renderSearchResults(val);
      });
      
      addInput.addEventListener('focus', (e) => {
        const val = normalize(e.target.value).trim();
        renderSearchResults(val);
      });
      
      // Đóng kết quả khi click ra ngoài
      document.addEventListener('click', (e) => {
        if (!addInput.contains(e.target) && !addResults.contains(e.target)) {
          addResults.classList.add('hidden');
        }
      });
    }

    document.getElementById('btn-close-add-setlist')?.addEventListener('click', () => {
      document.getElementById('add-to-setlist-modal')?.classList.add('hidden');
    });

    document.getElementById('btn-next-song')?.addEventListener('click', (e) => {
      if (_currentSetlist) { e.preventDefault(); e.stopPropagation(); next(); }
    }, true);
    document.getElementById('btn-prev-song')?.addEventListener('click', (e) => {
      if (_currentSetlist) { e.preventDefault(); e.stopPropagation(); prev(); }
    }, true);
  }

  return { init, fetchSetlists, next, prev, getCurrentSetlist: () => _currentSetlist, getCurrentIndex: () => _currentIndex, promptAddSong };
})();

window.SetlistUI = SetlistUI;
