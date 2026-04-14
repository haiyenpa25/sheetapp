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
        // Làm đẹp hợp âm (Chords)
        ChordSymbolFontFamily: "OSMDChordFont, sans-serif", // Marker font để thuật toán bề mặt nhận diện
        ChordSymbolTextHeight: 2.8,             // Kích thước chữ to hơn nữa
        ChordSymbolYOffset: 1.5,                // Đẩy lên cao để không đụng nốt nhạc
        DefaultColorChordSymbol: '#dc2626',     // Đổi sang màu đỏ đậm nổi bật
        // Các chỉnh sửa khác để sheet đẹp hơn
        StaffLineWidth: 0.1,
        StemWidth: 0.15,
        TupletNumberTextHeight: 1.5
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
          if (window.ChordCanvas) window.ChordCanvas.reposition();
          if (window.ChordOverlay) window.ChordOverlay.onOSMDRendered();
      }
    }, 200));
    resizeObserver.observe(container);

    return osmd;
  }

  /**
   * Cập nhật lại Engraving Rules trước khi render
   */
  function refreshRules() {
    if (osmd && osmd.rules) {
        let prefs = { size: 3.0, yOffset: 1.5, color: '#dc2626' };
        if (window.DisplaySettings) prefs = DisplaySettings.getChordPrefs();

        osmd.rules.DefaultColorChordSymbol = prefs.color;
        osmd.rules.ChordSymbolTextHeight = prefs.size;
        osmd.rules.ChordSymbolYOffset = prefs.yOffset;
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
      _compactTitleSVG();
      // Gọi onReadyCallback để ChordCanvas rebuild sau zoom
      if (onReadyCallback) onReadyCallback(osmd);
    }
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
   * Thu nhỏ title text trong OSMD SVG sau khi render.
   * OSMD thường render title với font-size lớn nhất (~18-24px tuỳ zoom).
   * Hàm này cap xuống tối đa MAX_TITLE_PX để tiết kiệm không gian dọc.
   */
  function _compactTitleSVG() {
    const MAX_TITLE_PX = 13; // px — giới hạn font-size title, tuỳ chỉnh ở đây
    const container = document.getElementById(containerId);
    if (!container) return;
    const svg = container.querySelector('svg');
    if (!svg) return;

    const texts = Array.from(svg.querySelectorAll('text'));
    if (!texts.length) return;

    // Tìm font-size lớn nhất trong SVG (là title)
    let maxSize = 0;
    texts.forEach(t => {
      // OSMD set bằng attribute, không qua CSS
      const fsAttr = t.getAttribute('font-size');
      if (fsAttr) {
        const fs = parseFloat(fsAttr);
        if (fs > maxSize) maxSize = fs;
      }
    });

    if (!maxSize || maxSize <= MAX_TITLE_PX) return; // Không cần thu nhỏ

    // Tìm và thu nhỏ các text có font-size >= 75% maxSize (title + subtitle)
    const threshold = maxSize * 0.75;
    texts.forEach(t => {
      const fsAttr = t.getAttribute('font-size');
      if (!fsAttr) return;
      const fs = parseFloat(fsAttr);
      if (fs >= threshold) {
        // Scale proportionally, không để dưới MIN (8px)
        const newSize = Math.max(8, Math.round(fs * (MAX_TITLE_PX / maxSize)));
        t.setAttribute('font-size', String(newSize));
      }
    });
  }

  function setCompactMode(val) {
      _isCompactMode = !!val;
      if (isLoaded && osmd && currentXmlString) {
          // Sử dụng reload() để OSMD ép tính toán lại layout và Rules từ đầu.
          reload(currentXmlString);
      }
  }

  function getCompactMode() { return _isCompactMode; }

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
  }

  return { init, load, reload, setZoom, getInstance, getIsLoaded, getCurrentXml, getCurrentZoom, onReady, destroy, setCompactMode, getCompactMode };
})();

window.OSMDRenderer = OSMDRenderer;
