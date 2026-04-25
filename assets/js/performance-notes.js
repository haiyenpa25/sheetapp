/**
 * performance-notes.js — Nhật ký biểu diễn per-song
 * Lưu ghi chú biểu diễn (tông, BPM, hướng dẫn) vào localStorage
 */
const PerformanceNotes = (() => {
  'use strict';

  const PREFIX = 'perf_notes_';
  let _songId  = null;
  let _panel   = null;
  let _saveTimer = null;

  /* ─── Data helpers ─────────────────────────────────────────── */
  function _load(id) {
    try { return JSON.parse(localStorage.getItem(PREFIX + id) || 'null') || {}; }
    catch { return {}; }
  }
  function _save(id, data) {
    localStorage.setItem(PREFIX + id, JSON.stringify(data));
  }

  /* ─── Init ────────────────────────────────────────────────── */
  function init() {
    document.getElementById('btn-perf-notes')?.addEventListener('click', toggle);
  }

  function loadSong(songId) {
    _songId = songId;
    if (_panel && !_panel.classList.contains('hidden')) _renderPanel();
  }

  function clearSong() { _songId = null; }

  /* ─── Toggle panel ────────────────────────────────────────── */
  function toggle() {
    if (!_panel) _createPanel();
    const hidden = _panel.classList.toggle('hidden');
    if (!hidden) _renderPanel();
  }

  /* ─── Create panel DOM ────────────────────────────────────── */
  function _createPanel() {
    _panel = document.createElement('div');
    _panel.id = 'perf-notes-panel';
    _panel.innerHTML = `
      <div class="pnp-header">
        <span>📋 Nhật Ký Biểu Diễn</span>
        <button id="pnp-close" title="Đóng">✕</button>
      </div>
      <div class="pnp-body">
        <div class="pnp-row">
          <label>🎵 Tông lưu</label>
          <input id="pnp-key" type="text" maxlength="6" placeholder="VD: G, Bb, F#m…">
        </div>
        <div class="pnp-row">
          <label>⏱ BPM</label>
          <input id="pnp-bpm" type="number" min="30" max="300" placeholder="VD: 72">
        </div>
        <div class="pnp-row pnp-row-full">
          <label>📝 Ghi chú biểu diễn</label>
          <textarea id="pnp-text" rows="6"
            placeholder="VD:&#10;- Câu 1-2: Đàn dạo 2 lần&#10;- Câu 3: Hát + đàn&#10;- Điệp khúc: Tất cả cùng hát&#10;- Coda: Fade out nhẹ"></textarea>
        </div>
        <div class="pnp-actions">
          <span id="pnp-saved" class="pnp-saved-hint" style="opacity:0">✓ Đã lưu</span>
          <button id="pnp-save-btn" class="btn btn-primary btn-sm">💾 Lưu</button>
        </div>
      </div>`;

    document.body.appendChild(_panel);

    document.getElementById('pnp-close').addEventListener('click', () => _panel.classList.add('hidden'));

    // Auto-save on input
    ['pnp-key','pnp-bpm','pnp-text'].forEach(id => {
      document.getElementById(id)?.addEventListener('input', () => {
        clearTimeout(_saveTimer);
        _saveTimer = setTimeout(_doSave, 1200);
      });
    });
    document.getElementById('pnp-save-btn').addEventListener('click', _doSave);

    // Click outside to close
    document.addEventListener('pointerdown', e => {
      if (_panel && !_panel.classList.contains('hidden') &&
          !_panel.contains(e.target) &&
          e.target.id !== 'btn-perf-notes') {
        _panel.classList.add('hidden');
      }
    });
  }

  function _renderPanel() {
    if (!_panel || !_songId) return;
    const data = _load(_songId);
    document.getElementById('pnp-key').value  = data.key  || '';
    document.getElementById('pnp-bpm').value  = data.bpm  || '';
    document.getElementById('pnp-text').value = data.text || '';
  }

  function _doSave() {
    if (!_songId || !_panel) return;
    const data = {
      key:  document.getElementById('pnp-key')?.value.trim()  || '',
      bpm:  document.getElementById('pnp-bpm')?.value.trim()  || '',
      text: document.getElementById('pnp-text')?.value.trim() || '',
      updatedAt: new Date().toISOString()
    };
    _save(_songId, data);
    // Flash saved hint
    const hint = document.getElementById('pnp-saved');
    if (hint) { hint.style.opacity = '1'; setTimeout(() => hint.style.opacity = '0', 1500); }
  }

  return { init, loadSong, clearSong, toggle };
})();

window.PerformanceNotes = PerformanceNotes;
