/**
 * audio-player.js — Hệ thống phát audio và chạy con trỏ tự động (Karaoke)
 * Dựa trên thư viện Tone.js và osmd-audio-player
 */
const SheetAudioPlayer = (() => {
  'use strict';

  let _player = null;
  let _isPlaying = false;
  let _osmd = null;

  function init() {
    const btnPlay = document.getElementById('btn-play-audio');
    const btnStop = document.getElementById('btn-stop-audio');
    
    btnPlay?.addEventListener('click', play);
    btnStop?.addEventListener('click', stop);
    
    document.getElementById('audio-speed')?.addEventListener('change', (e) => {
      setSpeed(parseFloat(e.target.value));
    });
  }

  function setup(osmd) {
    _osmd = osmd;
    if (typeof OsmdAudioPlayer === 'undefined') {
      console.warn('OsmdAudioPlayer chưa được load!');
      return;
    }
    
    // Ngay lúc setup chưa khởi tạo Tone.js context để tránh lỗi AudioContext warning
    // _player = new OsmdAudioPlayer();
  }

  async function play() {
    if (!_osmd) return;
    
    try {
      if (!_player) {
         await window.Tone?.start?.();
         _player = new OsmdAudioPlayer();
      }
      window.App?.showToast?.('🎵 Đang nạp hệ thống âm thanh, vui lòng chờ...', 'info');
      
      // Load current score
      await _player.loadScore(_osmd);
      
      // Auto-scroll logic
      _player.on("iteration", notes => {
        if (!notes || notes.length === 0) return;
        if (_osmd.cursor && _osmd.cursor.cursorElement) {
          const cRect = _osmd.cursor.cursorElement.getBoundingClientRect();
          const viewRect = document.querySelector('.sheet-viewer-wrapper').getBoundingClientRect();
          const wrapper = document.querySelector('.sheet-viewer-wrapper');
          
          if (cRect.bottom > viewRect.bottom - 50) {
            wrapper.scrollBy({ top: cRect.height * 2, behavior: 'smooth' });
          } else if (cRect.top < viewRect.top) {
            wrapper.scrollBy({ top: -cRect.height * 2, behavior: 'smooth' });
          }
        }
      });

      _player.play();
      _isPlaying = true;
      
      document.getElementById('btn-play-audio')?.classList.add('hidden');
      document.getElementById('btn-stop-audio')?.classList.remove('hidden');
      window.App?.showToast?.('Đang phát nhạc...', 'success');
      
    } catch(err) {
      window.App?.showToast?.('Trình duyệt chặn khởi tạo Audio hoặc bản nhạc này quá phức tạp', 'error');
      console.error(err);
      stop();
    }
  }

  function stop() {
    if (_player && _isPlaying) {
      _player.stop();
      _isPlaying = false;
      
      if (_osmd && _osmd.cursor) {
        _osmd.cursor.hide();
        _osmd.cursor.reset();
      }
    }
    document.getElementById('btn-play-audio')?.classList.remove('hidden');
    document.getElementById('btn-stop-audio')?.classList.add('hidden');
  }

  function setSpeed(rate) {
    if (_player) {
      if (typeof _player.setPlaybackRate === 'function') {
        _player.setPlaybackRate(rate);
      } else if (_player.playbackRate !== undefined) {
        _player.playbackRate = rate;
      }
    }
  }

  function enableBtn(enabled) {
    const btn = document.getElementById('btn-play-audio');
    const spd = document.getElementById('audio-speed');
    if (btn) btn.disabled = !enabled;
    if (spd) spd.disabled = !enabled;
    if (!enabled) stop();
  }

  return { init, setup, enableBtn, stop, setSpeed };
})();

window.SheetAudioPlayer = SheetAudioPlayer;
