/**
 * audio-player.js — Hệ thống phát audio SATB 5 chế độ
 * Soprano (S) · Alto (A) · Tenor (T) · Bass (B) · Hòa âm (♪)
 *
 * Mỗi bè có màu riêng, click để bật/tắt — chỉ 1 chế độ active tại một thời điểm.
 */
const SheetAudioPlayer = (() => {
  'use strict';

  let _player      = null;
  let _isPlaying   = false;
  let _osmd        = null;
  let _currentVoice = 'satb'; // 'soprano' | 'alto' | 'tenor' | 'bass' | 'satb'

  /* ─── Voice labels ─── */
  const VOICE_LABELS = {
    soprano : 'Soprano (Nữ Cao)',
    alto    : 'Alto (Nữ Trầm)',
    tenor   : 'Tenor (Nam Cao)',
    bass    : 'Bass (Nam Trầm)',
    satb    : 'Hòa âm 4 bè',
  };

  /* ─── Init ─── */
  function init() {
    document.getElementById('btn-play-audio')?.addEventListener('click', play);
    document.getElementById('btn-stop-audio')?.addEventListener('click', stop);

    document.getElementById('audio-speed')?.addEventListener('change', e =>
      setSpeed(parseFloat(e.target.value))
    );

    // Voice buttons — event delegation trên toolbar
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

  /* ─── Set active voice ─── */
  function _setVoice(voice) {
    _currentVoice = voice;

    // Cập nhật active class trên từng nút
    document.querySelectorAll('.voice-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.voice === voice);
    });

    // Sync hidden select (backward compat)
    const sel = document.getElementById('audio-playback-mode');
    if (sel) sel.value = voice;
  }

  /* ─── Setup (gọi sau khi OSMD render) ─── */
  function setup(osmd) {
    _osmd = osmd;
    if (typeof OsmdAudioPlayer === 'undefined') {
      console.warn('[Audio] OsmdAudioPlayer chưa được load!');
    }
  }

  /* ─── Play ─── */
  async function play() {
    if (!_osmd) return;
    try {
      if (!_player) {
        await window.Tone?.start?.();
        _player = new OsmdAudioPlayer();
      }
      window.App?.showToast?.('🎵 Đang nạp âm thanh...', 'info');

      await _player.loadScore(_osmd);
      applyPlaybackMode();

      // Auto-scroll theo cursor
      _player.on('iteration', notes => {
        if (!notes?.length) return;
        if (_osmd.cursor?.cursorElement) {
          const cRect = _osmd.cursor.cursorElement.getBoundingClientRect();
          const wrapper = document.querySelector('.sheet-viewer-wrapper');
          if (!wrapper) return;
          const vRect = wrapper.getBoundingClientRect();
          if (cRect.bottom > vRect.bottom - 50)
            wrapper.scrollBy({ top: cRect.height * 2, behavior: 'smooth' });
          else if (cRect.top < vRect.top)
            wrapper.scrollBy({ top: -cRect.height * 2, behavior: 'smooth' });
        }
      });

      _player.play();
      _isPlaying = true;

      document.getElementById('btn-play-audio')?.classList.add('hidden');
      document.getElementById('btn-stop-audio')?.classList.remove('hidden');

      const label = VOICE_LABELS[_currentVoice] || _currentVoice;
      window.App?.showToast?.(`▶ Đang phát — ${label}`, 'success');

    } catch(err) {
      window.App?.showToast?.('Không thể phát audio (trình duyệt chặn hoặc bản nhạc quá phức tạp)', 'error');
      console.error('[Audio]', err);
      stop();
    }
  }

  /* ─── Stop ─── */
  function stop() {
    if (_player && _isPlaying) {
      // Restore schedule gốc nếu đang bị patch
      if (_origSchedule && _player.instrumentPlayer) {
        _player.instrumentPlayer.schedule = _origSchedule;
        _origSchedule = null;
      }
      _player.stop();
      _isPlaying = false;
      if (_osmd?.cursor) {
        _osmd.cursor.hide();
        _osmd.cursor.reset();
      }
    }
    document.getElementById('btn-play-audio')?.classList.remove('hidden');
    document.getElementById('btn-stop-audio')?.classList.add('hidden');
  }

  /* ─── Speed ─── */
  function setSpeed(rate) {
    if (!_player) return;
    if (typeof _player.setPlaybackRate === 'function') _player.setPlaybackRate(rate);
    else if (_player.playbackRate !== undefined)        _player.playbackRate = rate;
  }

  /* ─── Pitch ranges cho từng bè (SATB, halfTone tuyệt đối) ───
   *
   * XML này là piano-style: S+A cùng Part/Voice (P1), T+B cùng Part/Voice (P2)
   * → Không thể tách bằng VoiceId
   * → Tách bằng PITCH RANGE (halfTone từ C0=0):
   *
   *   Soprano: G4(67)  → C6(84)   stem=down trong P1
   *   Alto:    C4(60)  → F#4(66)  stem=up   trong P1
   *   Tenor:   G2(43)  → B4(71)   stem=down trong P2 (nốt trên)
   *   Bass:    C2(36)  → F3(53)   stem=down trong P2 (nốt dưới)
   *
   * Thực tế XML bài này:
   *   P1 notes: G4(67),D5(74) = Soprano; D4(62),B4(71) = Alto
   *   P2 notes: G3(55),B3(59) = Tenor;   B2(47),G2(43) = Bass
   *
   * Cutoff đơn giản: P1 midpoint ≈ 67 (G4), P2 midpoint ≈ 55 (G3)
   * ─────────────────────────────────────────────────────────── */

  let _origSchedule = null;  // lưu schedule gốc để restore

  function _halfTone(midiNote) { return midiNote; } // halfTone = midi note number

  function _shouldPlay(halfTone, partIndex, mode) {
    if (mode === 'satb') return true;
    // P1 (partIndex=0, Treble): note >= 67 → Soprano, < 67 → Alto
    // P2 (partIndex=1, Bass):   note >= 55 → Tenor,   < 55 → Bass
    if (partIndex === 0) {
      if (mode === 'soprano') return halfTone >= 67;
      if (mode === 'alto')    return halfTone < 67;
      return false; // tenor/bass từ P1 không cần
    }
    if (partIndex === 1) {
      if (mode === 'tenor') return halfTone >= 53;
      if (mode === 'bass')  return halfTone < 53;
      return false;
    }
    return true;
  }

  function applyPlaybackMode() {
    if (!_player || !_osmd) return;
    const mode = _currentVoice;
    const instrPlayer = _player.instrumentPlayer;
    if (!instrPlayer) return;

    // Restore schedule gốc trước
    if (_origSchedule) {
      instrPlayer.schedule = _origSchedule;
      _origSchedule = null;
    }

    if (mode === 'satb') return; // không filter gì

    // Xác định midiId của P1 và P2 từ sheet
    const instruments = _player.sheet?.Instruments;
    const p1MidiId = instruments?.[0]?.MidiInstrumentId ?? 0;
    const p2MidiId = instruments?.[1]?.MidiInstrumentId ?? 0;

    console.log(`[Audio] Filter mode="${mode}" P1_midiId=${p1MidiId} P2_midiId=${p2MidiId}`);

    // Monkey-patch schedule để lọc notes theo pitch range
    _origSchedule = instrPlayer.schedule.bind(instrPlayer);
    instrPlayer.schedule = function(midiId, time, notes) {
      // Xác định Part từ midiId
      let partIndex = -1;
      if (midiId === p1MidiId) partIndex = 0;
      else if (midiId === p2MidiId) partIndex = 1;

      // Nếu S hoặc A: chỉ giữ P1 notes; nếu T hoặc B: chỉ giữ P2 notes
      if (mode === 'soprano' || mode === 'alto') {
        if (partIndex !== 0) return; // drop P2 hoàn toàn
      } else { // tenor, bass
        if (partIndex !== 1) return; // drop P1 hoàn toàn
      }

      // Filter notes theo pitch range trong cùng Part
      const filtered = notes.filter(n => {
        const ht = (n.note ?? n.halfTone ?? 60) + 12; // osmd halfTone offset +12
        return _shouldPlay(ht, partIndex, mode);
      });

      if (filtered.length > 0) {
        _origSchedule(midiId, time, filtered);
      }
    };
  }

  /* ─── Enable / Disable controls ─── */
  function enableBtn(enabled) {
    const btn = document.getElementById('btn-play-audio');
    const spd = document.getElementById('audio-speed');
    if (btn) btn.disabled = !enabled;
    if (spd) spd.disabled = !enabled;

    // Voice buttons
    document.querySelectorAll('.voice-btn').forEach(b => { b.disabled = !enabled; });

    if (!enabled) {
      stop();
      _setVoice('satb'); // reset về SATB khi không có bài
    }
  }

  return { init, setup, enableBtn, stop, setSpeed };
})();

window.SheetAudioPlayer = SheetAudioPlayer;
