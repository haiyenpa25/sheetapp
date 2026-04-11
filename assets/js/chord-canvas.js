/**
 * chord-canvas.js — Multi-Set Chord Manager (Core)
 *
 * Hỗ trợ:
 *  - "Mặc định": đọc/ghi hợp âm trực tiếp vào XML gốc (thông qua ChordCanvasXML)
 *  - Custom sets: lưu trong api/chord_sets.php (JSON)
 *  - Giao diện và XML được tách rời sang ChordCanvasUI và ChordCanvasXML.
 */
const ChordCanvas = (() => {
  'use strict';

  /* ─── State ─────────────────────────────────────────────────── */
  let _editEnabled   = false;
  let _popup         = null;
  let _currentSet    = 'default';
  let _customChords  = {};
  let _noteEls       = [];
  let _ro            = null;

  const DOT_CLASS  = 'cc-dot';
  const BTN_CLASS  = 'cc-dot-btn';

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    document.getElementById('btn-add-chord-mode')?.addEventListener('click', toggleAddMode);
    document.getElementById('btn-cancel-add-chord')?.addEventListener('click', () => setAddMode(false));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { _closePopup(); setAddMode(false); }
    });
    
    // Resize Observer để tự động di chuyển hợp âm khi màn hình thay đổi
    const container = document.getElementById('osmd-container');
    if (container) {
      let rTid = null;
      _ro = new ResizeObserver(() => {
        if (!_editEnabled) return;
        clearTimeout(rTid);
        rTid = setTimeout(() => { if (_editEnabled) _build(); }, 150);
      });
      _ro.observe(container);
    }
    
    console.log('[CC] init OK');
  }

  function onOSMDRendered() { 
    _alignOSMDChords();
    setTimeout(_build, 200); 
  }
  function reposition() { 
    _alignOSMDChords();
    setTimeout(_build, 100); 
  }

  function _alignOSMDChords() {
    const container = document.getElementById('osmd-container');
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;
    
    // Tìm tất cả Hợp âm OSMD (dựa vào font marker OSMDChordFont)
    const chords = Array.from(svg.querySelectorAll('text[font-family*="OSMDChordFont"]'));
    if (!chords.length) return;

    // Phân nhóm hợp âm theo dòng (system). Các hợp âm cùng dòng thường có Y chênh lệch < 80px
    const systems = [];
    chords.forEach(c => {
      const yStr = c.getAttribute('y');
      if (!yStr) return;
      const y = parseFloat(yStr);
      let found = false;
      for (const sys of systems) {
        if (Math.abs(sys.avgY - y) < 80) {
          sys.chords.push(c);
          sys.minY = Math.min(sys.minY, y);
          let sum = 0;
          sys.chords.forEach(txt => sum += parseFloat(txt.getAttribute('y')));
          sys.avgY = sum / sys.chords.length;
          found = true;
          break;
        }
      }
      if (!found) {
        systems.push({ avgY: y, minY: y, chords: [c] });
      }
    });

    // Ép toàn bộ hợp âm trên cùng 1 dòng về 1 tọa độ Y thẳng tắp
    systems.forEach(sys => {
      sys.chords.forEach(c => c.setAttribute('y', sys.minY));
    });
  }

  function loadSong() {
    _clear();
    setAddMode(false);
    _currentSet   = 'default';
    _customChords = {};
    setTimeout(_refreshSetDropdown, 300);
  }

  function clearSong() { _clear(); setAddMode(false); }

  /* ─── Mode ──────────────────────────────────────────────────── */
  function setAddMode(on) {
    _editEnabled = !!on;
    document.getElementById('btn-add-chord-mode')?.classList.toggle('active', on);
    document.getElementById('add-chord-hint')?.classList.toggle('hidden', !on);
    document.querySelectorAll('.' + BTN_CLASS).forEach(d => { d.style.display = on ? 'flex' : 'none'; });
    
    // Nếu AnnotateMode đang bật thì tắt
    if (on && window.AnnotationCanvas && document.getElementById('btn-add-annotate-mode')?.classList.contains('active')) {
      window.AnnotationCanvas.setAddMode(false);
    }

    if (on) { if (document.querySelectorAll('.' + DOT_CLASS).length === 0) _build(); } 
    else { _closePopup(); }
  }

  function toggleAddMode() { setAddMode(!_editEnabled); }

  /* ─── Build dots ─────────────────────────────────────────────── */
  function _clear() {
    document.querySelectorAll('.' + DOT_CLASS).forEach(d => d.remove());
    _closePopup();
    _noteEls = [];
  }

  function _build() {
    _clear();
    const container = document.getElementById('osmd-container');
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    let notes = Array.from(svg.querySelectorAll('g.vf-stavenote'));
    if (!notes.length) {
      notes = Array.from(svg.querySelectorAll('g')).filter(g => g.querySelector('ellipse') && !g.querySelector('g > g > ellipse'));
    }
    if (!notes.length) return;

    _noteEls = notes;
    
    // Quản lý hiển thị Hợp âm gốc của OSMD
    const nativeChords = svg.querySelectorAll('text[font-family*="OSMDChordFont"]');
    if (_currentSet === 'default') {
      nativeChords.forEach(c => c.style.display = '');
    } else {
      nativeChords.forEach(c => c.style.display = 'none');
    }

    const rawChordMap = _currentSet === 'default'
      ? ChordCanvasXML.readXmlChords()
      : _applyTranspose(_customChords);

    const mapped = _mapNotes(notes, rawChordMap);
    mapped.forEach(m => _placeDot(m));
  }

  /* ─── Map notes ─────────────────────────────────────────────── */
  function _mapNotes(noteEls, chordMap) {
    const osmd = window.OSMDRenderer?.getInstance?.();
    const ml   = osmd?.graphic?.measureList;

    if (ml) {
      try {
        const result = [], byEl = new Map();
        for (let mi = 0; mi < ml.length; mi++) {
          const staves = ml[mi];
          if (!staves?.length) continue;
          const staff = staves[0];
          if (!staff?.staffEntries) continue;
          const src  = staff.ParentSourceMeasure ?? staves[0].parentSourceMeasure;
          const mIdx = src?.measureListIndex ?? mi;
          let nIdx = 0;
          for (const se of staff.staffEntries) {
            if (!se) continue;
            for (const ve of (se.graphicalVoiceEntries || [])) {
              for (const gn of (ve.notes || [])) {
                const svgG = gn.getSVGGElement?.();
                if (svgG) byEl.set(svgG, { mIdx, nIdx });
              }
            }
            nIdx++;
          }
        }
        if (byEl.size > 0) {
          for (const el of noteEls) {
            const m    = byEl.get(el) || byEl.get(el.parentElement);
            result.push({
              el, rect: el.getBoundingClientRect(),
              measureIdx: m?.mIdx ?? -1, noteIdx: m?.nIdx ?? result.length,
              chord: m ? (chordMap[`${m.mIdx}_${m.nIdx}`] || '') : ''
            });
          }
          if (result.some(r => r.measureIdx >= 0)) return result;
        }
      } catch(e) {}
    }

    const absMap = ChordCanvasXML.buildAbsMap();
    return noteEls.map((el, i) => ({
      el, rect: el.getBoundingClientRect(),
      measureIdx: absMap[i]?.mi ?? -1, noteIdx: absMap[i]?.ni ?? i,
      chord: absMap[i] ? (chordMap[`${absMap[i].mi}_${absMap[i].ni}`] || '') : ''
    }));
  }

  /* ─── Place dots ────────────────────────────────────────────── */
  function _placeDot({ el, rect, measureIdx, noteIdx, chord }) {
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const container = document.getElementById('osmd-container');
    const cRect = container.getBoundingClientRect();
    
    // Tính toạ độ tuyệt đối so sánh với #osmd-container
    const cx = (rect.left - cRect.left) + rect.width / 2;
    const cy = (rect.top - cRect.top) - 20;

    const scale = ChordCanvasUI.getScale();
    if (chord) {
      if (!_editEnabled && _currentSet === 'default') return; // HTML Hitbox chỉ hiển thị khi Edit = true (default)
      // Custom set thì lúc nào cũng phải hiển thị (vì textContent > 0)
      
      const span = document.createElement('span');
      span.className = DOT_CLASS + ' cc-chord-text';
      
      if (_currentSet === 'default') {
         span.textContent = ''; // Lõi OSMD đã vẽ, chỉ cần Hitbox tàng hình
         ChordCanvasUI.applyAbsolute(span, cx, cy, [
           'white-space:nowrap', 'user-select:none', 
           'opacity:0', 'width:30px', 'height:20px',
           'pointer-events:auto', 'cursor:pointer',
           'display:' + (_editEnabled ? 'block' : 'none')
         ]);
      } else {
         span.textContent = chord; // Vẽ chữ đè lên
         ChordCanvasUI.applyAbsolute(span, cx, cy, [
           'white-space:nowrap', 'user-select:none', 
           'opacity:1', 'color:var(--danger, #dc2626)', 'font-weight:700',
           'font-size:' + Math.round(15 * scale) + 'px',
           'font-family: Arial, sans-serif',
           'pointer-events:auto', 'cursor:pointer',
           'transform: translate(-50%, -100%)' // Căn giữa
         ]);
         // Hover effect cho custom
         span.addEventListener('mouseover', () => { if (_editEnabled) span.style.color = 'var(--accent)'; });
         span.addEventListener('mouseout', () => span.style.color = 'var(--danger, #dc2626)');
      }
      
      span.addEventListener('click', e => { 
        if (!_editEnabled) return;
        e.stopPropagation(); 
        _showPopup(span, measureIdx, noteIdx, chord); 
      });
      
      container.appendChild(span);
    } else {
      const dotSize = ChordCanvasUI.getDotSize(scale);
      const fSize   = Math.max(10, Math.round(12 * scale));
      const btn = document.createElement('div');
      btn.className = DOT_CLASS + ' ' + BTN_CLASS;
      btn.textContent = '+';
      ChordCanvasUI.applyAbsolute(btn, cx, cy, [
        'display:' + (_editEnabled ? 'flex' : 'none'), 'align-items:center', 'justify-content:center',
        `width:${dotSize}px`, `height:${dotSize}px`, 'border-radius:50%', 'background:rgba(109,40,217,0.8)',
        'color:#fff', `font-size:${fSize}px`, 'line-height:1', 'box-shadow:0 1px 4px rgba(109,40,217,0.4)',
        'pointer-events:auto', 'cursor:pointer', 'user-select:none'
      ]);
      btn.addEventListener('click', e => { e.stopPropagation(); _showPopup(btn, measureIdx, noteIdx, ''); });
      container.appendChild(btn);
    }
  }

  /* ─── Popup ─────────────────────────────────────────────────── */
  function _showPopup(anchor, measureIdx, noteIdx, existing) {
    _closePopup();
    _popup = ChordCanvasUI.createPopup(anchor, measureIdx, noteIdx, existing, _currentSet, {
      onSave: async (val) => {
        _closePopup();
        await _saveChord(measureIdx, noteIdx, val);
      },
      onDelete: async () => {
        _closePopup();
        await _deleteChord(measureIdx, noteIdx);
      },
      onClose: () => _closePopup()
    });
  }

  function openNextPopup(curMeasureIdx, curNoteIdx) {
    if (!_noteEls.length) return;
    const mapped = _mapNotes(_noteEls, {});
    let foundIdx = -1;
    for (let i = 0; i < mapped.length; i++) {
       if (mapped[i].measureIdx === curMeasureIdx && mapped[i].noteIdx === curNoteIdx) {
          foundIdx = i;
          break;
       }
    }
    if (foundIdx !== -1 && foundIdx + 1 < mapped.length) {
       const next = mapped[foundIdx + 1];
       const container = document.getElementById('osmd-container');
       if (!container) return;
       // Tìm hàm show bằng document querySelector
       const dotBtn = container.querySelector(`.chord-dot-btn[style*="left:${(next.rect.left - container.getBoundingClientRect().left) + next.rect.width/2}px"]`);
       setTimeout(() => {
          if (dotBtn) dotBtn.click();
          else _showPopup(next.el, next.measureIdx, next.noteIdx, '');
       }, 50);
    }
  }

  function _closePopup() { _popup?.remove(); _popup = null; }

  /* ─── Save / Delete chord ────────────────────────────────────── */
  async function _saveChord(measureIdx, noteIdx, chordInput, refreshLayout = true) {
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    const chordOriginalKey = semitones !== 0 ? TransposeEngine.transposeChord(chordInput, -semitones) : chordInput;

    if (_currentSet === 'default') {
      await ChordCanvasXML.injectXml(measureIdx, noteIdx, chordOriginalKey, refreshLayout);
    } else {
      _customChords[`${measureIdx}_${noteIdx}`] = chordOriginalKey;
      await _saveCustomSet();
      if (refreshLayout && window.App?.reloadCurrentXML) await window.App.reloadCurrentXML();
    }
  }

  async function _deleteChord(measureIdx, noteIdx) {
    if (_currentSet === 'default') {
      await ChordCanvasXML.removeXml(measureIdx, noteIdx);
    } else {
      delete _customChords[`${measureIdx}_${noteIdx}`];
      await _saveCustomSet();
      if (window.App?.reloadCurrentXML) await window.App.reloadCurrentXML();
    }
  }

  async function _saveCustomSet() {
    const songId = window.App?.getCurrentSongId?.();
    if (!songId || _currentSet === 'default') return;
    const arr = Object.entries(_customChords).map(([k, chord]) => {
      const [measureIdx, noteIdx] = k.split('_').map(Number);
      return { measureIdx, noteIdx, chord };
    });

    try {
      const res = await fetch('api/chord_sets.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', songId, name: _currentSet, chords: arr })
      });
      const r = await res.json();
      if (r.success) window.App?.showToast?.(`Đã lưu hợp âm cho "${_currentSet}"`, 'success');
      else window.App?.showToast?.('Lỗi lưu: ' + (r.message || ''), 'error');
    } catch(e) { window.App?.showToast?.('Lỗi: ' + e.message, 'error'); }
  }

  /* ─── Switch / Create chord sets ────────────────────────────── */
  async function switchSet(name) {
    _currentSet   = name;
    _customChords = {};
    if (name !== 'default') {
      const songId = window.App?.getCurrentSongId?.();
      if (songId) {
        try {
          const res = await fetch(`api/chord_sets.php?action=load&songId=${encodeURIComponent(songId)}&name=${encodeURIComponent(name)}`);
          const r   = await res.json();
          if (r.success && r.chords) {
            r.chords.forEach(({ measureIdx, noteIdx, chord }) => { _customChords[`${measureIdx}_${noteIdx}`] = chord; });
          }
        } catch(e) {}
      }
    }
    if (window.App?.reloadCurrentXML) {
       AppUI.setLoadingText('Đang nạp hồ sơ...');
       await window.App.reloadCurrentXML();
    } else {
       _build();
    }
    _updateSetUI();
  }

  async function createSet(name) {
    if (!name?.trim()) return;
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;

    try {
      const res = await fetch('api/chord_sets.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', songId, name, chords: [] })
      });
      const r = await res.json();
      if (!r.success) { window.App?.showToast?.('Tạo thất bại', 'error'); return; }
    } catch(e) { return; }

    await switchSet(name);
    setAddMode(true);
    await _refreshSetDropdown();
    window.App?.showToast?.(`Đã tạo bộ "${name}" - bắt đầu nhập!`, 'success');
  }

  function showNewSetModal() {
    ChordCanvasUI.showNewSetModal({ onCreate: (name) => createSet(name) });
  }

  async function deleteSet(name) {
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;
    try {
      await fetch('api/chord_sets.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', songId, name })
      });
    } catch(e) {}
    if (_currentSet === name) await switchSet('default');
    _refreshSetDropdown();
  }

  /* ─── Set dropdown UI ───────────────────────────────────────── */
  async function _refreshSetDropdown() {
    const selector = document.getElementById('chord-set-selector');
    const deleteBtn = document.getElementById('btn-delete-chord-set');
    if (!selector) return;

    const songId = window.App?.getCurrentSongId?.();
    if (!songId) {
      selector.innerHTML = '<option value="default">Hợp âm mặc định</option>';
      selector.disabled = true; return;
    }

    selector.disabled = false;
    let sets = ['default'];
    try {
      const res = await fetch(`api/chord_sets.php?action=list&songId=${encodeURIComponent(songId)}`);
      const r   = await res.json();
      if (r.success) sets = ['default', ...r.sets];
    } catch(e) {}

    selector.innerHTML = sets.map(s => `<option value="${s}" ${s === _currentSet ? 'selected' : ''}>${s === 'default' ? 'Hợp âm mặc định' : s}</option>`).join('');
    
    const isAdmin = window.Auth?.isAdmin?.();
    if (deleteBtn) deleteBtn.style.display = (_currentSet !== 'default' && isAdmin) ? 'inline-flex' : 'none';
    const newBtn = document.getElementById('btn-new-chord-set');
    if (newBtn) newBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    
    // Disable selector if user is not admin and wants to switch to add mode wait, actually guests can switch sets to VIEW them.
  }

  function _updateSetUI() {
    const selector = document.getElementById('chord-set-selector');
    if (selector) selector.value = _currentSet;
    const isAdmin = window.Auth?.isAdmin?.();
    const deleteBtn = document.getElementById('btn-delete-chord-set');
    if (deleteBtn) deleteBtn.style.display = (_currentSet !== 'default' && isAdmin) ? 'inline-flex' : 'none';
    const newBtn = document.getElementById('btn-new-chord-set');
    if (newBtn) newBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    const clearBtn = document.getElementById('btn-clear-all-chords');
    if (clearBtn) clearBtn.classList.toggle('hidden', _currentSet === 'default');
  }

  function _applyTranspose(chordMap) {
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    if (semitones === 0) return chordMap;
    const out = {};
    for (const [k, chord] of Object.entries(chordMap)) {
      out[k] = TransposeEngine.transposeChord(chord, semitones);
    }
    return out;
  }

  /* ─── Exports ────────────────────────────────────────────────── */
  return {
    init, onOSMDRendered, reposition, loadSong, clearSong,
    setAddMode, toggleAddMode, switchSet, createSet, deleteSet,
    showNewSetModal,
    confirmDeleteSet: async () => {
      const sel  = document.getElementById('chord-set-selector');
      const name = sel?.value;
      if (!name || name === 'default') return;
      ChordCanvasUI.showDeleteConfirmModal(name, {
        onConfirm: async () => await deleteSet(name)
      });
    },
    refreshSetDropdown: _refreshSetDropdown,
    openNextPopup,
    saveChordWithoutReload: (m, n, c) => _saveChord(m, n, c, false),
    clearAllChords: async () => {
      if (_currentSet === 'default') {
        window.App?.showToast?.('Không thể xoá toàn bộ ở cấu hình Mặc định!', 'error');
        return;
      }
      _customChords = {};
      await _saveCustomSet();
      if (window.App?.reloadCurrentXML) await window.App.reloadCurrentXML();
      window.App?.showToast?.('Đã xoá toàn bộ hợp âm!', 'success');
    },
    getCurrentSet: () => _currentSet
  };
})();

window.ChordCanvas = ChordCanvas;
