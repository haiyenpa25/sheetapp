/**
 * song-loader.js — Song Loading & XML Management
 * Tách từ app.js: chịu trách nhiệm load/reload/save bài hát.
 * Phụ thuộc: Store, EventBus, ApiService, OSMDRenderer, AppUI, ChordCanvas
 */
const SongLoader = (() => {
  'use strict';

  /* ── Load bài hát hoàn chỉnh ── */
  async function load(song, transposeOverride = null, profileOverride = 'HD') {
    if (!song?.xmlPath) { AppUI.showToast('Bài hát chưa có file sheet nhạc', 'error'); return; }

    Store.set('currentSong', song);
    Store.set('currentTranspose', transposeOverride ?? 0);
    Store.set('capoLevel', 0);

    _resetCapoUI();
    SheetAudioPlayer.stop();
    if (window.AutoScroller) AutoScroller.stop();
    if (window.ChordCanvas?.resetSet) ChordCanvas.resetSet();
    if (window.InstrumentMixer?.clearState) InstrumentMixer.clearState();

    ChordCanvas.loadSong(song.id, profileOverride);
    AnnotationCanvas.loadSong(song.id);
    PageNav.reset();

    AppUI.showLoading(`Đang tải "${song.title}"...`);
    AppUI.enableControls(false);
    _autoCloseSidebar();

    try {
      const res = await fetch(song.xmlPath);
      if (!res.ok) throw new Error(`Không thể tải file: ${res.status}`);
      const xml = await res.text();
      Store.set('originalXml', xml);

      const settings = await ApiService.sessions.load(song.id);
      const transpose = transposeOverride ?? 0;
      const zoom = settings.userSettings?.zoomLevel || 1.0;
      Store.set('currentTranspose', transpose);
      Store.set('currentZoom', zoom);

      AppUI.setLoadingText('Đang xử lý hồ sơ...');
      const processedXml = _injectChords(xml);

      AppUI.setLoadingText('Đang vẽ bản nhạc...');
      OSMDRenderer.setZoomSilent(zoom);
      await OSMDRenderer.load(processedXml, transpose);

      _syncZoomUI(zoom);
      if (!settings.userSettings?.zoomLevel) setTimeout(() => _autoFitZoom(), 100);

      SheetAudioPlayer.setup(OSMDRenderer.getInstance());
      AppUI.updateTransposeDisplay(transpose);
      AppUI.updateSongInfo(song, transpose);
      _updateCapoBadge(xml);

      if (window.SongInfoBar) SongInfoBar.loadSong(xml, song);
      if (window.PerformanceNotes) await PerformanceNotes.loadSong(song.id);

      _enableAudioControls();
      AppUI.showOSMD();

      if (window.ChordCanvas?.onOSMDRendered) ChordCanvas.onOSMDRendered();
      if (window.AnnotationCanvas?.onOSMDRendered) AnnotationCanvas.onOSMDRendered();
      if (window.ChordCanvas?.refreshSetDropdown) {
        setTimeout(() => { ChordCanvas.refreshSetDropdown(); setTimeout(() => SongInfoBar?.refreshChordChip?.(), 150); }, 200);
      }

      AppUI.updateSessionPanel(transpose, []);
      _showLoadToast(song, transpose);
      if (window.URLState) await _restoreFromURL();
      if (window.HistoryManager) HistoryManager.trackView(song);

      document.getElementById('btn-print')?.removeAttribute('disabled');
      EventBus.emit('song:loaded', { song, xml });

    } catch (err) {
      console.error('[SongLoader]', err);
      AppUI.showToast(`Lỗi: ${err.message}`, 'error');
      AppUI.showWelcome();
    }
  }

  /* ── Commit transpose (reload OSMD với XML mới) ── */
  async function commitTranspose(scrollSnapshot = null) {
    const xml = Store.get('originalXml');
    if (!xml) return;
    const transpose = Store.get('currentTranspose');
    const disp = document.getElementById('transpose-display');
    if (disp) disp.style.opacity = '0.5';

    const isLyricActive = !document.getElementById('lyric-view-container')?.classList.contains('hidden');
    const processedXml  = _injectChords(xml);

    if (isLyricActive) {
      SessionTracker.setTranspose(transpose);
      if (window.DisplaySettings?.renderLyricViewIfActive) DisplaySettings.renderLyricViewIfActive();
      _updateCapoBadge(processedXml);
      if (disp) disp.style.opacity = '';
      return;
    }

    const container   = document.querySelector('.sheet-viewer-wrapper');
    const wrapH = scrollSnapshot?.preScrollH ?? (container?.scrollHeight || 0);
    const wrapT = scrollSnapshot?.preScrollT ?? (container?.scrollTop || 0);
    if (container && !scrollSnapshot) container.style.minHeight = wrapH + 'px';

    try {
      if (window.InstrumentMixer?.preserveState) InstrumentMixer.preserveState();
      await OSMDRenderer.reload(processedXml, transpose);
      SessionTracker.setTranspose(transpose);
      _updateCapoBadge(processedXml);
      if (window.ChordCanvas)     ChordCanvas.onOSMDRendered();
      if (window.AnnotationCanvas) AnnotationCanvas.onOSMDRendered();
    } catch (err) {
      console.warn('[SongLoader] reload lỗi:', err.message);
    } finally {
      if (disp) disp.style.opacity = '';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (container) {
          container.style.minHeight = '';
          // Cứ set đúng absolute top vì chiều cao không đổi khi thêm/sửa hợp âm!
          container.scrollTo({ left:0, top: wrapT, behavior:'instant' });
        }
      }));
    }
  }

  /* ── Lưu XML đã chỉnh sửa ── */
  async function saveModifiedXML(newXml) {
    const song = Store.get('currentSong');
    if (!song?.xmlPath) return false;

    const container = document.querySelector('.sheet-viewer-wrapper');
    const preScrollH = container?.scrollHeight || 0;
    const preScrollT = container?.scrollTop   || 0;
    if (container && preScrollH > 0) container.style.minHeight = preScrollH + 'px';

    try {
      const result = await ApiService.saveXml(song.xmlPath, newXml);
      if (!result.success) throw new Error(result.message || 'Lỗi không xác định');
      Store.set('originalXml', newXml);
      AppUI.showToast('Đã lưu hợp âm vào file gốc!', 'success');
      await commitTranspose({ preScrollH, preScrollT });
      return true;
    } catch (err) {
      if (container) container.style.minHeight = '';
      AppUI.showToast('Lỗi lưu file: ' + err.message, 'error');
      return false;
    }
  }

  /* ── Private helpers ── */
  function _injectChords(xml) {
    const currentSet = window.ChordCanvas?.getCurrentSet?.() || 'default';
    const chords     = window.ChordCanvas?.getCustomChords?.() ?? {};
    if (currentSet !== 'default' && Object.keys(chords).length > 0) {
      return window.ChordCanvasXML?.cloneAndInjectChords?.(xml, chords) || xml;
    }
    return xml;
  }

  function _updateCapoBadge(xml) {
    if (!window.TransposeEngine) return;
    const set    = window.ChordCanvas?.getCurrentSet?.() || 'default';
    const chords = window.ChordCanvas?.getCustomChords?.();
    let list = (set !== 'default' && chords) ? Object.values(chords) : TransposeEngine.extractChordsFromXML(xml);
    const transpose = Store.get('currentTranspose');
    AppUI.updateCapoBadge(TransposeEngine.suggestBestCapo(list.map(c => TransposeEngine.transposeChord(c, transpose))));
  }

  function _syncZoomUI(zoom) {
    const pct    = Math.round(zoom * 100);
    const slider = document.getElementById('zoom-slider');
    if (slider) {
      if (slider.tagName.toLowerCase() === 'select') {
        const best = Array.from(slider.options).reduce((a,b) =>
          Math.abs(parseInt(b.value)-pct) < Math.abs(parseInt(a.value)-pct) ? b : a);
        slider.value = best.value;
      } else { slider.value = pct; }
    }
    const lbl = document.getElementById('zoom-value-label');
    if (lbl) lbl.textContent = pct + '%';
  }

  function _autoFitZoom() {
    const svg = document.getElementById('osmd-container')?.querySelector('svg');
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    if (!svg || !wrapper) return;
    const avail = wrapper.clientWidth - 40;
    if (avail <= 0 || !svg.clientWidth) return;
    const ratio = avail / svg.clientWidth;
    const snap  = Math.round(Math.max(0.5, Math.min(1.5, ratio)) * 10) * 10;
    if (Store.get('currentZoom') === 1.0) window.App?.setZoom?.(snap);
  }

  function _resetCapoUI() {
    const capoSel  = document.getElementById('capo-select');
    const capoHint = document.getElementById('capo-hint');
    if (capoSel)  capoSel.value = '0';
    if (capoHint) capoHint.textContent = '';
  }

  function _autoCloseSidebar() {
    if (window.innerWidth <= 900) {
      document.getElementById('sidebar')?.classList.add('mobile-hidden');
      document.getElementById('sidebar-overlay')?.classList.add('hidden');
    }
  }

  function _enableAudioControls() {
    const perfBtn = document.getElementById('btn-perf-notes');
    if (perfBtn) perfBtn.disabled = false;
    const vol = document.getElementById('audio-volume');
    if (vol) { vol.disabled = false; }
    SheetAudioPlayer.enableBtn(true);
  }

  function _showLoadToast(song, transpose) {
    const key   = window.SongInfoBar?.getSongKey?.() || '';
    const set   = window.ChordCanvas?.getCurrentSet?.() || 'HD';
    const cnt   = Object.keys(window.ChordCanvas?.getCustomChords?.() ?? {}).length;
    const setLbl = set === 'default' ? 'TLH (gốc)' : set;
    const cntLbl = set !== 'default' ? ` (${cnt > 0 ? cnt + ' hợp âm' : 'chưa có'})` : '';
    AppUI.showToast(`🎵 ${song.title}${key ? ' · '+key : ''} · ${setLbl}${cntLbl}`, 'info');
  }

  async function _restoreFromURL() {
    if (!window.URLState) return;
    const state = URLState.get();
    if (state.compact && !OSMDRenderer.getCompactMode()) {
      OSMDRenderer.setCompactMode(true);
      const btn = document.getElementById('btn-compact-mode');
      if (btn) { btn.classList.add('active'); btn.style.color = 'var(--accent)'; }
    }
    const urlSet = state.set || '';
    if (urlSet === 'default' && window.ChordCanvas?.switchSet) await ChordCanvas.switchSet('default');
    else if (urlSet && urlSet !== 'default' && urlSet !== 'HD' && ChordCanvas?.getCurrentSet?.() !== urlSet) {
      await ChordCanvas.switchSet(urlSet);
    }
    if (state.v === 'lyric') {
      if (state.lv === 'inline') localStorage.setItem('sheetapp_lyric_mode', 'inline');
      const lyric = document.getElementById('lyric-view-container');
      if (lyric?.classList.contains('hidden')) document.getElementById('btn-lyric-view')?.click();
    }
  }

  return { load, commitTranspose, saveModifiedXML };
})();

window.SongLoader = SongLoader;
