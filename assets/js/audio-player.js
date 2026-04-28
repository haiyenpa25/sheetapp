/**
 * audio-player.js — Hệ thống phát audio SATB 5 chế độ
 * Soprano (S) · Alto (A) · Tenor (T) · Bass (B) · Hòa âm (♪)
 *
 * ══════════════════════════════════════════════════════════════
 * FIX iOS/iPad/Mobile:
 *   • iOS Safari yêu cầu AudioContext.resume() từ user gesture
 *   • Tone.start() phải được await xong TRƯỚC khi tạo OsmdAudioPlayer
 *   • Volume mặc định cao hơn (+18 dB) để đủ nghe trên mobile
 *   • Unlock AudioContext sớm ngay khi user tap lần đầu bất kỳ đâu
 *
 * NGUYÊN LÝ FILTER BÈ (Pitch-Rank):
 *   sorted ascending → [Bass, Tenor, Alto, Soprano]
 * ══════════════════════════════════════════════════════════════
 */

const SheetAudioPlayer = (() => {
  'use strict';

  /* ── State ── */
  let _player       = null;
  let _isPlaying    = false;
  let _osmd         = null;
  let _currentVoice = 'satb';
  let _origSchedule = null;
  let _volumeDb     = 18;     // +18 dB mặc định — đủ nghe trên mobile/iPad
  let _audioUnlocked = false; // Đã unlock AudioContext chưa

  const TREBLE_THRESHOLD = 64; // E4 — phân biệt Treble vs Bass

  const VOICE_LABELS = {
    soprano : 'Soprano (Nữ Cao)',
    alto    : 'Alto (Nữ Trầm)',
    tenor   : 'Tenor (Nam Cao)',
    bass    : 'Bass (Nam Trầm)',
    satb    : 'Hòa âm 4 bè',
  };

  /* ══════════════════════════════════════
   *  iOS AudioContext Unlock
   *  Gọi sớm ngay khi user tap bất kỳ đâu
   * ══════════════════════════════════════ */
  function _unlockAudioContext() {
    if (_audioUnlocked) return;

    const unlock = async () => {
      if (_audioUnlocked) return;
      try {
        // Tone.js tạo AudioContext nội bộ — cần start từ trong user gesture
        if (window.Tone) {
          await Tone.start();
          // Resume AudioContext nếu bị suspended (iOS đặc biệt cần)
          if (Tone.context?.state === 'suspended') {
            await Tone.context.resume();
          }
        }

        // Cũng resume bất kỳ AudioContext nào khác đang suspended
        if (window.AudioContext || window.webkitAudioContext) {
          const AC = window.AudioContext || window.webkitAudioContext;
          // OsmdAudioPlayer có thể tạo context riêng
          if (window._osmdAC && _osmdAC.state === 'suspended') {
            await _osmdAC.resume();
          }
        }

        _audioUnlocked = true;
        console.log('[Audio] ✅ AudioContext unlocked');
      } catch (e) {
        console.warn('[Audio] Unlock failed:', e);
      }
    };

    // Lắng nghe mọi gesture của user để unlock
    ['touchstart', 'touchend', 'mousedown', 'pointerdown', 'keydown'].forEach(evt => {
      document.addEventListener(evt, unlock, { once: false, passive: true });
    });
  }

  /* ══════════════════════════════════════
   *  MIDI pitch helper
   * ══════════════════════════════════════ */
  function _getMidi(n) {
    return (typeof n.halfTone === 'number') ? n.halfTone
         : (typeof n.note    === 'number') ? n.note
         : 60;
  }

  /* ══════════════════════════════════════
   *  Pitch-Rank filter
   * ══════════════════════════════════════ */
  function _pickByVoice(notes, mode) {
    if (!notes || notes.length === 0) return [];
    const s = [...notes].sort((a, b) => _getMidi(a) - _getMidi(b));
    const n = s.length;

    if (n === 1) return s;

    if (n === 2) {
      const maxMidi  = _getMidi(s[1]);
      const isTreble = maxMidi >= TREBLE_THRESHOLD;
      if (isTreble) {
        if (mode === 'soprano') return [s[1]];
        if (mode === 'alto')    return [s[0]];
        return [];
      } else {
        if (mode === 'tenor') return [s[1]];
        if (mode === 'bass')  return [s[0]];
        return [];
      }
    }

    switch (mode) {
      case 'bass':    return [s[0]];
      case 'tenor':   return [s[Math.min(1, n - 1)]];
      case 'alto':    return [s[Math.max(n - 2, 0)]];
      case 'soprano': return [s[n - 1]];
      default:        return notes;
    }
  }

  /* ══════════════════════════════════════
   *  applyPlaybackMode
   * ══════════════════════════════════════ */
  function applyPlaybackMode() {
    if (!_player || !_osmd) return;
    const instrPlayer = _player.instrumentPlayer;
    if (!instrPlayer) return;

    _restoreSchedule(instrPlayer);
    const mode = _currentVoice;
    if (mode === 'satb') return;

    _origSchedule = instrPlayer.schedule.bind(instrPlayer);
    instrPlayer.schedule = function satbSchedule(midiId, time, notes) {
      const filtered = _pickByVoice(notes, mode);
      if (filtered.length > 0) _origSchedule(midiId, time, filtered);
    };
  }

  function _restoreSchedule(instrPlayer) {
    if (_origSchedule && instrPlayer) {
      instrPlayer.schedule = _origSchedule;
      _origSchedule = null;
    }
  }

  /* ══════════════════════════════════════
   *  Volume
   * ══════════════════════════════════════ */
  function setVolume(db) {
    _volumeDb = db;
    _applyVolume();
  }

  function _applyVolume() {
    if (!window.Tone?.Destination) return;
    Tone.Destination.volume.value = _volumeDb;
    console.log(`[Audio] Volume = ${_volumeDb} dB`);
  }

  /* ══════════════════════════════════════
   *  Public API
   * ══════════════════════════════════════ */
  function init() {
    // Unlock AudioContext sớm — iOS cần được "kích hoạt" từ gesture đầu tiên
    _unlockAudioContext();

    document.getElementById('btn-play-audio')?.addEventListener('click', play);
    document.getElementById('btn-stop-audio')?.addEventListener('click', stop);

    document.getElementById('audio-speed')?.addEventListener('change', e =>
      setSpeed(parseFloat(e.target.value))
    );

    document.getElementById('audio-volume')?.addEventListener('input', e => {
      setVolume(parseFloat(e.target.value));
    });

    document.addEventListener('click', e => {
      const btn = e.target.closest('.voice-btn');
      if (!btn || btn.disabled) return;
      const voice = btn.dataset.voice;
      if (voice && voice !== _currentVoice) {
        _setVoice(voice);
        if (_isPlaying) applyPlaybackMode();
      }
    });
  }

  function setup(osmd) {
    _osmd = osmd;
    if (_player && _isPlaying) stop();
    _player = null;
    if (typeof OsmdAudioPlayer === 'undefined') {
      console.warn('[Audio] OsmdAudioPlayer chưa load.');
    }
  }

  async function play() {
    if (!_osmd) return;
    try {
      // ── Bước 1: Unlock AudioContext (QUAN TRỌNG trên iOS) ──
      // Phải await Tone.start() TRONG user gesture (click event)
      if (window.Tone) {
        await Tone.start();
        // iOS đặc biệt: resume() nếu context bị suspended sau khi start()
        if (Tone.context?.state === 'suspended') {
          await Tone.context.resume();
        }
        // Chờ context chuyển sang 'running'
        if (Tone.context?.state !== 'running') {
          await new Promise(resolve => {
            const check = () => {
              if (Tone.context.state === 'running') resolve();
              else setTimeout(check, 100);
            };
            check();
          });
        }
      }

      // ── Bước 2: Áp dụng volume (sau khi context ready) ──
      _applyVolume();
      _audioUnlocked = true;

      // ── Bước 3: Tạo player và load ──
      if (!_player) {
        _player = new OsmdAudioPlayer();
      }

      window.App?.showToast?.('🎵 Đang nạp âm thanh…', 'info');
      await _player.loadScore(_osmd);
      applyPlaybackMode();

      // ── Bước 4: Tái áp dụng volume SAU khi load (iOS reset gain) ──
      _applyVolume();

      /* Auto-scroll theo cursor */
      _player.on('iteration', () => {
        const cursorEl = _osmd.cursor?.cursorElement;
        if (!cursorEl) return;
        const wrapper = document.querySelector('.sheet-viewer-wrapper');
        if (!wrapper) return;
        const cRect = cursorEl.getBoundingClientRect();
        const vRect = wrapper.getBoundingClientRect();
        if      (cRect.bottom > vRect.bottom - 50) wrapper.scrollBy({ top:  cRect.height * 2, behavior: 'smooth' });
        else if (cRect.top    < vRect.top)          wrapper.scrollBy({ top: -cRect.height * 2, behavior: 'smooth' });
      });

      _player.play();
      _isPlaying = true;

      document.getElementById('btn-play-audio')?.classList.add('hidden');
      document.getElementById('btn-stop-audio')?.classList.remove('hidden');
      window.App?.showToast?.(`▶ Đang phát — ${VOICE_LABELS[_currentVoice] ?? _currentVoice}`, 'success');

    } catch (err) {
      // Thông báo lỗi thân thiện hơn cho mobile
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const msg = isIOS
        ? 'Không phát được trên iOS — thử bỏ chế độ Im Lặng (nút bên cạnh iPhone/iPad)'
        : 'Không thể phát audio (trình duyệt chặn hoặc bản nhạc quá phức tạp)';
      window.App?.showToast?.(msg, 'error');
      console.error('[Audio]', err);
      stop();
    }
  }

  function stop() {
    if (_player) {
      if (_player.instrumentPlayer) _restoreSchedule(_player.instrumentPlayer);
      if (_isPlaying) _player.stop();
    }
    _isPlaying = false;

    if (_osmd?.cursor) {
      _osmd.cursor.hide();
      _osmd.cursor.reset();
    }

    document.getElementById('btn-play-audio')?.classList.remove('hidden');
    document.getElementById('btn-stop-audio')?.classList.add('hidden');
  }

  function setSpeed(rate) {
    if (!_player) return;
    if (typeof _player.setPlaybackRate === 'function') _player.setPlaybackRate(rate);
    else if (_player.playbackRate !== undefined)        _player.playbackRate = rate;
  }

  function enableBtn(enabled) {
    const btn = document.getElementById('btn-play-audio');
    const spd = document.getElementById('audio-speed');
    const vol = document.getElementById('audio-volume');
    if (btn) btn.disabled = !enabled;
    if (spd) spd.disabled = !enabled;
    if (vol) vol.disabled = !enabled;
    document.querySelectorAll('.voice-btn').forEach(b => { b.disabled = !enabled; });
    if (!enabled) {
      stop();
      _setVoice('satb');
    }
  }

  function _setVoice(voice) {
    _currentVoice = voice;
    document.querySelectorAll('.voice-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.voice === voice);
    });
    const sel = document.getElementById('audio-playback-mode');
    if (sel) sel.value = voice;
  }

  return { init, setup, enableBtn, stop, setSpeed, setVolume, applyPlaybackMode };

})();

window.SheetAudioPlayer = SheetAudioPlayer;
