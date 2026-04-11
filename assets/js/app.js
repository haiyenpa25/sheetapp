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

    document.getElementById('btn-toggle-sidebar')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('collapsed');
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', AppUI.toggleFullscreen);

    _bindKeyboard();
  }

  /* ====================== LOAD SONG ====================== */
  async function loadSongWithProfile(song, targetProfile) {
    if (window.ChordCanvas?.switchSet) {
      window.ChordCanvas.switchSet(targetProfile, false); // false = đừng reload ngay lập tức
    }
    return loadSong(song);
  }

  async function loadSong(song) {
    if (!song || !song.xmlPath) {
      AppUI.showToast('Bài hát này chưa có file sheet nhạc', 'error');
      return;
    }

    currentSong = song;
    currentTranspose = 0;
    SheetAudioPlayer.stop();
    if (window.AutoScroller) window.AutoScroller.stop();
    ChordCanvas.loadSong(song.id);
    AnnotationCanvas.loadSong(song.id);
    PageNav.reset();
    AppUI.showLoading(`Đang tải "${song.title}"...`);
    AppUI.enableControls(false);

    // Auto close sidebar on mobile
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar')?.classList.add('mobile-hidden');
    }

    try {
      const res = await fetch(song.xmlPath);
      if (!res.ok) throw new Error(`Không thể tải file: ${res.status}`);
      originalXml = await res.text();

      const settings = await SessionTracker.loadSong(song.id);
      currentTranspose = settings.lastTranspose || 0;
      currentZoom      = settings.zoomLevel     || 1.0;

      AppUI.setLoadingText('Đang xử lý dữ liệu hồ sơ...');
      let processedXml = originalXml;
      
      // Inject Custom Chords (ẩn Mặc định)
      const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';
      if (currentSet !== 'default') {
        const customChordsMap = window.ChordCanvas?.getCustomChords?.();
        processedXml = window.ChordCanvasXML?.cloneAndInjectChords?.(processedXml, customChordsMap) || processedXml;
      }

      const xmlToLoad = currentTranspose !== 0
        ? TransposeEngine.transposeXML(processedXml, currentTranspose)
        : processedXml;

      AppUI.setLoadingText('Đang vẽ bản nhạc...');
      await OSMDRenderer.load(xmlToLoad);

      await OSMDRenderer.setZoom(currentZoom);
      document.getElementById('zoom-slider').value = Math.round(currentZoom * 100);
      document.getElementById('zoom-value-label').textContent = Math.round(currentZoom * 100) + '%';

      // Load for Audio Player
      SheetAudioPlayer.setup(OSMDRenderer.getInstance());

      AppUI.updateTransposeDisplay(currentTranspose);
      AppUI.updateSongInfo(song, currentTranspose);
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

    try {
      let processedXml = originalXml;
      const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';
      if (currentSet !== 'default') {
        const customChordsMap = window.ChordCanvas?.getCustomChords?.();
        processedXml = window.ChordCanvasXML?.cloneAndInjectChords?.(processedXml, customChordsMap) || processedXml;
      }

      const xml = currentTranspose !== 0
        ? TransposeEngine.transposeXML(processedXml, currentTranspose)
        : processedXml;

      await OSMDRenderer.reload(xml);
      SessionTracker.setTranspose(currentTranspose);
      if (window.ChordCanvas) window.ChordCanvas.onOSMDRendered();
      if (window.AnnotationCanvas) window.AnnotationCanvas.onOSMDRendered();
    } catch (err) {
      AppUI.showToast('Lỗi khi dịch giọng', 'error');
    } finally {
      if (disp) disp.style.opacity = '';
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
