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
        ChordSymbolTextHeight: 2.2,             // Kích thước chữ to hơn
        ChordSymbolYOffset: 1.5,                // Đẩy lên cao để không đụng nốt nhạc
        DefaultColorChordSymbol: '#8b5cf6',     // Đổi sang màu tím nổi bật (Violet 500)
        // Các chỉnh sửa khác để sheet đẹp hơn
        StaffLineWidth: 0.1,
        StemWidth: 0.15,
        TupletNumberTextHeight: 1.5
      },
      ...options
    });

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

  // Debounce utility
  function _debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  return { init, load, reload, setZoom, getInstance, getIsLoaded, getCurrentXml, getCurrentZoom, onReady, destroy };
})();

window.OSMDRenderer = OSMDRenderer;
