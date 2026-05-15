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

  /* ─── State ───────────────────────────────────────────────────────────────── */
  let _editEnabled   = false;
  let _highlightMode = false; // Chế độ nổi bật: badge tím đậm ngay cả khi không edit
  let _popup         = null;
  let _currentSet    = 'default';
  let _customChords  = {};
  let _noteEls       = [];
  let _ro            = null;
  let _undoStack     = [];   // [{set, chords}]
  let _redoStack     = [];   // [{set, chords}]

  const DOT_CLASS    = 'cc-dot';
  const BTN_CLASS    = 'cc-dot-btn';
  const HIGHLIGHT_KEY = 'sheetapp_chord_highlight'; // localStorage key

  let _isInitialized = false;

  /* ─── Init ──────────────────────────────────────────────────── */
  function init() {
    if (_isInitialized) return;
    _isInitialized = true;

    // Restore highlight mode từ localStorage
    try { _highlightMode = localStorage.getItem(HIGHLIGHT_KEY) === 'true'; } catch(e) {}

    // Cả 2 nút: hidden compat + visible bar button đều trigger toggleAddMode
    document.getElementById('btn-add-chord-mode')?.addEventListener('click', toggleAddMode);
    document.getElementById('btn-add-chord-mode-bar')?.addEventListener('click', toggleAddMode);
    document.getElementById('btn-cancel-add-chord')?.addEventListener('click', () => setAddMode(false));

    // Nút highlight mode
    document.getElementById('btn-chord-highlight')?.addEventListener('click', toggleHighlight);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { _closePopup(); setAddMode(false); }
    });
    
    // ResizeObserver: rebuild khi container resize (khi đổi cửa sổ)
    const container = document.getElementById('osmd-container');
    if (container) {
      let rTid = null;
      _ro = new ResizeObserver(() => {
        // Luôn rebuild khi container resize — kể cả view mode thường
        clearTimeout(rTid);
        rTid = setTimeout(() => { if (!_popup) _build(); }, 150);
      });
      _ro.observe(container);
    }

    // FIX #3: iPad pinch zoom không trigger ResizeObserver — phải dùng visualViewport
    if (window.visualViewport) {
      let vpTid = null;
      const onVpChange = () => {
        // Luôn rebuild khi viewport thay đổi (pinch zoom mobile)
        clearTimeout(vpTid);
        vpTid = setTimeout(() => { if (!_popup) _build(); }, 250);
      };
      window.visualViewport.addEventListener('resize', onVpChange);
      window.visualViewport.addEventListener('scroll', onVpChange);
    }
    
    console.log('[ChordCanvas] init OK');
  }

  function onOSMDRendered() { 
    _alignOSMDChords();
    // Dùng rAF + timeout để đảm bảo SVG đã layout xong trước khi build dots
    setTimeout(() => requestAnimationFrame(_build), 350); 
  }
  function reposition() { 
    _alignOSMDChords();
    setTimeout(() => requestAnimationFrame(_build), 200); 
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

  async function loadSong(songId, initialSet = 'HD') {
    _clear();
    setAddMode(false);
    _currentSet   = initialSet || 'HD';
    _customChords = {};

    // Pre-fetch chords đồng thời với XML fetch của app.js (không block)
    if (songId) {
      try {
        const r = await window.ApiService.chordSets.load(songId, _currentSet);
        if (r.success && r.chords) {
          r.chords.forEach(({ measureIdx, noteIdx, chord }) => {
            _customChords[`${measureIdx}_${noteIdx}`] = chord;
          });
        }
      } catch(e) {}
    }

    setTimeout(_refreshSetDropdown, 300);
  }

  function clearSong() { _clear(); setAddMode(false); }

  /* ─── Mode ──────────────────────────────────────────────────── */
  function setAddMode(on) {
    _editEnabled = !!on;

    // Sync cả 2 nút toggle (hidden compat + visible bar)
    document.getElementById('btn-add-chord-mode')?.classList.toggle('active', on);
    document.getElementById('btn-add-chord-mode-bar')?.classList.toggle('active', on);

    // Floating hint banner (mới)
    document.getElementById('chord-edit-hint')?.classList.toggle('hidden', !on);

    // Inline edit controls trong bar: clear-all và cancel
    document.getElementById('btn-clear-all-chords')?.classList.toggle('hidden', !on);
    document.getElementById('btn-cancel-add-chord')?.classList.toggle('hidden', !on);

    // Legacy compat
    document.getElementById('add-chord-hint')?.classList.toggle('hidden', !on);

    // Chord dots
    // Thay vì ẩn hiện display, ta gọi _build() để nó tự render lại trạng thái Edit/View
    if (on) {
      _build();
    } else {
      _closePopup();
      _build();
    }
  }

  function toggleAddMode() { setAddMode(!_editEnabled); }

  /* ─── Highlight Mode ─────────────────────────────────────────── */
  /**
   * Chế độ nổi bật: badge tím đậm thường trực, không cần vào edit mode.
   * Phân biệt với edit mode: click badge mở popup nhưng cursor không dời về từng nốt.
   */
  function toggleHighlight() {
    _highlightMode = !_highlightMode;
    try { localStorage.setItem(HIGHLIGHT_KEY, String(_highlightMode)); } catch(e) {}

    // Sync nút
    const btn = document.getElementById('btn-chord-highlight');
    if (btn) {
      btn.classList.toggle('active', _highlightMode);
      btn.title = _highlightMode ? 'Tắt nổi bật hợp âm' : 'Bật nổi bật hợp âm';
    }

    // Rebuild overlay
    _build();
  }

  function setHighlightMode(on) {
    _highlightMode = !!on;
    try { localStorage.setItem(HIGHLIGHT_KEY, String(_highlightMode)); } catch(e) {}
    const btn = document.getElementById('btn-chord-highlight');
    if (btn) btn.classList.toggle('active', _highlightMode);
    _build();
  }


  /* ─── Build dots ─────────────────────────────────────────────── */
  function _clear() {
    document.querySelectorAll('.' + DOT_CLASS).forEach(d => d.remove());
    _closePopup();
    _noteEls = [];
  }

  let _containerEl = null;
  let _styleBlockEl = null;

  function _build() {
    _clear();
    if (!_containerEl) _containerEl = document.getElementById('osmd-container');
    const container = _containerEl;
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
    if (!_styleBlockEl) {
        _styleBlockEl = document.getElementById('cc-custom-style');
        if (!_styleBlockEl) {
            _styleBlockEl = document.createElement('style');
            _styleBlockEl.id = 'cc-custom-style';
            document.head.appendChild(_styleBlockEl);
        }
    }
    let styleBlock = _styleBlockEl;

    if (_currentSet === 'default') {
        styleBlock.textContent = '';
    } else {
        // Ẩn nội dung text của ChordSymbol (dựa vào class vf-chordsymbol)
        // ĐỒNG THỜI ẩn tất cả các thẻ text trong SVG có màu trùng với màu hợp âm (để triệt tiêu hoàn toàn hợp âm rác)
        const chordColor = window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626';
        styleBlock.textContent = `
          #osmd-container svg g.vf-chordsymbol text,
          #osmd-container svg g.vf-chordsymbol tspan,
          #osmd-container svg text[fill="${chordColor}"],
          #osmd-container svg text[fill="${chordColor}"] tspan {
            fill: transparent !important;
            stroke: transparent !important;
            user-select: none;
          }
        `;
    }

    const rawChordMap = _currentSet === 'default'
      ? ChordCanvasXML.readXmlChords()
      : _applyTranspose(_customChords);

    const mapped = _mapNotes(notes, rawChordMap);

    // ── DEDUP: loại bỏ các note trùng key (measureIdx_noteIdx)
    // Xảy ra khi bài SATB có nhiều voice/notehead tại cùng 1 vị trí nhịp-nốt.
    // Giữ lại phần tử ĐẦU TIÊN (voice cao nhất = primary) để tránh render 2 badge.
    const seenKeys = new Set();
    const dedupedMapped = mapped.filter(m => {
      // Dedup TẤT CẢ theo key — kể cả nút "+" (không chord) để tránh click zone chồng nhau
      const key = `${m.measureIdx}_${m.noteIdx}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    // ── Xây dựng map: vị trí chord text SVG → để đặt badge PHÍA TRÊN chữ hợp âm
    // getBoundingClientRect() trả về viewport px → zoom-safe, luôn đúng sau mỗi re-render
    const chordTextPositions = _buildChordTextPositions(dedupedMapped, container);

    dedupedMapped.forEach(m => _placeDot(m, chordTextPositions));

    // Canh thẳng hàng ngang các hợp âm trên cùng một dòng (tránh nhảy múa lên xuống theo nốt)
    _alignDOMChords();
  }

  /* ─── Align DOM Chords — cố định theo đường kẻ trên cùng của khuông nhạc ──── */
  /**
   * Chiến lược:
   * 1. Quét SVG tìm TẤT CẢ horizontal staff lines (dòng kẻ ngang).
   * 2. Nhóm thành các "system" (khuông nhạc) theo dải Y.
   * 3. Mỗi system có topLine = đường kẻ trên cùng → Y cố định cho badge = topLine - GAP.
   * 4. GAP là px màn hình thực (không nhân scale) → không thay đổi khi zoom.
   */
  function _alignDOMChords() {
    const container = document.getElementById('osmd-container');
    if (!container) return;

    const cRect = container.getBoundingClientRect();
    const GAP_PX = 22; // px từ top staff line lên badge — KHÔNG đổi khi zoom

    // ── 1. Tìm tất cả đường kẻ ngang SVG (staff lines) ──────────────
    const svg = container.querySelector('svg');
    if (!svg) return;

    // OSMD vẽ staff lines bằng <line> hoặc <path> trong group .vf-stave
    // Cũng có thể là path d="M x1 y H x2" — dùng getBoundingClientRect() để lấy Y thực
    let staffLineRects = [];
    const staveGroups = Array.from(svg.querySelectorAll('g.vf-stave, g[class*="stave"]'));
    if (staveGroups.length) {
      staveGroups.forEach(g => {
        // Lấy các line/path con là đường ngang (width >> height)
        Array.from(g.querySelectorAll('line, path')).forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.width > 40 && r.height < 4 && r.top > 0) {
            staffLineRects.push(r.top - cRect.top); // Y trong container coords
          }
        });
      });
    }

    // Fallback: tìm tất cả <line> ngang trong SVG
    if (!staffLineRects.length) {
      Array.from(svg.querySelectorAll('line')).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 40 && r.height < 4 && r.top > 0) {
          staffLineRects.push(r.top - cRect.top);
        }
      });
    }

    if (!staffLineRects.length) {
      // Không tìm được staff lines — fallback về align theo minTop trong mỗi dải
      _alignDOMChordsFallback(container);
      return;
    }

    // ── 2. Nhóm staff lines thành hệ (system) ──────────────────────
    // Mỗi hệ 5 dòng kẻ, cách nhau ~4px. Giữa các hệ, gap lớn hơn nhiều.
    staffLineRects.sort((a, b) => a - b);

    const systems = [];  // [{topY, bottomY}]
    let sysStart = staffLineRects[0];
    let prev = staffLineRects[0];
    const SYS_GAP = 30; // gap tối thiểu giữa 2 system (px)

    for (let i = 1; i < staffLineRects.length; i++) {
      const curr = staffLineRects[i];
      if (curr - prev > SYS_GAP) {
        systems.push({ topY: sysStart, bottomY: prev });
        sysStart = curr;
      }
      prev = curr;
    }
    systems.push({ topY: sysStart, bottomY: prev });

    // ── 3. Gom badge theo system, ép về Y cố định ──────────────────
    const allBadges = Array.from(
      container.querySelectorAll('.cc-edit-badge, .cc-chord-text, .cc-custom-chord-text')
    );
    if (!allBadges.length) return;

    systems.forEach(sys => {
      // Badge thuộc về system nào? Badge nằm trên topY (tối đa 120px phía trên)
      const targetY = sys.topY - GAP_PX;

      const inSystem = allBadges.filter(el => {
        const elTop = parseFloat(el.style.top);
        if (isNaN(elTop)) return false;
        // Badge nằm trong vùng từ (topY - 140) đến (bottomY + 40)
        return elTop >= sys.topY - 140 && elTop <= sys.bottomY + 40;
      });

      inSystem.forEach(el => {
        el.style.top = targetY + 'px';
        // Cập nhật transform để vẫn center theo chiều dọc
        const cur = el.style.transform || '';
        if (!cur.includes('translateY')) {
          // translate(-50%, -50%) → giữ nguyên, chỉ override top
        }
      });
    });
  }

  /** Fallback khi không có staff line data: chỉ align về minTop trong mỗi dải 60px */
  function _alignDOMChordsFallback(container) {
    const elements = Array.from(
      container.querySelectorAll('.cc-edit-badge, .cc-chord-text, .cc-custom-chord-text')
    );
    if (!elements.length) return;

    const rows = [];
    elements.forEach(el => {
      const top = parseFloat(el.style.top);
      if (isNaN(top)) return;
      let found = false;
      for (const row of rows) {
        if (Math.abs(row.avgTop - top) < 60) {
          row.els.push(el);
          row.minTop = Math.min(row.minTop, top);
          const sum = row.els.reduce((s, e) => s + parseFloat(e.style.top), 0);
          row.avgTop = sum / row.els.length;
          found = true; break;
        }
      }
      if (!found) rows.push({ avgTop: top, minTop: top, els: [el] });
    });
    rows.forEach(row => row.els.forEach(el => { el.style.top = row.minTop + 'px'; }));
  }


  /* ─── Build chord text position map ────────────────────────── */
  /**
   * Map từ `${measureIdx}_${noteIdx}` → { bx, by, bw, bh } trong container coords.
   * Dùng để đặt badge ✎ PHÍA TRÊN văn bản hợp âm thay vì đè lên nó.
   * @returns {Map<string, {bx:number, by:number, bw:number, bh:number}>}
   */
  function _buildChordTextPositions(mapped, container) {
    const result = new Map();
    const svg = container?.querySelector('svg');
    if (!svg) return result;

    const cRect = container.getBoundingClientRect();

    // Lấy tất cả chord text SVG, sort top→bottom, left→right (đúng thứ tự bài nhạc)
    const chordTextEls = Array.from(
      svg.querySelectorAll('g.vf-chordsymbol text')
    ).sort((a, b) => {
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      if (Math.abs(ra.top - rb.top) > 15) return ra.top - rb.top;
      return ra.left - rb.left;
    });
    if (!chordTextEls.length) return result;

    // Mapped notes có hợp âm, cùng thứ tự OSMD render
    const chordNotes = mapped
      .filter(m => m.chord && m.measureIdx >= 0)
      .sort((a, b) => a.measureIdx - b.measureIdx || a.noteIdx - b.noteIdx);
    if (!chordNotes.length) return result;

    // Match 1-1: chordNote[i] ↔ chordTextEl[i]
    const count = Math.min(chordTextEls.length, chordNotes.length);
    for (let i = 0; i < count; i++) {
      const rect = chordTextEls[i].getBoundingClientRect();
      const key  = `${chordNotes[i].measureIdx}_${chordNotes[i].noteIdx}`;
      result.set(key, {
        bx: rect.left - cRect.left,
        by: rect.top  - cRect.top,
        bw: rect.width,
        bh: rect.height,
      });
    }
    return result;
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
  function _placeDot({ el, rect, measureIdx, noteIdx, chord }, chordTextPositions = new Map()) {
    if (!rect || rect.width === 0 || rect.height === 0) return;
    const container = document.getElementById('osmd-container');
    const cRect = container.getBoundingClientRect();

    const scale   = ChordCanvasUI.getScale();
    const dotSize = ChordCanvasUI.getDotSize(scale);
    // Font size: scale tỉ lệ đẹp với zoom, min 13px, max 22px
    const fSize   = Math.min(22, Math.max(13, Math.round(14 * scale)));

    // Vị trí fallback dựa vào nốt nhạc (cách nốt một khoảng tỉ lệ thuận với scale)
    const cx = (rect.left - cRect.left) + rect.width / 2;
    const cy = (rect.top  - cRect.top)  - (25 * scale);

    if (chord) {
      if (!_editEnabled && _currentSet === 'default') return;

      // Tìm vị trí chord text SVG (nếu OSMD đã render)
      const textPos = chordTextPositions.get(`${measureIdx}_${noteIdx}`);

      if (_currentSet === 'default') {
        // Mặc định: OSMD đã vẽ hợp âm, ta chỉ chèn badge ✎ phía trên
        const badgeX = textPos ? textPos.bx + textPos.bw / 2 : cx;
        const badgeY = textPos ? textPos.by - 6 : cy - dotSize / 2;

        const badge = document.createElement('div');
        badge.className = DOT_CLASS + ' cc-edit-badge';
        badge.textContent = '\u270e';
        badge.title = 'Sửa hợp âm: ' + chord;
        ChordCanvasUI.applyAbsolute(badge, badgeX, badgeY, [
          'display:' + (_editEnabled ? 'flex' : 'none'),
          'align-items:center', 'justify-content:center',
          'width:' + dotSize + 'px', 'height:' + dotSize + 'px', 'border-radius:50%',
          'background:rgba(109,40,217,0.87)',
          'border:2.5px solid rgba(255,255,255,0.8)',
          'color:#fff', 'font-size:' + fSize + 'px', 'line-height:1',
          'box-shadow:0 2px 7px rgba(109,40,217,0.55)',
          'pointer-events:auto', 'cursor:pointer', 'user-select:none', 'z-index:12',
          'transform: translateX(-50%) translateY(-100%)',
          'transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease'
        ]);
        badge.addEventListener('mouseenter', () => { badge.style.transform = 'translateX(-50%) translateY(-100%) scale(1.15)'; badge.style.background = 'rgba(109,40,217,1)'; badge.style.boxShadow = '0 4px 12px rgba(109,40,217,0.7)'; });
        badge.addEventListener('mouseleave', () => { badge.style.transform = 'translateX(-50%) translateY(-100%) scale(1)'; badge.style.background = 'rgba(109,40,217,0.87)'; badge.style.boxShadow = '0 2px 7px rgba(109,40,217,0.55)'; });
        badge.addEventListener('click', e => { e.stopPropagation(); _showPopup(badge, measureIdx, noteIdx, chord); });
        container.appendChild(badge);

        const span = document.createElement('span');
        span.className = DOT_CLASS + ' cc-chord-text';
        span.title = chord;
        const spanX = textPos ? textPos.bx + textPos.bw / 2 : cx;
        const spanY = textPos ? textPos.by + textPos.bh / 2 : cy;
        ChordCanvasUI.applyAbsolute(span, spanX, spanY, [
          'transform: translate(-50%, -50%)', 'opacity:0', 'width:60px', 'height:22px',
          'pointer-events:' + (_editEnabled ? 'auto' : 'none'),
          'cursor:pointer', 'display:block'
        ]);
        span.addEventListener('click', e => {
          if (!_editEnabled) return;
          e.stopPropagation(); _showPopup(span, measureIdx, noteIdx, chord);
        });
        container.appendChild(span);

      } else {
        // Custom: Dùng DOM Overlay vĩnh viễn (do OSMD đã bị ẩn fill: transparent)
        let spanX = textPos ? textPos.bx + textPos.bw / 2 : cx;
        // spanY: top edge của badge — _alignDOMChords sẽ ép về staffTopY - GAP
        let spanY = cy - (18 * scale); // rough initial Y, sẽ được align
        if (textPos) {
          spanY = textPos.by - 4; // ngay trên text SVG
        } else {
          let closestDist = Infinity;
          for (let pos of chordTextPositions.values()) {
            let dist = Math.abs(pos.by - cy);
            if (dist < 120 * scale && dist < closestDist) {
              closestDist = dist;
              spanY = pos.by - 4;
            }
          }
        }

        const textBadge = document.createElement('div');
        textBadge.className = DOT_CLASS + ' cc-custom-chord-text';
        textBadge.textContent = chord;
        textBadge.title = _editEnabled ? 'Sửa hợp âm: ' + chord : chord;

        const chordColor = window.DisplaySettings?.getChordPrefs?.()?.color || '#dc2626';
        // Parse màu để tạo nền nhạt tương ứng
        const _hex2rgb = h => { const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return r ? [parseInt(r[1],16),parseInt(r[2],16),parseInt(r[3],16)] : [220,38,38]; };
        const [cr,cg,cb] = _hex2rgb(chordColor);

        const baseStyle = [
          'position:absolute', `left:${spanX}px`, `top:${spanY}px`,
          'transform:translateX(-50%)',  // CHỈ center theo X, top là điểm neo
          'font-family: "Georgia", serif', 'font-weight: bold',
          'white-space: nowrap', 'z-index: 12',
          'letter-spacing: -0.01em', 'line-height: 1'
        ];
        baseStyle.push(`font-size: ${fSize}px`);

        if (_editEnabled) {
          // Chế độ chỉnh sửa: viền màu accent, nền trắng
          baseStyle.push(
            `color: rgb(${cr},${cg},${cb})`,
            'background: rgba(255,255,255,0.97)',
            `border: 1.5px solid rgba(${cr},${cg},${cb},0.7)`,
            'border-radius: 6px',
            'padding: 2px 7px',
            `box-shadow: 0 2px 8px rgba(${cr},${cg},${cb},0.22)`,
            'cursor: pointer', 'pointer-events: auto',
            'transition: transform 0.15s ease, box-shadow 0.15s ease'
          );
          textBadge.addEventListener('mouseenter', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1.1)';
            textBadge.style.boxShadow = `0 4px 14px rgba(${cr},${cg},${cb},0.38)`;
          });
          textBadge.addEventListener('mouseleave', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1)';
            textBadge.style.boxShadow = `0 2px 8px rgba(${cr},${cg},${cb},0.22)`;
          });
          textBadge.addEventListener('click', e => { e.stopPropagation(); _showPopup(textBadge, measureIdx, noteIdx, chord); });
        } else if (_highlightMode) {
          // Chế độ nổi bật: badge tím đậm — như edit mode nhưng không cần chỉnh sửa
          baseStyle.push(
            'color: #fff',
            'background: rgba(109,40,217,0.9)',
            'border: 1.5px solid rgba(109,40,217,0.7)',
            'border-radius: 7px',
            'padding: 3px 8px',
            'box-shadow: 0 3px 10px rgba(109,40,217,0.4)',
            'cursor: pointer', 'pointer-events: auto',
            'transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
            'font-family: "Georgia", serif', 'letter-spacing: 0.01em'
          );
          textBadge.addEventListener('mouseenter', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1.12)';
            textBadge.style.background = 'rgba(109,40,217,1)';
            textBadge.style.boxShadow = '0 6px 18px rgba(109,40,217,0.55)';
          });
          textBadge.addEventListener('mouseleave', () => {
            textBadge.style.transform = 'translateX(-50%) scale(1)';
            textBadge.style.background = 'rgba(109,40,217,0.9)';
            textBadge.style.boxShadow = '0 3px 10px rgba(109,40,217,0.4)';
          });
          textBadge.addEventListener('click', e => {
            e.stopPropagation();
            setAddMode(true);
            _showPopup(textBadge, measureIdx, noteIdx, chord);
          });
        } else {
          // Chế độ xem thường: pill nền nhạt + viền mờ — dễ đọc như tập bài hát in
          baseStyle.push(
            `color: rgb(${cr},${cg},${cb})`,
            `background: rgba(${cr},${cg},${cb},0.06)`,
            `border: 1px solid rgba(${cr},${cg},${cb},0.22)`,
            'border-radius: 5px',
            'padding: 1px 6px',
            'box-shadow: none',
            'cursor: pointer', 'pointer-events: auto',
            'transition: background 0.15s ease, transform 0.12s ease'
          );
          textBadge.addEventListener('mouseenter', () => {
            textBadge.style.background = `rgba(${cr},${cg},${cb},0.13)`;
            textBadge.style.transform = 'translateX(-50%) scale(1.05)';
          });
          textBadge.addEventListener('mouseleave', () => {
            textBadge.style.background = `rgba(${cr},${cg},${cb},0.06)`;
            textBadge.style.transform = 'translateX(-50%) scale(1)';
          });
          textBadge.addEventListener('click', e => {
            e.stopPropagation();
            // Bật edit mode rồi mở popup
            setAddMode(true);
            _showPopup(textBadge, measureIdx, noteIdx, chord);
          });
        }


        textBadge.style.cssText = baseStyle.join(';');
        container.appendChild(textBadge);
      }
    } else {
      const btn = document.createElement('div');
      btn.className = DOT_CLASS + ' ' + BTN_CLASS;
      btn.textContent = '+';
      ChordCanvasUI.applyAbsolute(btn, cx, cy, [
        'display:' + (_editEnabled ? 'flex' : 'none'), 'align-items:center', 'justify-content:center',
        `width:${dotSize}px`, `height:${dotSize}px`, 'border-radius:50%', 'background:rgba(109,40,217,0.8)',
        'color:#fff', `font-size:${fSize}px`, 'line-height:1', 'box-shadow:0 1px 4px rgba(109,40,217,0.4)',
        'pointer-events:auto', 'cursor:pointer', 'user-select:none',
        'transition: transform 0.15s ease, background 0.15s ease'
      ]);
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.15)'; btn.style.background = 'rgba(109,40,217,1)'; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; btn.style.background = 'rgba(109,40,217,0.8)'; });
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
  /* ─── Undo / Redo ────────────────────────────────────────────────────────── */
  function _pushUndo() {
    _undoStack.push({ set: _currentSet, chords: {..._customChords} });
    if (_undoStack.length > 20) _undoStack.shift();
    _redoStack = []; // clear redo on new action
  }

  async function undo() {
    if (!_undoStack.length) { window.App?.showToast?.('Không có hành động để hoàn tác', 'info'); return; }
    _redoStack.push({ set: _currentSet, chords: {..._customChords} });
    const prev = _undoStack.pop();
    _currentSet   = prev.set;
    _customChords = prev.chords;
    if (_currentSet !== 'default') {
      await _saveCustomSet();
    }
    setTimeout(() => requestAnimationFrame(_build), 80);
    window.App?.showToast?.('↩ Đã hoàn tác', 'info');
  }

  async function redo() {
    if (!_redoStack.length) { window.App?.showToast?.('Không có hành động để làm lại', 'info'); return; }
    _undoStack.push({ set: _currentSet, chords: {..._customChords} });
    const next = _redoStack.pop();
    _currentSet   = next.set;
    _customChords = next.chords;
    if (_currentSet !== 'default') {
      await _saveCustomSet();
    }
    setTimeout(() => requestAnimationFrame(_build), 80);
    window.App?.showToast?.('↪ Đã làm lại', 'info');
  }

  async function _saveChord(measureIdx, noteIdx, chordInput, refreshLayout = true) {
    _pushUndo();
    const semitones = window.App?.getCurrentTranspose?.() ?? 0;
    const chordOriginalKey = semitones !== 0 ? TransposeEngine.transposeChord(chordInput, -semitones) : chordInput;

    // Đảm bảo màu hợp âm luôn đúng (tránh màu đen sau khi reload)
    window.OSMDRenderer?.refreshRules?.();

    if (_currentSet === 'default') {
      // Default set: cần inject vào XML gốc → full reload OSMD (có scroll-lock)
      await ChordCanvasXML.injectXml(measureIdx, noteIdx, chordOriginalKey, refreshLayout);
    } else {
      // Custom set (HD, ...): chỉ cần update bộ nhớ + lưu server + rebuild dots
      // KHÔNG cần full OSMD reload → scroll không bị nhảy
      _customChords[`${measureIdx}_${noteIdx}`] = chordOriginalKey;
      await _saveCustomSet();
      // Rebuild dots tại chỗ (không reload OSMD SVG)
      if (refreshLayout) {
        setTimeout(() => requestAnimationFrame(_build), 80);
      }
    }
  }

  async function _deleteChord(measureIdx, noteIdx) {
    _pushUndo();
    if (_currentSet === 'default') {
      await ChordCanvasXML.removeXml(measureIdx, noteIdx);
    } else {
      delete _customChords[`${measureIdx}_${noteIdx}`];
      await _saveCustomSet();
      // Rebuild dots tại chỗ — không reload OSMD
      setTimeout(() => requestAnimationFrame(_build), 80);
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
      const r = await window.ApiService.chordSets.save(songId, _currentSet, arr);
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
          const r = await window.ApiService.chordSets.load(songId, name);
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
    // Lưu chord set vào URL
    window.URLState?.update?.({ set: name });
  }

  async function createSet(name) {
    if (!name?.trim()) return;
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;

    try {
      const r = await window.ApiService.chordSets.save(songId, name, []);
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
    // RULE: TLH (default) và HD đều bị lock — không cho xóa
    if (!name || name === 'default' || name === 'HD') {
      window.App?.showToast?.('Bộ này được bảo vệ, không thể xóa!', 'error');
      return;
    }
    const songId = window.App?.getCurrentSongId?.();
    if (!songId) return;
    try {
      await window.ApiService.chordSets.delete(songId, name);
    } catch(e) {}
    if (_currentSet === name) await switchSet('HD'); // fallback về HD thay vì default
    _refreshSetDropdown();
  }

  /* ─── Set dropdown UI ───────────────────────────────────────── */
  async function _refreshSetDropdown() {
    const selector  = document.getElementById('chord-set-selector');
    const deleteBtn = document.getElementById('btn-delete-chord-set');
    const countBadge = document.getElementById('chord-set-count');
    if (!selector) return;

    const songId = window.App?.getCurrentSongId?.();
    if (!songId) {
      selector.innerHTML = '<option value="default">TLH (gốc)</option>';
      selector.disabled = true; return;
    }

    selector.disabled = false;
    let sets = ['default'];
    try {
      const r = await window.ApiService.chordSets.list(songId);
      if (r.success) {
        // Đảm bảo HD luôn trong danh sách (dù rỗng)
        const hdInList = r.sets.some(s => s === 'HD');
        sets = ['default', ...(hdInList ? r.sets : ['HD', ...r.sets])];
      }
    } catch(e) {}

    // Hiện số hợp âm trong set hiện tại
    const chordCount = Object.keys(_customChords).length;
    const countText  = _currentSet !== 'default'
      ? (chordCount > 0 ? `● ${chordCount} hợp âm` : '○ Chưa có')
      : '';
    if (countBadge) {
      countBadge.textContent = countText;
      countBadge.style.color = chordCount > 0 ? 'var(--success,#16a34a)' : 'var(--text-muted,#9ca3af)';
    }

    selector.innerHTML = sets.map(s =>
      `<option value="${s}" ${s === _currentSet ? 'selected' : ''}>${
        s === 'default' ? 'TLH (gốc)' : s
      }</option>`
    ).join('');

    const isAdmin    = window.Auth?.isAdmin?.()   ?? false;
    const isLoggedIn = window.Auth?.isLoggedIn?.() ?? false;
    // RULE: TLH và HD đều lock — nút xóa chỉ hiện khi set khác default + HD
    const isDeletable = _currentSet !== 'default' && _currentSet !== 'HD' && isAdmin;
    if (deleteBtn) deleteBtn.style.display = isDeletable ? 'inline-flex' : 'none';
    const newBtn = document.getElementById('btn-new-chord-set');
    if (newBtn) newBtn.classList.toggle('hidden', !isLoggedIn);
  }

  function _updateSetUI() {
    const selector = document.getElementById('chord-set-selector');
    if (selector) selector.value = _currentSet;
    const isAdmin2    = window.Auth?.isAdmin?.()    ?? false;
    const isLoggedIn2 = window.Auth?.isLoggedIn?.() ?? false;
    const deleteBtn2  = document.getElementById('btn-delete-chord-set');
    if (deleteBtn2) deleteBtn2.style.display = (_currentSet !== 'default' && isAdmin2) ? 'inline-flex' : 'none';
    const newBtn2 = document.getElementById('btn-new-chord-set');
    if (newBtn2) newBtn2.classList.toggle('hidden', !isLoggedIn2);
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
  function resetSet() {
    _currentSet = 'HD';   // Reset về HD (không phải default) khi chuyển bài
    _customChords = {};
    _updateSetUI();
  }

  return {
    init, onOSMDRendered, reposition, loadSong, clearSong,
    setAddMode, toggleAddMode, switchSet, createSet, deleteSet,
    showNewSetModal, resetSet,
    confirmDeleteSet: async () => {
      const sel  = document.getElementById('chord-set-selector');
      const name = sel?.value;
      // RULE: TLH (default) và HD đều bị lock
      if (!name || name === 'default' || name === 'HD') {
        window.App?.showToast?.('Bộ TLH và HD được bảo vệ, không thể xóa!', 'error');
        return;
      }
      ChordCanvasUI.showDeleteConfirmModal(name, {
        onConfirm: async () => await deleteSet(name)
      });
    },
    refreshSetDropdown: _refreshSetDropdown,
    openNextPopup,
    isPopupOpen: () => !!_popup,
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
    getCurrentSet: () => _currentSet,
    getCustomChords: () => _customChords,
    toggleHighlight,
    setHighlightMode,
    isHighlightMode: () => _highlightMode,
    undo,
    redo
  };
})();

window.ChordCanvas = ChordCanvas;
