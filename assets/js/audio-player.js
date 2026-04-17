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
    
    document.getElementById('audio-playback-mode')?.addEventListener('change', () => {
      if (_isPlaying) {
        applyPlaybackMode();
      }
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
      
      // Apply Playback Mode Before Playing
      applyPlaybackMode();
      
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

  function applyPlaybackMode() {
    if (!_player || !_osmd) return;
    const mode = document.getElementById('audio-playback-mode')?.value || 'satb';
    
    const instruments = _player.scoreInstruments || _player.instruments || [];
    if (!instruments.length && _osmd.sheet.Instruments) {
       // fallback, sometimes it's mapped differently
    }

    // Logic tắt tiếng theo SATB:
    // Sheet thánh ca thường có 4 Parts (Soprano, Alto, Tenor, Bass) hoặc 2 Parts (Treble, Bass)
    for (let i = 0; i < instruments.length; i++) {
        let isMuted = false;
        
        if (mode !== 'satb') {
           if (instruments.length >= 4) {
               // 4 Parts
               if (mode === 'soprano' && i !== 0) isMuted = true;
               if (mode === 'alto' && i !== 1) isMuted = true;
               if (mode === 'tenor' && i !== 2) isMuted = true;
               if (mode === 'bass' && i !== 3) isMuted = true;
           } else {
               // 2 Parts or less (Piano style)
               if (mode === 'soprano' || mode === 'alto') {
                   if (i !== 0) isMuted = true; // Keep only Treble
               }
               if (mode === 'tenor' || mode === 'bass') {
                   if (i !== 1) isMuted = true; // Keep only Bass
               }
           }
        }
        
        // Áp dụng mute thông qua API khả dĩ của osmd-audio-player
        const vol = isMuted ? 0 : 1;
        const instrument = instruments[i];
        
        if (typeof _player.setInstrumentVolume === 'function') {
            _player.setInstrumentVolume(instrument.id || instrument.InstrumentId || i, vol);
        } else if (typeof _player.setVolume === 'function') {
            _player.setVolume(instrument.id || i, vol);
        }
        
        // Thử thay đổi trực tiếp qua object nếu các API trên không tồn tại
        if (typeof instrument === 'object') {
            instrument.volume = vol;
            if (instrument.mute !== undefined) instrument.mute = isMuted;
        }
    }
    
    if (mode !== 'satb') {
        window.App?.showToast?.(`Bật chế độ phát: ${mode.toUpperCase()}`, 'info');
    }
  }

  function enableBtn(enabled) {
    const btn = document.getElementById('btn-play-audio');
    const spd = document.getElementById('audio-speed');
    const mode = document.getElementById('audio-playback-mode');
    
    if (btn) btn.disabled = !enabled;
    if (spd) spd.disabled = !enabled;
    if (mode) mode.disabled = !enabled;
    
    if (!enabled) stop();
  }

  return { init, setup, enableBtn, stop, setSpeed };
})();

window.SheetAudioPlayer = SheetAudioPlayer;
