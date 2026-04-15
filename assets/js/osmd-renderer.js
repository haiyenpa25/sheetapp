/**
 * osmd-renderer.js
 * Wrapper module cho OpenSheetMusicDisplay (OSMD).
 * Quản lý lifecycle: init → load → render → zoom → transpose.
 */
const OSMDRenderer = (() => {
  let osmd = null;
  let containerId = null;
  let currentXmlString = null;
  let currentZoom = 1.0;
  let currentTranspose = 0;
  let isLoaded = false;
  let onReadyCallback = null;
  let _isCompactMode = false;
  let _titleCompacted = false; // flag tránh compact title nhiều lần

  /**
   * Khởi tạo OSMD vào một container DOM.
   */
  function init(id, options = {}) {
    containerId = id;
    const container = document.getElementById(id);
    if (!container) throw new Error(`Container #${id} không tồn tại`);

    osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(container, {
      autoResize: true,
      backend: 'svg',
      drawTitle: true,
      drawSubtitle: true,
      drawComposer: true,
      drawCredits: true,
      coloringEnabled: true,
      pageFormat: 'Endless',  // Scroll vertically, no page breaks
      engravingRules: {
        // Chord symbols
        ChordSymbolFontFamily: "OSMDChordFont, sans-serif",
        ChordSymbolTextHeight: 2.2,
        ChordSymbolYOffset: 0.8,
        DefaultColorChordSymbol: '#dc2626',
        // Sheet layout
        StaffLineWidth: 0.1,
        StemWidth: 0.15,
        TupletNumberTextHeight: 1.5,
        // Title tự điều chỉnh đẹp hơn
        TitleTopDistance: 1.5,        // Giảm khoảng trống phía trên
        SheetTitleHeight: 2.0,        // Cỡ chữ title vừa phải (OSMD default ~4.0)
        SheetComposerHeight: 1.5,     // Nhạc sĩ nhỏ gọn hơn
        SheetAuthorHeight: 1.5,
      },
      ...options
    });

    // Force specific rules onto the rules object as some versions ignore constructor config
    if (osmd.rules) {
        refreshRules();
        osmd.rules.ChordSymbolFontFamily = "OSMDChordFont, sans-serif";
    }

    // Resize observer để auto-reflow khi container thay đổi kích thước
    const resizeObserver = new ResizeObserver(_debounce(async () => {
      if (isLoaded) {
          await osmd.render();
          _titleCompacted = false; // reset để compact lại sau resize
          _compactTitleSVG();
          if (window.ChordCanvas) window.ChordCanvas.reposition();
          if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
      }
    }, 400));
    resizeObserver.observe(container);

    return osmd;
  }

  /**
   * Cập nhật lại Engraving Rules trước khi render
   */
  function refreshRules() {
    if (osmd && osmd.rules) {
        let prefs = { size: 2.2, yOffset: 0.8, color: '#dc2626' };
        if (window.DisplaySettings) prefs = DisplaySettings.getChordPrefs();

        osmd.rules.DefaultColorChordSymbol = prefs.color;
        osmd.rules.ChordSymbolTextHeight   = prefs.size;
        osmd.rules.ChordSymbolYOffset      = prefs.yOffset;

        // Title sizing — đặt lại mỗi lần refresh
        if (osmd.rules.SheetTitleHeight !== undefined)   osmd.rules.SheetTitleHeight   = 2.0;
        if (osmd.rules.SheetComposerHeight !== undefined) osmd.rules.SheetComposerHeight = 1.5;
        if (osmd.rules.SheetAuthorHeight !== undefined)   osmd.rules.SheetAuthorHeight   = 1.5;
        if (osmd.rules.TitleTopDistance !== undefined)    osmd.rules.TitleTopDistance    = 1.5;
    }
  }

  /**
   * Cắt tỉa XML gốc ngay từ trong trứng nước (Xoá thẻ DOM) để dẹp sạch nốt bè/chùm
   */
  function preprocessXML(xml) {
      if (!window.DisplaySettings || !_isCompactMode) return xml;
      const prefs = DisplaySettings.getCompactPrefs();
      if (!prefs.hideVoices && !prefs.hideChordNotes) return xml;

      try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, "application/xml");

          if (prefs.hideVoices) {
              const voices = doc.querySelectorAll("note voice");
              voices.forEach(v => {
                  if (parseInt(v.textContent) > 1) {
                      v.parentNode.remove();
                  }
              });

              // FIX: Sau khi xoa notes voice>1, cac slur/tie elements con lai
              // co the mat "pair" (start khong co stop). OSMD ve arc khong lo.
              // Giai phap: xoa toan bo slur + tie trong compact mode
              doc.querySelectorAll("notations slur").forEach(el => el.remove());
              doc.querySelectorAll("notations tied").forEach(el => el.remove());
              doc.querySelectorAll("note > tie").forEach(el => el.remove());
          }

          if (prefs.hideChordNotes) {
              const measures = doc.querySelectorAll("measure");
              measures.forEach(measure => {
                  const notes = measure.querySelectorAll("note");
                  let currentPrimaryNote = null;
                  let maxPitchVal = -1;
                  let maxPitchNode = null;

                  notes.forEach(note => {
                      if (note.querySelector("rest")) return;

                      const pitchNode = note.querySelector("pitch");
                      if (!pitchNode) return;

                      const step = pitchNode.querySelector("step")?.textContent;
                      const alterNode = pitchNode.querySelector("alter");
                      const alter = alterNode ? parseInt(alterNode.textContent) : 0;
                      const octave = parseInt(pitchNode.querySelector("octave")?.textContent || "0");
                      
                      const stepVals = { 'C':0, 'D':2, 'E':4, 'F':5, 'G':7, 'A':9, 'B':11 };
                      const pitchVal = octave * 12 + (stepVals[step] || 0) + alter;

                      if (note.querySelector("chord")) {
                          if (currentPrimaryNote) {
                              if (pitchVal > maxPitchVal) {
                                  maxPitchVal = pitchVal;
                                  maxPitchNode = pitchNode.cloneNode(true);
                              }
                              note.parentNode.removeChild(note);
                          }
                      } else {
                          // Kết thúc nhóm (cluster) cũ, áp dụng cao độ lớn nhất cho nốt chính
                          if (currentPrimaryNote && maxPitchNode) {
                              const pPitch = currentPrimaryNote.querySelector("pitch");
                              if (pPitch && pPitch.innerHTML !== maxPitchNode.innerHTML) {
                                  pPitch.innerHTML = maxPitchNode.innerHTML;
                              }
                          }
                          // Bắt đầu nhóm mới với nốt không có chord
                          currentPrimaryNote = note;
                          maxPitchVal = pitchVal;
                          maxPitchNode = pitchNode.cloneNode(true);
                      }
                  });
                  
                  // Xử lý nốt cuối cùng trong ô nhịp
                  if (currentPrimaryNote && maxPitchNode) {
                      const pPitch = currentPrimaryNote.querySelector("pitch");
                      if (pPitch && pPitch.innerHTML !== maxPitchNode.innerHTML) {
                          pPitch.innerHTML = maxPitchNode.innerHTML;
                      }
                  }
              });
          }

          const serializer = new XMLSerializer();
          return serializer.serializeToString(doc);
      } catch (err) {
          console.error("XML Preprocess error:", err);
          return xml;
      }
  }

  /**
   * Nạp XML string vào OSMD và render.
   * @param {string} xmlString - Nội dung MusicXML
   * @param {number} transposeValue - Số nửa cung để dịch (Mặc định: 0)
   */
  async function load(xmlString, transposeValue = 0) {
    if (!osmd) throw new Error('OSMD chưa được khởi tạo. Gọi init() trước.');
    currentXmlString = xmlString; // Luôn giữ bản gốc
    isLoaded = false;

    try {
      const processedXml = preprocessXML(xmlString);
      await osmd.load(processedXml);
      osmd.zoom = currentZoom;
      _applyCompactMode();
      
      if (osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
          osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
          osmd.Sheet.Transpose = transposeValue;
          osmd.updateGraphic();
      }

      refreshRules();
      await osmd.render();
      _titleCompacted = false;
      _compactTitleSVG();
      isLoaded = true;
      if (onReadyCallback) onReadyCallback(osmd);
      return osmd;
    } catch (err) {
      console.error('[OSMD] Lỗi khi load:', err);
      throw err;
    }
  }

  /**
   * Reload lại OSMD với XML đã sửa (transpose, chord override, v.v.)
   * @param {string} xmlString - Nội dung XML đã được xử lý
   * @param {number} transposeValue - Số nửa cung để dịch
   */
  async function reload(xmlString, transposeValue = 0) {
    if (!osmd) throw new Error('OSMD chưa init');
    if (xmlString) currentXmlString = xmlString;
    try {
      const processedXml = preprocessXML(currentXmlString);
      await osmd.load(processedXml);
      osmd.zoom = currentZoom;
      if (window.InstrumentMixer?.restoreState) window.InstrumentMixer.restoreState();
      _applyCompactMode();

      if (osmd.Sheet && opensheetmusicdisplay.TransposeCalculator) {
          osmd.TransposeCalculator = new opensheetmusicdisplay.TransposeCalculator();
          osmd.Sheet.Transpose = transposeValue;
          osmd.updateGraphic();
      }

      refreshRules();
      await osmd.render();
      _titleCompacted = false;
      _compactTitleSVG();
      if (onReadyCallback) onReadyCallback(osmd);  // Gọi lại để ChordCanvas rebuild
      return osmd;
    } catch (err) {
      console.error('[OSMD] Lỗi reload:', err);
      throw err;
    }
  }

  /**
   * Thay đổi mức zoom (0.5 → 2.5)
   */
  async function setZoom(level) {
    currentZoom = Math.max(0.5, Math.min(2.5, level));
    if (osmd && isLoaded) {
      osmd.zoom = currentZoom;
      await osmd.render();
      // Không compact title lại sau zoom — title vị trí không đổi
      // Gọi onReadyCallback để ChordCanvas rebuild sau zoom
      if (onReadyCallback) onReadyCallback(osmd);
    }
  }

  /** Set zoom level mà không trigger render (dùng trước load()) */
  function setZoomSilent(level) {
    currentZoom = Math.max(0.5, Math.min(2.5, level));
    if (osmd) osmd.zoom = currentZoom;
  }


  function getCurrentZoom() { return currentZoom; }

  /**
   * Trả về instance OSMD để truy cập trực tiếp API nếu cần.
   */
  function getInstance() {
    return osmd;
  }

  function getIsLoaded() { return isLoaded; }

  function getCurrentXml() { return currentXmlString; }

  function onReady(cb) { onReadyCallback = cb; }

  function destroy() {
    if (osmd) {
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = '';
    }
    osmd = null;
    isLoaded = false;
    currentXmlString = null;
  }

  function _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /**
   * Tinh chỉnh title SVG sau render — ẩn title bị duplicate, style đẹp hơn.
   * XML Finale xuất ra: <movement-title> + <credit-words> cùng nội dung → OSMD vẽ chồng.
   */
  function _compactTitleSVG() {
    if (_titleCompacted) return;
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Lấy tất cả text elements, bỏ chord symbols
    const texts = Array.from(svg.querySelectorAll('text')).filter(t => {
      const ff = t.getAttribute('font-family') || '';
      return !ff.includes('OSMDChordFont');
    });
    if (!texts.length) { _titleCompacted = true; return; }

    // --- Tìm title text (lớn nhất) ---
    let maxSize = 0;
    let titleEl = null;
    texts.forEach(t => {
      const fs = parseFloat(t.getAttribute('font-size') || '0');
      if (fs > maxSize) { maxSize = fs; titleEl = t; }
    });

    if (titleEl) {
      // 1. Style title đẹp hơn
      titleEl.setAttribute('class', (titleEl.getAttribute('class') || '') + ' osmd-title-text');

      // 2. Convert ALL CAPS → Title Case cho dễ đọc
      const tspan = titleEl.querySelector('tspan');
      if (tspan) {
        const raw = tspan.textContent.trim();
        if (raw === raw.toUpperCase() && raw.length > 2 && !/^\d+$/.test(raw)) {
          tspan.textContent = raw.split(' ').map(w =>
            w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
          ).join(' ');
        }
      }

      // 3. Tìm và ẩn các text TRÙNG NỘI DUNG với title (duplicate từ movement-title + credit)
      const titleContent = (titleEl.querySelector('tspan') || titleEl).textContent.trim().toLowerCase();
      texts.forEach(t => {
        if (t === titleEl) return;
        const content = t.textContent.trim().toLowerCase();
        const fs = parseFloat(t.getAttribute('font-size') || '0');
        // Ẩn nếu trùng nội dung & nhỏ hơn title
        if (content === titleContent && fs < maxSize) {
          t.style.display = 'none';
        }
      });
    }

    // 4. Ẩn các rect nhỏ trong header (nếu OSMD vẽ enclosure/box xung quanh credit)
    const svgY = parseFloat(svg.getAttribute('viewBox')?.split(' ')[1] || '0');
    svg.querySelectorAll('rect').forEach(rect => {
      const height = parseFloat(rect.getAttribute('height') || '999');
      const fill   = rect.getAttribute('fill') || '';
      const stroke = rect.getAttribute('stroke') || '';
      // Rect nhỏ (< 40px) có stroke = enclosure box xấu → ẩn
      if (height < 40 && stroke && stroke !== 'none' && fill === 'none') {
        rect.style.display = 'none';
      }
    });

    _titleCompacted = true;
  }

  function setCompactMode(val) {

      _isCompactMode = !!val;
      if (isLoaded && osmd && currentXmlString) {
          reload(currentXmlString);
      }
  }

  function getCompactMode() { return _isCompactMode; }

  /**
   * FIX #4: Ẩn chữ "Điệp Khúc", Coda, D.C., Fine... trong SVG khi compact mode bật.
   * Các text này xuất phát từ <rehearsal> hoặc <direction><words> trong MusicXML.
   */
  function _hideRepeatLabels(hide) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const REPEAT_PATTERN = /^(đi[eệ]p\s*kh[úu]c|coda|d\.?c\.?|da\s*capo|fine|segno|d\.?s\.?|chorus|refrain)/i;

    svg.querySelectorAll('text').forEach(t => {
      const txt = t.textContent.trim();
      if (REPEAT_PATTERN.test(txt)) {
        t.style.display = hide ? 'none' : '';
      }
    });
  }

  function _applyCompactMode() {
      if (!osmd || !osmd.sheet) return;
      
      let compactPrefs = { hideBass: true, hideVoices: true, hideText: true };
      if (window.DisplaySettings) compactPrefs = DisplaySettings.getCompactPrefs();
      
      // Nếu không bật Gọn nhẹ thì bật lại Text
      if (!_isCompactMode) {
          osmd.setOptions({
              drawComposer: true,
              drawCredits: true,
              drawSubtitle: true,
              drawLyricist: true
          });
          return;
      }

      // KHI ĐANG BẬT GỌN NHẸ -> Đọc cấu hình
      osmd.sheet.Instruments.forEach((ins, insIndex) => {
          if (ins.Staves) {
              if (compactPrefs.hideBass) {
                  if (ins.Staves.length >= 2) {
                      for (let i = 1; i < ins.Staves.length; i++) {
                          ins.Staves[i].Visible = false;
                      }
                  }
                  if (insIndex > 0) {
                      ins.Visible = false; 
                      ins.Staves.forEach(st => st.Visible = false);
                  }
              }
              
              if (compactPrefs.hideVoices && insIndex === 0) {
                  if (ins.Voices) {
                      ins.Voices.forEach(voice => {
                          if (voice.VoiceId > 1) {
                              voice.Visible = false;
                          }
                      });
                  }
              }
          }
      });

      // Ẩn văn bản theo cấu hình
      if (compactPrefs.hideText) {
          osmd.setOptions({
              drawComposer: false,
              drawCredits: false,
              drawSubtitle: false,
              drawLyricist: false
          });
      } else {
          osmd.setOptions({
              drawComposer: true,
              drawCredits: true,
              drawSubtitle: true,
              drawLyricist: true
          });
      }

      // Title Option
      if (compactPrefs.hideTitle) {
          osmd.setOptions({ drawTitle: false });
      } else {
          osmd.setOptions({ drawTitle: true });
      }

      // FIX #4: Ẩn / hiện chữ Điệp Khúc/Coda sau khi OSMD render xong SVG
      setTimeout(() => _hideRepeatLabels(_isCompactMode), 400);
  }

  return { init, load, reload, setZoom, setZoomSilent, getInstance, getIsLoaded, getCurrentXml, getCurrentZoom, onReady, destroy, setCompactMode, getCompactMode, refreshRules };
})();

window.OSMDRenderer = OSMDRenderer;
