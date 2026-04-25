/**
 * app.js — Main Application Controller (Core)
 * Điều phối luồng và quản lý trạng thái (State)
 */
const App = (() => {

  let currentSong      = null;   // Song object hiện đang hiển thị
  let currentTranspose = 0;      // Semitone offset hiện tại
  let currentZoom      = 1.0;    // Zoom level
  let originalXml      = null;   // MusicXML gốc (không bị thay đổi)
  let _capoLevel       = 0;      // Capo ngăn hiện tại

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
    if (window.PerformanceNotes) PerformanceNotes.init();
    if (window.SongInfoBar)      SongInfoBar.init();

    // Sprint B — Volume control
    const volSlider = document.getElementById('volume-slider');
    volSlider?.addEventListener('input', () => {
      const vol = parseInt(volSlider.value) / 100;
      _updateVolumeTrack(volSlider);
      if (window.SheetAudioPlayer?.setVolume) SheetAudioPlayer.setVolume(vol);
    });

    // Sprint F — Dark mode toggle
    const _darkBtn = document.getElementById('btn-dark-toggle');
    const _savedDark = localStorage.getItem('sheetapp_dark_mode') === '1';
    if (_savedDark) { document.body.classList.add('dark-mode'); _darkBtn?.classList.add('dark-active'); }
    _darkBtn?.addEventListener('click', () => {
      const on = document.body.classList.toggle('dark-mode');
      _darkBtn.classList.toggle('dark-active', on);
      localStorage.setItem('sheetapp_dark_mode', on ? '1' : '0');
      App.showToast(on ? '🌙 Chế độ tối' : '☀️ Chế độ sáng', 'info');
    });

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
      if (window.innerWidth <= 900) {
        // Mobile/Tablet: dùng mobile-hidden class
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

    // Khởi tạo: ẩn sidebar trên mobile/tablet
    if (window.innerWidth <= 900) {
      document.getElementById('sidebar')?.classList.add('mobile-hidden');
    }

    // Tự động tối ưu giao diện khi xoay ngang dọc thiết bị (iPad / Điện thoại)
    let _lastInnerWidth = window.innerWidth;
    window.addEventListener('resize', _debounce(() => {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (!sidebar) return;
      
      const newW = window.innerWidth;
      if (newW <= 900) {
        // Trạng thái Mobile / iPad đứng
        if (!sidebar.classList.contains('mobile-hidden') && !overlay?.classList.contains('hidden')) {
           // Đang mở sidebar trên mobile thì kệ nó
        } else {
           sidebar.classList.add('mobile-hidden');
           sidebar.classList.remove('collapsed');
           if (overlay) overlay.classList.add('hidden');
        }
      } else {
        // Trạng thái Desktop / iPad ngang (rộng > 900px)
        sidebar.classList.remove('mobile-hidden');
        if (overlay) overlay.classList.add('hidden');
      }

      // Re-render OSMD nếu chiều rộng thay đổi đáng kể (xoay màn hình)
      const widthChange = Math.abs(newW - _lastInnerWidth);
      _lastInnerWidth = newW;
      if (widthChange > 100 && OSMDRenderer.getIsLoaded()) {
        setTimeout(async () => {
          try {
            await OSMDRenderer.getInstance()?.render?.();
            if (window.ChordCanvas) window.ChordCanvas.reposition();
          } catch(e) {}
        }, 350);
      }
    }, 250));

    // Xử lý xoay màn hình riêng (orientationchange) cho iOS Safari
    if ('onorientationchange' in window) {
      window.addEventListener('orientationchange', () => {
        setTimeout(async () => {
          if (!OSMDRenderer.getIsLoaded()) return;
          try {
            await OSMDRenderer.getInstance()?.render?.();
            if (window.ChordCanvas) window.ChordCanvas.reposition();
          } catch(e) {}
        }, 500); // 500ms để layout settle sau khi xoay
      });
    }

    document.getElementById('btn-fullscreen')?.addEventListener('click', AppUI.toggleFullscreen);

    // Capo dropdown → tự động transpose + Sprint A2 chord tooltip
    document.getElementById('capo-select')?.addEventListener('change', e => {
      const newCapo = parseInt(e.target.value) || 0;
      const delta   = _capoLevel - newCapo;
      _capoLevel    = newCapo;
      if (delta !== 0) transposeBy(delta);

      const hint = document.getElementById('capo-hint');
      if (!hint) return;
      if (newCapo > 0 && window.TransposeEngine) {
        // Lấy 3 hợp âm phổ biến trong tông hiện tại và cho biết sẽ nghe như gì
        const commonRoots = ['C','F','G','Am','Dm'];
        const mapped = commonRoots.slice(0, 3).map(c => {
          const transposed = TransposeEngine.transposeChord(c, -newCapo);
          return `${transposed}→${c}`;
        }).join(' ');
        hint.textContent = `ngăn ${newCapo}: ${mapped}...`;
        hint.title = `Đàn ${mapped} — nghe như không có capo`;
      } else {
        hint.textContent = '';
      }
    });

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
    _capoLevel = 0;  // Reset capo về 0 khi load bài mới
    // Reset capo UI
    const capoSel  = document.getElementById('capo-select');
    const capoWrap = document.getElementById('capo-wrap');
    const capoHint = document.getElementById('capo-hint');
    if (capoSel)  capoSel.value = '0';
    if (capoWrap) capoWrap.classList.add('hidden');
    if (capoHint) capoHint.textContent = '';
    SheetAudioPlayer.stop();
    if (window.AutoScroller) window.AutoScroller.stop();
    
    // Xoá trắng Cache Cấu hình cũ để không bị lây nhiễm (State bug fix)
    if (window.ChordCanvas?.resetSet) window.ChordCanvas.resetSet();
    if (window.InstrumentMixer?.clearState) window.InstrumentMixer.clearState();
    
    ChordCanvas.loadSong(song.id);
    AnnotationCanvas.loadSong(song.id);
    if (window.PerformanceNotes) PerformanceNotes.loadSong(song.id);
    PageNav.reset();

    AppUI.showLoading(`Đang tải "${song.title}"...`);
    AppUI.enableControls(false);

    // Auto close sidebar on mobile/tablet
    if (window.innerWidth <= 900) {
      document.getElementById('sidebar')?.classList.add('mobile-hidden');
      const overlay = document.getElementById('sidebar-overlay');
      if (overlay) overlay.classList.add('hidden');
    }

    try {
      const res = await fetch(song.xmlPath);
      if (!res.ok) throw new Error(`Không thể tải file: ${res.status}`);
      originalXml = await res.text();

      const settings = await SessionTracker.loadSong(song.id);
      
      // Ưu tiên: 1) transposeOverride (Setlist) 2) URL param t 3) SessionTracker 4) 0
      const _urlT = window.URLState?.get?.()?.t ?? 0;
      currentTranspose = transposeOverride !== null ? transposeOverride
                       : (_urlT !== 0 ? _urlT : (settings.lastTranspose || 0));
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
      // Set zoom level TRƯỚC khi load để tránh render 2 lần (load render + setZoom render)
      OSMDRenderer.setZoomSilent(currentZoom);
      await OSMDRenderer.load(processedXml, currentTranspose);

      // Sync zoom UI — hỗ trợ cả select và input range
      const zSlider = document.getElementById('zoom-slider');
      const zoomPercent = Math.round(currentZoom * 100);
      if (zSlider) {
        const tagName = zSlider.tagName.toLowerCase();
        if (tagName === 'select') {
          // Tìm option gần nhất với zoom hiện tại
          const opts = Array.from(zSlider.options);
          const best = opts.reduce((a, b) => Math.abs(parseInt(b.value) - zoomPercent) < Math.abs(parseInt(a.value) - zoomPercent) ? b : a);
          zSlider.value = best.value;
        } else {
          zSlider.value = zoomPercent;
        }
      }
      document.getElementById('zoom-value-label').textContent = zoomPercent + '%';

      // Auto-fit zoom nếu là lần đầu mở (không có zoom đã lưu)
      if (!settings.zoomLevel) {
        setTimeout(() => _autoFitZoom(), 100);
      }


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

      // Sprint A1 — Song Info Bar
      if (window.SongInfoBar) SongInfoBar.loadSong(originalXml, song);

      // Sprint B — Enable volume slider
      const volSlider2 = document.getElementById('volume-slider');
      if (volSlider2) { volSlider2.disabled = false; _updateVolumeTrack(volSlider2); }

      AppUI.showOSMD();

      if (window.ChordCanvas?.onOSMDRendered) window.ChordCanvas.onOSMDRendered();
      if (window.AnnotationCanvas?.onOSMDRendered) window.AnnotationCanvas.onOSMDRendered();
      if (window.ChordCanvas?.refreshSetDropdown) setTimeout(() => window.ChordCanvas.refreshSetDropdown(), 200);

      AppUI.updateSessionPanel(currentTranspose, SessionTracker.getHistory());
      AppUI.showToast(`Đã mở: ${song.title}`, 'info');

      // Restore trạng thái từ URL sau khi load xong (AWAIT để chord set load xong trước khi enable controls)
      await _restoreFromURL();

      // Track recently viewed
      if (window.HistoryManager) window.HistoryManager.trackView(song);

      // Enable print button
      const printBtn = document.getElementById('btn-print');
      if (printBtn) printBtn.disabled = false;

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
    // Lưu tông vào URL
    window.URLState?.update?.({ t: currentTranspose });

    clearTimeout(_transposeTimer);
    _transposeTimer = setTimeout(() => _commitTranspose(), 400);
  }

  async function _commitTranspose(scrollSnapshot = null) {
    if (!originalXml) return;


    const disp = document.getElementById('transpose-display');
    if (disp) disp.style.opacity = '0.5';

    // Kiểm tra Lyric View có đang active không
    const lyricContainer = document.getElementById('lyric-view-container');
    const isLyricActive  = lyricContainer && !lyricContainer.classList.contains('hidden');

    // Build processedXml với custom chords (nếu có)
    let processedXml = originalXml;
    const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';
    if (currentSet !== 'default') {
      const customChordsMap = window.ChordCanvas?.getCustomChords?.();
      processedXml = window.ChordCanvasXML?.cloneAndInjectChords?.(processedXml, customChordsMap) || processedXml;
    }

    if (isLyricActive) {
      // ── Lyric View mode ────────────────────────────────────────────────
      // KHÔNG reload OSMD (container đang display:none → osmd.render() sẽ HANG)
      // Chỉ cần re-render lyric view với transpose mới
      try {
        SessionTracker.setTranspose(currentTranspose);
        if (window.DisplaySettings?.renderLyricViewIfActive) {
          window.DisplaySettings.renderLyricViewIfActive();
        }
        // Capo badge (không cần OSMD)
        if (window.TransposeEngine) {
          let chordList = [];
          if (currentSet !== 'default' && window.ChordCanvas) {
            const obj = window.ChordCanvas.getCustomChords?.();
            if (obj) chordList = Object.values(obj);
          }
          if (chordList.length === 0) chordList = TransposeEngine.extractChordsFromXML(processedXml);
          const tc = chordList.map(c => TransposeEngine.transposeChord(c, currentTranspose));
          AppUI.updateCapoBadge(TransposeEngine.suggestBestCapo(tc));
        }
      } finally {
        if (disp) disp.style.opacity = '';
      }
      return; // Xong — OSMD sẽ được reload khi user đóng lyric view
    }

    // ── Sheet View mode ───────────────────────────────────────────────────
    // Scroll Lock — dùng snapshot được truyền từ saveModifiedXML (chính xác hơn)
    // hoặc tự đo nếu gọi trực tiếp từ transpose
    const container   = document.querySelector('.sheet-viewer-wrapper');
    const scrollY     = window.scrollY;
    const wrapScrollH = scrollSnapshot?.preScrollH ?? (container ? container.scrollHeight : 0);
    const wrapScrollT = scrollSnapshot?.preScrollT ?? (container ? container.scrollTop   : 0);
    // Tỉ lệ cuộn (0.0 = đầu, 1.0 = cuối)
    const scrollRatio = wrapScrollH > 0 ? wrapScrollT / wrapScrollH : 0;
    // Giữ minHeight (chỉ set nếu chưa set bởi caller)
    if (container && !scrollSnapshot) container.style.minHeight = wrapScrollH + 'px';


    try {
      if (window.InstrumentMixer?.preserveState) window.InstrumentMixer.preserveState();
      await OSMDRenderer.reload(processedXml, currentTranspose);
      SessionTracker.setTranspose(currentTranspose);

      if (window.TransposeEngine) {
        let chordList = [];
        if (currentSet !== 'default' && window.ChordCanvas) {
          const obj = window.ChordCanvas.getCustomChords?.();
          if (obj) chordList = Object.values(obj);
        }
        if (chordList.length === 0) chordList = TransposeEngine.extractChordsFromXML(processedXml);
        const transposedChords = chordList.map(c => TransposeEngine.transposeChord(c, currentTranspose));
        AppUI.updateCapoBadge(TransposeEngine.suggestBestCapo(transposedChords));
      }

      if (window.ChordCanvas)     window.ChordCanvas.onOSMDRendered();
      if (window.AnnotationCanvas) window.AnnotationCanvas.onOSMDRendered();
    } catch (err) {
      console.warn('[App] OSMD reload lỗi:', err.message);
    } finally {
      if (disp) disp.style.opacity = '';
      // Restore scroll: dùng rAF để đảm bảo SVG đã layout xong
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (container) {
            container.style.minHeight = '';
            const newH = container.scrollHeight;
            // Tính lại scrollTop theo đúng tỉ lệ đã lưu
            const targetScrollTop = Math.round(scrollRatio * newH);
            container.scrollTo({ left: 0, top: targetScrollTop, behavior: 'instant' });
          }
          window.scrollTo({ left: 0, top: scrollY, behavior: 'instant' });
        });
      });
    }

  }


  async function resetTranspose() {
    if (currentTranspose === 0) return;
    clearTimeout(_transposeTimer);
    currentTranspose = 0;
    AppUI.updateTransposeDisplay(currentTranspose);
    AppUI.updateSongInfo(currentSong, 0);
    window.URLState?.update?.({ t: 0 });
    await _commitTranspose();
    SessionTracker.setTranspose(0);
  }

  /* ====================== XML NATIVE EDITING ====================== */
  async function saveModifiedXML(newXmlString) {
    if (!currentSong || !currentSong.xmlPath) return;

    // Snapshot scroll position NGAY LÚC GỌI (trước khi async fetch làm layout shift)
    const _scrollContainer = document.querySelector('.sheet-viewer-wrapper');
    const _preScrollH = _scrollContainer ? _scrollContainer.scrollHeight : 0;
    const _preScrollT = _scrollContainer ? _scrollContainer.scrollTop  : 0;
    // Giữ minHeight ngay để layout không co lại trong khi chờ fetch
    if (_scrollContainer && _preScrollH > 0) _scrollContainer.style.minHeight = _preScrollH + 'px';

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

      // Truyền scroll snapshot vào _commitTranspose để nó không tự đo lại
      await _commitTranspose({ preScrollH: _preScrollH, preScrollT: _preScrollT });
      return true;
    } catch (err) {
      if (_scrollContainer) _scrollContainer.style.minHeight = '';
      AppUI.showToast('Lỗi lưu file: ' + err.message, 'error');
      return false;
    }
  }


  /* ====================== ZOOM ====================== */
  async function setZoom(percent) {
    currentZoom = percent / 100;
    // Sync select element
    const slider = document.getElementById('zoom-slider');
    if (slider) {
      const tagName = slider.tagName.toLowerCase();
      if (tagName === 'select') {
        // Find closest option
        const opts = Array.from(slider.options);
        const best = opts.reduce((a, b) => Math.abs(parseInt(b.value) - percent) < Math.abs(parseInt(a.value) - percent) ? b : a);
        slider.value = best.value;
      } else {
        slider.value = percent;
      }
    }
    document.getElementById('zoom-value-label').textContent = percent + '%';
    await OSMDRenderer.setZoom(currentZoom);
    SessionTracker.setZoom(currentZoom);
    if (window.ChordCanvas) setTimeout(() => window.ChordCanvas.onOSMDRendered(), 200);
    
    const lvc = document.getElementById('lyric-view-container');
    if (lvc) lvc.style.fontSize = `${percent}%`;
  }

  /**
   * Tính zoom tự động sao cho bản nhạc vừa khung màn hình tối ưu.
   * Gọi sau khi OSMD render xong lần đầu.
   */
  function _autoFitZoom() {
    const container = document.getElementById('osmd-container');
    const svg = container?.querySelector('svg');
    if (!svg) return;
    
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    if (!wrapper) return;
    
    // Chiều rộng vùng hiển thị trừ padding
    const availableW = wrapper.clientWidth - 40; // 20px padding mỗi bên
    if (availableW <= 0) return;
    
    // Độ rộng hiện tại của SVG ở zoom 1.0
    const svgW = svg.clientWidth;
    if (!svgW) return;
    
    // Tính zoom ratio để fit vừa
    const ratio = availableW / svgW;
    // Clamp trong khoảng hợp lý: 50% - 150%
    const fittedZoom = Math.max(0.5, Math.min(1.5, ratio));
    // Làm tròn đến bội số 10%
    const snapPercent = Math.round(fittedZoom * 10) * 10;
    
    // Nếu đã đặt zoom từ session/URL thì không override
    if (currentZoom !== 1.0) return;
    
    setZoom(snapPercent);
  }

  /* ====================== RESTORE FROM URL ====================== */
  /**
   * Sau khi song load xong, đọc URL params và apply lại view/set/compact.
   * Dùng chuỗi async tuần tự (không timeout song song) để tránh race condition.
   * - Transpose: đã được đọc từ URL trong loadSong rồi
   * - Compact: apply ngay sau load
   * - Chord set: switch async (fetch từ server)
   * - Lyric view: mở SAU KHI chord set đã load xong
   */
  async function _restoreFromURL() {
    if (!window.URLState) return;
    const state = URLState.get();

    // Restore compact mode
    if (state.compact && !OSMDRenderer.getCompactMode()) {
      OSMDRenderer.setCompactMode(true);
      const btn = document.getElementById('btn-compact-mode');
      if (btn) { btn.classList.add('active'); btn.style.color = 'var(--accent)'; }
    }

    // Restore chord set
    // HD đã được ChordCanvas.loadSong() preload làm mặc định.
    // Chỉ cần override khi URL chỉ định set khác:
    //   - ?set=default hoặc ?set=TLH → quay về TLH (hợp âm gốc XML)
    //   - ?set=XYZ (cụ thể, khác HD/default) → chuyển về XYZ
    const urlSet = state.set || '';
    if (urlSet === 'default') {
      // Người dùng chủ động chọn TLH
      if (window.ChordCanvas?.switchSet) await window.ChordCanvas.switchSet('default');
    } else if (urlSet && urlSet !== 'default' && urlSet !== 'HD') {
      // Set cụ thể khác HD (VD: Hoài Dinh, ...)
      if (window.ChordCanvas?.getCurrentSet?.() !== urlSet && window.ChordCanvas?.switchSet) {
        await window.ChordCanvas.switchSet(urlSet);
      }
    }
    // urlSet === '' hoặc urlSet === 'HD' → HD đã sẵn (không cần switch thêm)

    // Sau khi chord set đã load xong, mới mở lyric view
    if (state.v === 'lyric') {
      if (state.lv === 'inline') {
        localStorage.setItem('sheetapp_lyric_mode', 'inline');
      }
      const btnLV = document.getElementById('btn-lyric-view');
      const lyric = document.getElementById('lyric-view-container');
      if (lyric && lyric.classList.contains('hidden') && btnLV) {
        btnLV.click();
      }
    }
  }

  /* ====================== BIND CONTROLS ====================== */
  function _bindToolbarControls() {
    document.getElementById('btn-transpose-up')?.addEventListener('click', e => { e.currentTarget.blur(); transposeBy(+1); });
    document.getElementById('btn-transpose-down')?.addEventListener('click', e => { e.currentTarget.blur(); transposeBy(-1); });
    document.getElementById('btn-transpose-reset')?.addEventListener('click', e => { e.currentTarget.blur(); resetTranspose(); });
    // Zoom: hỗ trợ cả <select> và <input type="range">
    const zoomEl = document.getElementById('zoom-slider');
    if (zoomEl) {
      const evtType = zoomEl.tagName.toLowerCase() === 'select' ? 'change' : 'input';
      zoomEl.addEventListener(evtType, e => { setZoom(parseInt(e.target.value, 10)); });
    }
    
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
         window.URLState?.update?.({ compact: true });
      } else {
         btn.classList.remove('active');
         btn.style.color = '';
         window.URLState?.update?.({ compact: false });
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
        case 'd': case 'D': document.getElementById('btn-dark-toggle')?.click(); break;
        case 'Escape':
          document.getElementById('import-modal')?.classList.add('hidden');
          document.getElementById('session-panel')?.classList.add('hidden');
          if (document.body.classList.contains('sheet-only-mode')) AppUI.toggleFullscreen();
          break;
        case '+': case '=': if (e.ctrlKey) { e.preventDefault(); _adjustZoom(+10); } break;
        case '-': if (e.ctrlKey) { e.preventDefault(); _adjustZoom(-10); } break;
        case 'z': case 'Z':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.shiftKey) { window.ChordCanvas?.redo?.(); }
            else            { window.ChordCanvas?.undo?.(); }
          }
          break;
        case 'y': case 'Y':
          if (e.ctrlKey || e.metaKey) { e.preventDefault(); window.ChordCanvas?.redo?.(); }
          break;
      }
    });
  }

  function _adjustZoom(delta) {
    const slider = document.getElementById('zoom-slider');
    if (!slider || slider.disabled) return;
    const cur = parseInt(slider.value) || 100;
    if (slider.tagName.toLowerCase() === 'select') {
      const opts = Array.from(slider.options).map(o => parseInt(o.value));
      const curIdx = opts.indexOf(cur);
      let nextIdx = curIdx + (delta > 0 ? 1 : -1);
      nextIdx = Math.max(0, Math.min(opts.length - 1, nextIdx));
      setZoom(opts[nextIdx]);
    } else {
      const newVal = Math.min(200, Math.max(30, cur + delta));
      setZoom(newVal);
    }
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

  /* ─── Sprint B: Volume track CSS update ─── */
  function _updateVolumeTrack(slider) {
    const pct = slider.value + '%';
    slider.style.background = `linear-gradient(to right, var(--accent,#7c3aed) 0%, var(--accent,#7c3aed) ${pct}, #d1d5db ${pct})`;
  }

  /* ─── Sprint E1: Measure Progress ─── */
  function updateMeasureProgress(current, total) {
    if (!total) return;
    const fill = document.getElementById('measure-progress-fill');
    if (fill) fill.style.width = Math.round((current / total) * 100) + '%';
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
    showToast: (m,t) => AppUI.showToast(m,t),
    showLoading: (t) => AppUI.showLoading(t),
    hideLoading: () => AppUI.hideLoading(),
    reloadCurrentXML: () => _commitTranspose(),
    updateMeasureProgress,
  };
})();

window.App = App;
