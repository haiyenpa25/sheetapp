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

  /* ─── Apply voice mode (mute/unmute từng Part) ─── */
  function applyPlaybackMode() {
    if (!_player || !_osmd) return;
    const mode = _currentVoice;

    const instruments = _player.scoreInstruments || _player.instruments || [];

    for (let i = 0; i < instruments.length; i++) {
      let muted = false;

      if (mode !== 'satb') {
        if (instruments.length >= 4) {
          // 4-Part XML: Part 0=S, 1=A, 2=T, 3=B
          if (mode === 'soprano' && i !== 0) muted = true;
          if (mode === 'alto'    && i !== 1) muted = true;
          if (mode === 'tenor'   && i !== 2) muted = true;
          if (mode === 'bass'    && i !== 3) muted = true;
        } else {
          // 2-Part XML (phổ biến): Part 0=Treble(S+A), Part 1=Bass(T+B)
          // S/A → chỉ phát Treble, T/B → chỉ phát Bass
          if ((mode === 'soprano' || mode === 'alto')  && i !== 0) muted = true;
          if ((mode === 'tenor'   || mode === 'bass')  && i !== 1) muted = true;
        }
      }

      const vol = muted ? 0 : 1;
      const inst = instruments[i];

      if      (typeof _player.setInstrumentVolume === 'function')
        _player.setInstrumentVolume(inst.id ?? inst.InstrumentId ?? i, vol);
      else if (typeof _player.setVolume === 'function')
        _player.setVolume(inst.id ?? i, vol);

      // Fallback trực tiếp lên object
      if (typeof inst === 'object') {
        inst.volume = vol;
        if (inst.mute !== undefined) inst.mute = muted;
      }
    }
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
