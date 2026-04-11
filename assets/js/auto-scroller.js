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
    const osmd = window.OSMDRenderer?.getInstance?.();
    if (!wrapper || !osmd) return;

    if (window.SheetAudioPlayer) window.SheetAudioPlayer.stop();

    _isScrolling = true;
    _updateUI();
    
    // Khởi tạo Cursor Metronome
    osmd.cursor.show();
    osmd.cursor.reset();
    
    // Tìm BPM mặc định
    let currentBpm = 80; // mặc định nếu không parse được
    try {
        const iter = osmd.cursor.iterator;
        // Thử tìm BPM trong bản nhạc
        if (osmd.sheet && osmd.sheet.SourceMeasures[0]) {
           const meas = osmd.sheet.SourceMeasures[0];
           if (meas.staffLinkedExpressions && meas.staffLinkedExpressions.length > 0) {
               const exps = meas.staffLinkedExpressions[0][0]?.TempoExpressions;
               if (exps && exps.length > 0) currentBpm = exps[0].InstantaneousTempo.TempoInBpm;
           }
        }
    } catch(e) {}
    
    const msPerWholeNote = (60000 / currentBpm) * 4;
    let timeAccumulator = 0;
    let lastTime = performance.now();
    let currentDurationReal = _getDuration(osmd.cursor.iterator);

    function loop(time) {
      if (!_isScrolling) return;
      
      const dt = time - lastTime;
      lastTime = time;
      
      const timeToWaitMs = (currentDurationReal * msPerWholeNote) / _speedMultiplier;
      
      timeAccumulator += dt;
      
      if (timeAccumulator >= timeToWaitMs) {
          timeAccumulator -= timeToWaitMs; // Trừ phần đã chờ
          
          osmd.cursor.next();
          
          if (osmd.cursor.iterator.EndReached || osmd.cursor.isHidden) {
              stop();
              return;
          }
          
          currentDurationReal = _getDuration(osmd.cursor.iterator);
          
          // ==== Scroll Smart Camera ====
          if (osmd.cursor.cursorElement) {
              const cRect = osmd.cursor.cursorElement.getBoundingClientRect();
              const viewRect = wrapper.getBoundingClientRect();
              
              // Target = 1/3 màn hình từ trên xuống
              const targetY = viewRect.top + (viewRect.height * 0.35);
              
              const diffY = cRect.top - targetY;
              // Nếu đang bị lệch hơn 30px, cuộn máy quay theo
              if (Math.abs(diffY) > 30) {
                  wrapper.scrollBy({ top: diffY, behavior: 'smooth' });
              }
          }
      }
      
      _rAF = requestAnimationFrame(loop);
    }
    
    _rAF = requestAnimationFrame(loop);
  }

  function _getDuration(iter) {
     let minLen = 999;
     if (iter.CurrentVoiceEntries) {
         for (const ve of iter.CurrentVoiceEntries) {
             if (ve.Notes && ve.Notes[0] && ve.Notes[0].Length) {
                 const l = ve.Notes[0].Length.RealValue;
                 if (l < minLen) minLen = l;
             }
         }
     }
     return minLen === 999 ? 0.25 : minLen;
  }

  function stop() {
    _isScrolling = false;
    if (_rAF) cancelAnimationFrame(_rAF);
    _rAF = null;
    
    // Ẩn Cursor khi tắt
    const osmd = window.OSMDRenderer?.getInstance?.();
    if (osmd && osmd.cursor) osmd.cursor.hide();
    
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
