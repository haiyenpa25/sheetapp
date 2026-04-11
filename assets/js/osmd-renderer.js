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
        osmd.rules.DefaultColorChordSymbol = '#dc2626';     // Đỏ đậm nổi bật
        osmd.rules.ChordSymbolTextHeight = 3.0;             // Tăng kích thước (Gốc: 2.2)
        osmd.rules.ChordSymbolYOffset = 1.5;
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
        osmd.rules.DefaultColorChordSymbol = '#dc2626';
        osmd.rules.ChordSymbolTextHeight = 3.0;
        osmd.rules.ChordSymbolYOffset = 1.5;
    }
  }

  /**
   * Nạp XML string vào OSMD và render.
   * @param {string} xmlString - Nội dung MusicXML
   */
  async function load(xmlString) {
    if (!osmd) throw new Error('OSMD chưa được khởi tạo. Gọi init() trước.');
    currentXmlString = xmlString;
    isLoaded = false;

    try {
      await osmd.load(xmlString);
      osmd.zoom = currentZoom;
      _applyCompactMode();
      refreshRules();
      await osmd.render();
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
   */
  async function reload(xmlString) {
    if (!osmd) throw new Error('OSMD chưa init');
    currentXmlString = xmlString;
    try {
      await osmd.load(xmlString);
      osmd.zoom = currentZoom;
      if (window.InstrumentMixer?.restoreState) window.InstrumentMixer.restoreState();
      _applyCompactMode();
      refreshRules();
      await osmd.render();
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
      
      // Nếu không bật Gọn nhẹ thì giữ nguyên gốc (hoặc Mixers đã xử lý)
      if (!_isCompactMode) {
          osmd.setOptions({
              drawComposer: true,
              drawCredits: true,
              drawSubtitle: true,
              drawLyricist: true
          });
          return;
      }

      // KHI ĐANG BẬT GỌN NHẸ -> Chém Khóa Fa
      osmd.sheet.Instruments.forEach((ins, insIndex) => {
          if (ins.Staves) {
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
      });

      // Ẩn văn bản thừa
      osmd.setOptions({
          drawComposer: false,
          drawCredits: false,
          drawSubtitle: false,
          drawLyricist: false
      });
  }

  return { init, load, reload, setZoom, getInstance, getIsLoaded, getCurrentXml, getCurrentZoom, onReady, destroy, setCompactMode, getCompactMode };
})();

window.OSMDRenderer = OSMDRenderer;
