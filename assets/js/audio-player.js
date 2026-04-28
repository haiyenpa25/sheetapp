/**
 * audio-player.js — Hệ thống phát audio SATB 5 chế độ
 * Soprano (S) · Alto (A) · Tenor (T) · Bass (B) · Hòa âm (♪)
 *
 * ══════════════════════════════════════════════════════════════
 * NGUYÊN LÝ FILTER BÈ (Pitch-Rank):
 *
 *  OSMD AudioPlayer gọi schedule(midiId, time, notes) với notes là
 *  TẤT CẢ các nốt vang cùng lúc — có thể là 2, 3, hoặc 4 nốt.
 *
 *  Trong nhạc SATB chuẩn, thứ tự pitch LUÔN tương ứng với bè:
 *    sorted ascending → [Bass, Tenor, Alto, Soprano]
 *    sorted[0]   = Bass     (thấp nhất)
 *    sorted[1]   = Tenor    (thứ hai từ thấp)
 *    sorted[n-2] = Alto     (thứ hai từ cao)
 *    sorted[n-1] = Soprano  (cao nhất)
 *
 *  Cách này hoạt động đúng bất kể OSMD gọi schedule:
 *    • Một lần với tất cả 4 nốt (merged)
 *    • Hoặc riêng từng Part (2 nốt mỗi lần)
 * ══════════════════════════════════════════════════════════════
 */

const SheetAudioPlayer = (() => {
  'use strict';

  /* ── State ── */
  let _player       = null;
  let _isPlaying    = false;
  let _osmd         = null;
  let _currentVoice = 'satb'; // 'soprano' | 'alto' | 'tenor' | 'bass' | 'satb'
  let _origSchedule = null;   // backup để restore khi stop / đổi mode
  let _volumeDb     = 12;     // mức boost mặc định (dB, 0 = gốc, +12 ≈ 4× louder)

  /**
   * Ngưỡng phân biệt cặp nốt Treble (Soprano+Alto) vs Bass (Tenor+Bass)
   * khi schedule chỉ nhận 2 nốt (1 Part riêng).
   *
   * Từ XML bài này (G major SATB):
   *   P1 max note: luôn >= F#4(66) — Soprano cao nhất
   *   P2 max note: luôn <= D4(62)  — Tenor cao nhất khoá Fa
   *   → Khoảng trống 63-65 → threshold=64 an toàn cho mọi beat.
   */
  const TREBLE_THRESHOLD = 64; // E4

  /* ── Nhãn hiển thị ── */
  const VOICE_LABELS = {
    soprano : 'Soprano (Nữ Cao)',
    alto    : 'Alto (Nữ Trầm)',
    tenor   : 'Tenor (Nam Cao)',
    bass    : 'Bass (Nam Trầm)',
    satb    : 'Hòa âm 4 bè',
  };

  /* ══════════════════════════════════════
   *  MIDI pitch helper
   * ══════════════════════════════════════ */

  /**
   * Trích MIDI note number (C4=60) từ note object của OSMD AudioPlayer.
   * OSMD dùng `halfTone` = MIDI standard. Fallback `note` cho phiên bản cũ.
   */
  function _getMidi(n) {
    return (typeof n.halfTone === 'number') ? n.halfTone
         : (typeof n.note    === 'number') ? n.note
         : 60;
  }

  /* ══════════════════════════════════════
   *  Core filter — Pitch-Rank
   * ══════════════════════════════════════ */

  /**
   * Chọn note(s) cần phát từ danh sách notes vang cùng lúc.
   *
   * @param {object[]} notes - notes từ schedule callback (đã grouped theo time)
   * @param {string}   mode  - 'soprano' | 'alto' | 'tenor' | 'bass'
   * @returns {object[]}
   */
  function _pickByVoice(notes, mode) {
    if (!notes || notes.length === 0) return [];

    /* Sort ascending: thấp → cao */
    const s = [...notes].sort((a, b) => _getMidi(a) - _getMidi(b));
    const n = s.length;

    /* ── 1 nốt ── */
    if (n === 1) {
      /* Nốt đơn: không xác định bè → phát để không bị đứt quãng */
      return s;
    }

    /* ── 2 nốt ── */
    if (n === 2) {
      /*
       * OSMD có thể gọi riêng từng Part:
       *   Call với P1 (Treble): [Alto_note, Soprano_note]  → max >= TREBLE_THRESHOLD
       *   Call với P2 (Bass):   [Bass_note, Tenor_note]    → max <  TREBLE_THRESHOLD
       *
       * Dùng max pitch để xác định cặp này thuộc Part nào, rồi chọn đúng bè.
       */
      const maxMidi  = _getMidi(s[1]);
      const isTreble = maxMidi >= TREBLE_THRESHOLD;

      if (isTreble) {
        /* P1 (khoá Sol): s[0]=Alto, s[1]=Soprano */
        if (mode === 'soprano') return [s[1]];
        if (mode === 'alto')    return [s[0]];
        return []; /* Tenor/Bass không phát P1 */
      } else {
        /* P2 (khoá Fa): s[0]=Bass, s[1]=Tenor */
        if (mode === 'tenor') return [s[1]];
        if (mode === 'bass')  return [s[0]];
        return []; /* Soprano/Alto không phát P2 */
      }
    }

    /* ── 3-4 nốt (merged từ cả 2 Part) ── */
    /*
     * Thứ tự pitch rank trong SATB chuẩn:
     *   s[0]   = Bass     (thấp nhất)
     *   s[1]   = Tenor    (thứ hai)
     *   s[n-2] = Alto     (thứ hai từ trên)
     *   s[n-1] = Soprano  (cao nhất)
     */
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
    if (!instrPlayer) {
      console.warn('[Audio] instrumentPlayer không tồn tại.');
      return;
    }

    /* Luôn restore trước khi re-patch (tránh patch chồng) */
    _restoreSchedule(instrPlayer);

    const mode = _currentVoice;

    if (mode === 'satb') {
      console.log('[Audio] Mode=SATB — phát toàn bộ.');
      return;
    }

    console.log(`[Audio] Mode="${mode}" — áp dụng pitch-rank filter.`);
    _origSchedule = instrPlayer.schedule.bind(instrPlayer);

    instrPlayer.schedule = function satbSchedule(midiId, time, notes) {
      const filtered = _pickByVoice(notes, mode);
      if (filtered.length > 0) {
        _origSchedule(midiId, time, filtered);
      }
    };
  }

  function _restoreSchedule(instrPlayer) {
    if (_origSchedule && instrPlayer) {
      instrPlayer.schedule = _origSchedule;
      _origSchedule = null;
      console.log('[Audio] Schedule restored.');
    }
  }

  /* ══════════════════════════════════════
   *  Public API
   * ══════════════════════════════════════ */

  function init() {
    document.getElementById('btn-play-audio')?.addEventListener('click', play);
    document.getElementById('btn-stop-audio')?.addEventListener('click', stop);

    document.getElementById('audio-speed')?.addEventListener('change', e =>
      setSpeed(parseFloat(e.target.value))
    );

    /* Slider âm lượng (nếu có trong UI) */
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
      console.warn('[Audio] OsmdAudioPlayer chưa load — kiểm tra CDN.');
    }
  }

  async function play() {
    if (!_osmd) return;
    try {
      await window.Tone?.start?.();

      /* ── Boost master volume qua Tone.js Destination ── */
      _applyVolume();

      if (!_player) {
        _player = new OsmdAudioPlayer();
      }

      window.App?.showToast?.('🎵 Đang nạp âm thanh…', 'info');
      await _player.loadScore(_osmd);
      applyPlaybackMode();

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
      window.App?.showToast?.('Không thể phát audio (trình duyệt chặn hoặc bản nhạc quá phức tạp)', 'error');
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

  /**
   * Đặt âm lượng phát bằng cách điều chỉnh Tone.js master Destination.
   * @param {number} db - giá trị dB (-40 = gần im lặng, 0 = gốc, +20 = rất to)
   */
  function setVolume(db) {
    _volumeDb = db;
    _applyVolume();
  }

  function _applyVolume() {
    if (!window.Tone?.Destination) return;
    /* Tone.Destination.volume là AudioParam (dB) */
    Tone.Destination.volume.value = _volumeDb;
    console.log(`[Audio] Volume = ${_volumeDb} dB`);
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
      _setVoice('satb'); // Reset voice visual về SATB khi disable
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

  return { init, setup, enableBtn, stop, setSpeed, setVolume };

})();

window.SheetAudioPlayer = SheetAudioPlayer;
