/**
 * auto-scroller.js — Cuộn bản nhạc mượt mà giống hệ thống nhắc lời (Teleprompter)
 */
const AutoScroller = (() => {
  'use strict';

  let _rAF = null;
  let _isScrolling = false;
  let _speedMultiplier = 2; // Default (Chậm)
  
  // Base pixels per frame (60fps) -> 0.5px/frame ~ 30px/sec 
  const BASE_SPEED_PPF = 0.5; 

  function init() {
    const btn = document.getElementById('btn-auto-scroll');
    const select = document.getElementById('scroll-speed');

    btn?.addEventListener('click', toggle);
    select?.addEventListener('change', (e) => {
      _speedMultiplier = parseFloat(e.target.value);
    });
  }

  function toggle() {
    if (_isScrolling) stop();
    else play();
  }

  function play() {
    const wrapper = document.querySelector('.sheet-viewer-wrapper');
    if (!wrapper) return;

    // Ngăn chặn xung đột nếu AudioPlayer đang mở
    if (window.SheetAudioPlayer) window.SheetAudioPlayer.stop();

    _isScrolling = true;
    _updateUI();
    
    let lastTime = 0;
    function loop(time) {
      if (!_isScrolling) return;
      if (!lastTime) lastTime = time;
      
      // Calculate delta to keep speed steady despite frame drops
      const dt = time - lastTime;
      lastTime = time;

      // 16.6ms is standard 60fps frame time
      const frameRatio = dt / 16.66;
      
      const ppf = BASE_SPEED_PPF * _speedMultiplier * frameRatio;
      
      const maxScroll = wrapper.scrollHeight - wrapper.clientHeight;
      if (wrapper.scrollTop >= maxScroll - 1) {
        // Tự dừng khi hết bài
        stop();
        return;
      }

      wrapper.scrollTop += ppf;
      _rAF = requestAnimationFrame(loop);
    }
    
    _rAF = requestAnimationFrame(loop);
  }

  function stop() {
    _isScrolling = false;
    if (_rAF) cancelAnimationFrame(_rAF);
    _rAF = null;
    _updateUI();
  }

  function _updateUI() {
    const btn = document.getElementById('btn-auto-scroll');
    if (!btn) return;
    
    if (_isScrolling) {
      btn.classList.add('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><rect x="6" y="6" width="12" height="12"></rect></svg> Dừng Cuộn`;
      btn.style.color = 'var(--danger)';
    } else {
      btn.classList.remove('active');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;"><path d="M12 5v14M19 12l-7 7-7-7"/></svg> Cuộn`;
      btn.style.color = '';
    }
  }

  return { init, play, stop };
})();

window.AutoScroller = AutoScroller;
