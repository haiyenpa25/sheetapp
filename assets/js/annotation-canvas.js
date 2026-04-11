/**
 * annotation-canvas.js — Tương tác trực tiếp để gắn Ghi Chú (Sticky Notes)
 */
const AnnotationCanvas = (() => {
  'use strict';

  /* ─── State ─────────────────────────────────────────────────── */
  let _editEnabled = false;
  let _popup       = null;
  let _notes       = {}; // { "measureIdx_noteIdx": { text, color } }
  let _noteEls     = [];
  let _ro          = null;

  const DOT_CLASS = 'ano-dot';
  const BTN_CLASS = 'ano-dot-btn';

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    document.getElementById('btn-add-annotate-mode')?.addEventListener('click', toggleAddMode);
    document.getElementById('btn-cancel-add-annotate')?.addEventListener('click', () => setAddMode(false));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { _closePopup(); setAddMode(false); }
    });
    
    const container = document.getElementById('osmd-container');
    if (container) {
      let rTid = null;
      _ro = new ResizeObserver(() => {
        if (!_editEnabled && Object.keys(_notes).length === 0) return;
        clearTimeout(rTid);
        rTid = setTimeout(() => { _build(); }, 150);
      });
      _ro.observe(container);
    }
  }

  function onOSMDRendered() { setTimeout(_build, 200); }
  function reposition() { setTimeout(_build, 100); }

  async function loadSong(songId) {
    _clear();
    setAddMode(false);
    _notes = {};
    if (!songId) return;

    try {
      const res = await fetch(`api/annotations.php?action=load&songId=${encodeURIComponent(songId)}`);
      const r = await res.json();
      if (r.success && r.annotations) {
        r.annotations.forEach(a => {
          _notes[`${a.measureIdx}_${a.noteIdx}`] = a;
        });
      }
    } catch(e) {}
    _build();
  }

  function clearSong() { _clear(); setAddMode(false); }

  /* ─── Mode ──────────────────────────────────────────────────── */
  function setAddMode(on) {
    _editEnabled = !!on;
    document.getElementById('btn-add-annotate-mode')?.classList.toggle('active', on);
    document.getElementById('add-annotate-hint')?.classList.toggle('hidden', !on);
    document.querySelectorAll('.' + BTN_CLASS).forEach(d => { d.style.display = on ? 'flex' : 'none'; });
    
    // Nếu ChordMode đang bật thì tắt
    if (on && window.ChordCanvas && document.getElementById('btn-add-chord-mode')?.classList.contains('active')) {
      window.ChordCanvas.setAddMode(false);
    }

    if (on) { _build(); } 
    else { _closePopup(); _build(); } // Vẽ lại để xoá nút [+] nếu có
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
    const mapped = _mapNotes(notes);
    mapped.forEach(m => _placeDot(m));
  }

  function _mapNotes(noteEls) {
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
            const m = byEl.get(el) || byEl.get(el.parentElement);
            result.push({
              el, rect: el.getBoundingClientRect(),
              measureIdx: m?.mIdx ?? -1, noteIdx: m?.nIdx ?? result.length,
              anno: m ? (_notes[`${m.mIdx}_${m.nIdx}`] || null) : null
            });
          }
          if (result.some(r => r.measureIdx >= 0)) return result;
        }
      } catch(e) {}
    }
    return [];
  }

  function _placeDot({ el, rect, measureIdx, noteIdx, anno }) {
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const container = document.getElementById('osmd-container');
    const cRect = container.getBoundingClientRect();
    
    // Đặt ghi chú phía DƯỚI nốt nhạc thay vì phía trên
    const cx = (rect.left - cRect.left) + rect.width / 2;
    const cy = (rect.top - cRect.top) + rect.height + 15;

    const scale = window.App?.getCurrentZoom?.() ?? 1.0;

    if (anno && anno.text) {
      const div = document.createElement('div');
      div.className = DOT_CLASS;
      div.textContent = anno.text;
      
      div.style.cssText = [
        'position:absolute', `left:${cx}px`, `top:${cy}px`,
        'transform:translateX(-50%)', 'z-index:90',
        'background:#fef3c7', 'border:1px solid #d97706', 'border-radius:4px',
        `font-size:${Math.max(10, 11 * scale)}px`, 'color:#92400e', 'padding:2px 6px',
        'white-space:nowrap', 'user-select:none', 'pointer-events:auto', 'cursor:pointer',
        'box-shadow:0 2px 4px rgba(217,119,6,.15)'
      ].join(';');
      
      div.addEventListener('click', e => { e.stopPropagation(); _showPopup(div, measureIdx, noteIdx, anno); });
      container.appendChild(div);
    } else if (_editEnabled) {
      const dotSize = Math.max(12, Math.round(16 * scale));
      const btn = document.createElement('div');
      btn.className = DOT_CLASS + ' ' + BTN_CLASS;
      btn.textContent = '✎';
      
      btn.style.cssText = [
        'position:absolute', `left:${cx}px`, `top:${cy}px`,
        'transform:translateX(-50%)', 'z-index:80',
        'display:flex', 'align-items:center', 'justify-content:center',
        `width:${dotSize}px`, `height:${dotSize}px`, 'border-radius:50%', 'background:rgba(5,150,105,0.8)',
        'color:#fff', `font-size:${10 * scale}px`, 'line-height:1', 'box-shadow:0 1px 4px rgba(5,150,105,0.4)',
        'pointer-events:auto', 'cursor:pointer', 'user-select:none'
      ].join(';');
      
      btn.addEventListener('click', e => { e.stopPropagation(); _showPopup(btn, measureIdx, noteIdx, null); });
      container.appendChild(btn);
    }
  }

  /* ─── Popup ─────────────────────────────────────────────────── */
  function _showPopup(anchor, measureIdx, noteIdx, anno) {
    _closePopup();
    const ar  = anchor.getBoundingClientRect();
    const pop = document.createElement('div');
    pop.className = 'cc-popup';
    pop.style.cssText = [
      'position:fixed', `left:${ar.left + ar.width / 2}px`, `top:${ar.bottom + 8}px`,
      'transform:translateX(-50%)', 'z-index:99999',
      'background:#fff', 'border:1.5px solid #059669', 'border-radius:8px',
      'padding:.6rem .75rem', 'box-shadow:0 8px 28px rgba(5,150,105,.22)',
      'min-width:200px', 'pointer-events:auto'
    ].join(';');

    pop.innerHTML = `
      <div style="font-size:.65rem;font-weight:700;color:#059669;text-transform:uppercase;margin-bottom:.3rem;">
        ${anno ? 'Sửa' : 'Thêm'} Ghi chú
      </div>
      <input id="ac-pop-inp" type="text" maxlength="30"
             placeholder="Ghi chú text..." value="${anno ? anno.text : ''}"
             style="width:100%;box-sizing:border-box;border:1px solid #ddd;border-radius:5px;
                    padding:.3rem .55rem;font-size:.85rem;outline:none;background:#fef3c7;margin-bottom:.4rem;">
      <div style="display:flex;gap:.35rem;justify-content:flex-end;">
        <button id="ac-pop-save" class="btn btn-primary btn-xs" style="background:#059669;border-color:#059669;">✓ Lưu</button>
        ${anno ? '<button id="ac-pop-del" class="btn btn-danger btn-xs">🗑</button>' : ''}
        <button id="ac-pop-cancel" class="btn btn-ghost btn-xs">✕</button>
      </div>`;

    document.body.appendChild(pop);
    _popup = pop;

    const inp = pop.querySelector('#ac-pop-inp');
    setTimeout(() => { inp?.focus(); inp?.select(); }, 20);

    const doSave = async () => {
      const val = inp.value.trim();
      _closePopup();
      if (val) await _saveAnnotation(measureIdx, noteIdx, val);
      else if (anno) await _deleteAnnotation(measureIdx, noteIdx);
    };

    pop.querySelector('#ac-pop-save')?.addEventListener('click', doSave);
    pop.querySelector('#ac-pop-del')?.addEventListener('click', () => { _closePopup(); _deleteAnnotation(measureIdx, noteIdx); });
    pop.querySelector('#ac-pop-cancel')?.addEventListener('click', _closePopup);
    inp?.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.stopPropagation(); doSave(); }
      if (e.key === 'Escape') { e.stopPropagation(); _closePopup(); }
    });
    
    // Click outside to close
    setTimeout(() => {
      const outside = ev => {
        if (!pop.contains(ev.target) && ev.target !== anchor) {
          _closePopup();
          document.removeEventListener('click', outside, true);
        }
      };
      document.addEventListener('click', outside, true);
    }, 80);
  }

  function _closePopup() { 
      if (_popup) {
          // Bỏ focus trước khi xoá DOM để tránh trình duyệt (đặc biệt là Safari/Chrome di động) tự nhảy trang lên top
          const docActive = document.activeElement;
          if (docActive && _popup.contains(docActive)) {
              docActive.blur();
          }
          _popup.remove(); 
          _popup = null; 
      }
  }

  /* ─── Save / Delete ────────────────────────────────────── */
  async function _saveAnnotation(measureIdx, noteIdx, text) {
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;

    _notes[`${measureIdx}_${noteIdx}`] = { measureIdx, noteIdx, text, color: 'yellow' };
    await _syncServer();
  }

  async function _deleteAnnotation(measureIdx, noteIdx) {
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;

    delete _notes[`${measureIdx}_${noteIdx}`];
    await _syncServer();
  }

  async function _syncServer() {
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;
    
    const arr = Object.values(_notes);
    try {
      const res = await fetch('api/annotations.php', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', songId, annotations: arr })
      });
      const r = await res.json();
      if (r.success) window.App?.showToast?.(`Đã lưu ghi chú`, 'success');
      else window.App?.showToast?.('Lỗi lưu ghi chú', 'error');
    } catch(e) {}
    _build();
  }

  return { init, onOSMDRendered, reposition, loadSong, clearSong, setAddMode, toggleAddMode };
})();

window.AnnotationCanvas = AnnotationCanvas;
