/**
 * app.js — Main Application Controller (Core)
 * Điều phối luồng và quản lý trạng thái (State)
 */
const App = (() => {

  let currentSong      = null;   // Song object hiện đang hiển thị
  let currentTranspose = 0;      // Semitone offset hiện tại
  let currentZoom      = 1.0;    // Zoom level
  let originalXml      = null;   // MusicXML gốc (không bị thay đổi)

  /* ====================== INIT ====================== */
  function init() {
    OSMDRenderer.init('osmd-container');
    OSMDRenderer.onReady(() => {
      if (window.ChordCanvas && typeof window.ChordCanvas.onOSMDRendered === 'function') {
        window.ChordCanvas.onOSMDRendered();
      }
      if (window.AnnotationCanvas && typeof window.AnnotationCanvas.onOSMDRendered === 'function') {
        window.AnnotationCanvas.onOSMDRendered();
      }
      AppUI.enableControls(true);
      PageNav.computePages();
    });

    ChordCanvas.init();
    InstrumentMixer.init();
    AnnotationCanvas.init();
    SheetAudioPlayer.init();
    AutoScroller.init();
    PageNav.init();
    if (window.Auth) Auth.init();
    LibraryUI.init();
    if (window.SetlistUI) SetlistUI.init();
    Importer.init();
    if (window.DisplaySettings) DisplaySettings.init();

    LibraryUI.onSelect(song => loadSong(song));
    LibraryUI.onDelete(songId => {
      if (currentSong?.id === songId) {
        AppUI.showWelcome();
        currentSong = null;
        ChordCanvas.clearSong();
        AnnotationCanvas.clearSong();
        SheetAudioPlayer.stop();
        PageNav.reset();
      }
    });

    Importer.onSuccess(song => {
      LibraryUI.addSong(song);
      AppUI.showToast(`🎵 "${song.title}" đã được thêm vào thư viện!`, 'success');
    });

    _bindToolbarControls();
    _bindSessionPanel();

    const toggleSidebar = () => {
      const sidebar = document.getElementById('sidebar');
      if (!sidebar) return;
      if (window.innerWidth <= 768) {
        // Mobile: dùng mobile-hidden class
        sidebar.classList.toggle('mobile-hidden');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar.classList.contains('mobile-hidden')) {
          if (overlay) overlay.classList.add('hidden');
        } else {
          if (overlay) {
            overlay.classList.remove('hidden');
            overlay.onclick = () => {
              sidebar.classList.add('mobile-hidden');
              overlay.classList.add('hidden');
            };
          }
        }
      } else {
        // Desktop: dùng collapsed class
        sidebar.classList.toggle('collapsed');
      }
    };
    
    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', toggleSidebar);
    document.getElementById('btn-open-sidebar')?.addEventListener('click', toggleSidebar);

    // Khởi tạo: ẩn sidebar trên mobile
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar')?.classList.add('mobile-hidden');
    }

    document.getElementById('btn-fullscreen')?.addEventListener('click', AppUI.toggleFullscreen);

    _bindKeyboard();
  }

  /* ====================== LOAD SONG ====================== */
  async function loadSongWithProfile(song, targetProfile, targetTranspose = null) {
    if (window.ChordCanvas?.switchSet) {
      window.ChordCanvas.switchSet(targetProfile, false); // false = đừng reload ngay lập tức
    }
    return loadSong(song, targetTranspose);
  }

  async function loadSong(song, transposeOverride = null) {
    if (!song || !song.xmlPath) {
      AppUI.showToast('Bài hát này chưa có file sheet nhạc', 'error');
      return;
    }

    currentSong = song;
    currentTranspose = 0;
    SheetAudioPlayer.stop();
    if (window.AutoScroller) window.AutoScroller.stop();
    
    // Xoá trắng Cache Cấu hình cũ để không bị lây nhiễm (State bug fix)
    if (window.ChordCanvas?.resetSet) window.ChordCanvas.resetSet();
    if (window.InstrumentMixer?.clearState) window.InstrumentMixer.clearState();
    
    ChordCanvas.loadSong(song.id);
    AnnotationCanvas.loadSong(song.id);
    PageNav.reset();
    AppUI.showLoading(`Đang tải "${song.title}"...`);
    AppUI.enableControls(false);

    // Auto close sidebar on mobile
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar')?.classList.add('mobile-hidden');
      const overlay = document.getElementById('sidebar-overlay');
      if (overlay) overlay.classList.add('hidden');
    }

    try {
      const res = await fetch(song.xmlPath);
      if (!res.ok) throw new Error(`Không thể tải file: ${res.status}`);
      originalXml = await res.text();

      const settings = await SessionTracker.loadSong(song.id);
      
      // Ưu tiên Transpose Override từ Setlist, nếu không thì lấy Session Tracker, mặc định 0
      currentTranspose = transposeOverride !== null ? transposeOverride : (settings.lastTranspose || 0);
      currentZoom      = settings.zoomLevel     || 1.0;

      AppUI.setLoadingText('Đang xử lý dữ liệu hồ sơ...');
      let processedXml = originalXml;
      
      // Inject Custom Chords (ẩn Mặc định)
      const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';
      if (currentSet !== 'default') {
        const customChordsMap = window.ChordCanvas?.getCustomChords?.();
        processedXml = window.ChordCanvasXML?.cloneAndInjectChords?.(processedXml, customChordsMap) || processedXml;
      }

      AppUI.setLoadingText('Đang vẽ bản nhạc...');
      await OSMDRenderer.load(processedXml, currentTranspose);

      await OSMDRenderer.setZoom(currentZoom);
      document.getElementById('zoom-slider').value = Math.round(currentZoom * 100);
      document.getElementById('zoom-value-label').textContent = Math.round(currentZoom * 100) + '%';

      // Load for Audio Player
      SheetAudioPlayer.setup(OSMDRenderer.getInstance());

      AppUI.updateTransposeDisplay(currentTranspose);
      AppUI.updateSongInfo(song, currentTranspose);
      
      if (window.TransposeEngine) {
          let chordList = [];
          if (currentSet !== 'default' && window.ChordCanvas) {
              const obj = window.ChordCanvas.getCustomChords?.();
              if (obj) chordList = Object.values(obj);
          }
          if (chordList.length === 0) {
              chordList = TransposeEngine.extractChordsFromXML(processedXml);
          }
          const transposedChords = chordList.map(c => TransposeEngine.transposeChord(c, currentTranspose));
          AppUI.updateCapoBadge(TransposeEngine.suggestBestCapo(transposedChords));
      }

      AppUI.showOSMD();

      if (window.ChordCanvas?.onOSMDRendered) window.ChordCanvas.onOSMDRendered();
      if (window.AnnotationCanvas?.onOSMDRendered) window.AnnotationCanvas.onOSMDRendered();
      if (window.ChordCanvas?.refreshSetDropdown) setTimeout(() => window.ChordCanvas.refreshSetDropdown(), 200);

      AppUI.updateSessionPanel(currentTranspose, SessionTracker.getHistory());
      AppUI.showToast(`Đã mở: ${song.title}`, 'info');

    } catch (err) {
      console.error('[App] Lỗi load song:', err);
      AppUI.showToast(`Lỗi: ${err.message}`, 'error');
      AppUI.showWelcome();
    }
  }

  /* ====================== TRANSPOSE ====================== */
  let _transposeTimer = null;

  function transposeBy(delta) {
    if (!originalXml) return;

    const newVal = currentTranspose + delta;
    if (Math.abs(newVal) > 8) {
      AppUI.showToast(`Giới hạn ±8 tông`, 'warning');
      return;
    }

    currentTranspose = newVal;
    AppUI.updateTransposeDisplay(currentTranspose);
    AppUI.updateSongInfo(currentSong, currentTranspose);

    clearTimeout(_transposeTimer);
    _transposeTimer = setTimeout(() => _commitTranspose(), 400);
  }

  async function _commitTranspose() {
    if (!originalXml) return;

    const disp = document.getElementById('transpose-display');
    if (disp) disp.style.opacity = '0.5';

    // Scroll Lock Mechanism
    const container = document.querySelector('.sheet-viewer-wrapper');
    const scrollY = window.scrollY;
    const wrapScroll = container ? container.scrollTop : 0;
    if (container) container.style.minHeight = container.scrollHeight + 'px';

    try {
      let processedXml = originalXml;
      const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';
      if (currentSet !== 'default') {
        const customChordsMap = window.ChordCanvas?.getCustomChords?.();
        processedXml = window.ChordCanvasXML?.cloneAndInjectChords?.(processedXml, customChordsMap) || processedXml;
      }

      if (window.InstrumentMixer?.preserveState) window.InstrumentMixer.preserveState();

      // Sử dụng OSMD Native Transpose thay vì can thiệp thủ công vào XML
      await OSMDRenderer.reload(processedXml, currentTranspose);
      SessionTracker.setTranspose(currentTranspose);
      
      if (window.TransposeEngine) {
          let chordList = [];
          if (currentSet !== 'default' && window.ChordCanvas) {
              const obj = window.ChordCanvas.getCustomChords?.();
              if (obj) chordList = Object.values(obj);
          }
          if (chordList.length === 0) {
              chordList = TransposeEngine.extractChordsFromXML(processedXml);
          }
          
          // Dịch các hợp âm ra mảng string để tính toán Capo cho đúng key mới
          const transposedChords = chordList.map(c => TransposeEngine.transposeChord(c, currentTranspose));
          AppUI.updateCapoBadge(TransposeEngine.suggestBestCapo(transposedChords));
      }

      if (window.ChordCanvas) window.ChordCanvas.onOSMDRendered();
      if (window.AnnotationCanvas) window.AnnotationCanvas.onOSMDRendered();
    } catch (err) {
      AppUI.showToast('Lỗi khi dịch giọng', 'error');
    } finally {
      if (disp) disp.style.opacity = '';
      setTimeout(() => {
        if (container) {
            container.style.minHeight = '';
            container.scrollTop = wrapScroll;
        }
        window.scrollTo(0, scrollY);
      }, 50);
    }
  }

  async function resetTranspose() {
    if (currentTranspose === 0) return;
    clearTimeout(_transposeTimer);
    currentTranspose = 0;
    AppUI.updateTransposeDisplay(currentTranspose);
    AppUI.updateSongInfo(currentSong, 0);
    await _commitTranspose();
    SessionTracker.setTranspose(0);
  }

  /* ====================== XML NATIVE EDITING ====================== */
  async function saveModifiedXML(newXmlString) {
    if (!currentSong || !currentSong.xmlPath) return;
    try {
      const res = await fetch('api/save_xml.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filepath: currentSong.xmlPath, xml: newXmlString })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || 'Lỗi không xác định');

      originalXml = newXmlString;
      AppUI.showToast('Đã lưu hợp âm vào file gốc thành công!', 'success');
      await _commitTranspose();
      return true;
    } catch (err) {
      AppUI.showToast('Lỗi lưu file: ' + err.message, 'error');
      return false;
    }
  }

  /* ====================== ZOOM ====================== */
  async function setZoom(percent) {
    currentZoom = percent / 100;
    document.getElementById('zoom-value-label').textContent = percent + '%';
    await OSMDRenderer.setZoom(currentZoom);
    SessionTracker.setZoom(currentZoom);
    if (window.ChordCanvas) setTimeout(() => window.ChordCanvas.onOSMDRendered(), 200);
  }

  /* ====================== BIND CONTROLS ====================== */
  function _bindToolbarControls() {
    document.getElementById('btn-transpose-up')?.addEventListener('click', e => { e.currentTarget.blur(); transposeBy(+1); });
    document.getElementById('btn-transpose-down')?.addEventListener('click', e => { e.currentTarget.blur(); transposeBy(-1); });
    document.getElementById('btn-transpose-reset')?.addEventListener('click', e => { e.currentTarget.blur(); resetTranspose(); });
    document.getElementById('zoom-slider')?.addEventListener('input', e => { setZoom(parseInt(e.target.value, 10)); });
    
    document.getElementById('btn-session-panel')?.addEventListener('click', () => {
      document.getElementById('session-panel')?.classList.toggle('hidden');
    });
    
    document.getElementById('btn-dark-mode')?.addEventListener('click', () => {
      document.body.classList.toggle('dark-mode');
    });

    document.getElementById('btn-compact-mode')?.addEventListener('click', (e) => {
      const btn = e.currentTarget;
      const isCompact = OSMDRenderer.getCompactMode();
      
      OSMDRenderer.setCompactMode(!isCompact);
      
      if (!isCompact) {
         btn.classList.add('active');
         btn.style.color = 'var(--accent)';
      } else {
         btn.classList.remove('active');
         btn.style.color = '';
      }
    });

    document.getElementById('btn-print')?.addEventListener('click', () => { window.print(); });
  }

  /* ====================== KEYBOARD SHORTCUTS ====================== */
  function _bindKeyboard() {
    document.addEventListener('keydown', e => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'button' || tag === 'select') return;

      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); navigateNext(); break;
        case 'ArrowUp': e.preventDefault(); navigatePrev(); break;
        case 'ArrowRight':
          if (!e.ctrlKey && !e.metaKey && originalXml) { e.preventDefault(); transposeBy(+1); }
          break;
        case 'ArrowLeft':
          if (!e.ctrlKey && !e.metaKey && originalXml) { e.preventDefault(); transposeBy(-1); }
          break;
        case '0': if (originalXml) resetTranspose(); break;
        case 'PageDown': e.preventDefault(); PageNav.goToNext(); break;
        case 'PageUp': e.preventDefault(); PageNav.goToPrev(); break;
        case 'c': case 'C': if (originalXml) ChordCanvas.toggleAddMode(); break;
        case 'f': case 'F': AppUI.toggleFullscreen(); break;
        case 'p': case 'P': if (originalXml) window.print(); break;
        case 'Escape':
          document.getElementById('import-modal')?.classList.add('hidden');
          document.getElementById('session-panel')?.classList.add('hidden');
          if (document.body.classList.contains('fullscreen-mode')) AppUI.toggleFullscreen();
          break;
        case '+': case '=': if (e.ctrlKey) { e.preventDefault(); _adjustZoom(+10); } break;
        case '-': if (e.ctrlKey) { e.preventDefault(); _adjustZoom(-10); } break;
      }
    });
  }

  function _adjustZoom(delta) {
    const slider = document.getElementById('zoom-slider');
    if (!slider || slider.disabled) return;
    const newVal = Math.min(250, Math.max(50, parseInt(slider.value) + delta));
    slider.value = newVal;
    setZoom(newVal);
  }

  /* ====================== NAVIGATION ====================== */
  function navigateNext() {
    const songs = LibraryUI.getSongs();
    if (!songs.length) return;
    const idx = currentSong ? songs.findIndex(s => s.id === currentSong.id) : -1;
    const next = songs[idx + 1];
    if (next) LibraryUI.selectSong(next.id);
  }

  function navigatePrev() {
    const songs = LibraryUI.getSongs();
    if (!songs.length) return;
    const idx = currentSong ? songs.findIndex(s => s.id === currentSong.id) : songs.length;
    const prev = songs[idx - 1];
    if (prev) LibraryUI.selectSong(prev.id);
  }

  function _bindSessionPanel() {
    document.getElementById('btn-close-session')?.addEventListener('click', () => {
      document.getElementById('session-panel')?.classList.add('hidden');
    });

    document.getElementById('btn-save-session')?.addEventListener('click', async () => {
      const note = document.getElementById('session-note')?.value.trim() || '';
      await SessionTracker.saveNow(note);
      AppUI.updateSessionPanel(currentTranspose, SessionTracker.getHistory());
      AppUI.showToast('💾 Đã lưu nhật ký buổi hôm nay', 'success');
    });
  }

  // Boot on DOMContentLoaded
  document.addEventListener('DOMContentLoaded', init);

  return { 
    loadSong, loadSongWithProfile, transposeBy, resetTranspose, setZoom, navigateNext, navigatePrev,
    getCurrentTranspose: () => currentTranspose,
    getCurrentSongId:    () => currentSong?.id ?? null,
    getCurrentZoom:      () => currentZoom,
    saveModifiedXML,
    getOriginalXml: () => originalXml,
    showToast: (m,t) => AppUI.showToast(m,t), // alias cho các module khác
    showLoading: (t) => AppUI.showLoading(t),
    hideLoading: () => AppUI.hideLoading(),
    reloadCurrentXML: () => _commitTranspose()
  };
})();

window.App = App;
