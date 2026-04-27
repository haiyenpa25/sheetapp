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

  /* ─── Apply voice mode — dùng đúng API Voice.Volume ─── */
  function applyPlaybackMode() {
    if (!_player || !_osmd) return;
    const mode = _currentVoice;

    // scoreInstruments = _player.sheet.Instruments (OSMD Instrument objects)
    // Mỗi Instrument có .Voices[] — mỗi Voice là S, A, T hoặc B
    // notePlaybackCallback đọc Voice.Volume làm gain → set 0 = im lặng
    const instruments = _player.sheet?.Instruments;
    if (!instruments?.length) {
      console.warn('[Audio] sheet.Instruments không khả dụng, thử fallback...');
      return;
    }

    // Phân tích cấu trúc: log để debug nếu cần
    console.log(`[Audio] Voice mode: ${mode}, Instruments: ${instruments.length}`);
    instruments.forEach((inst, ii) => {
      console.log(`  Inst[${ii}] "${inst.Name}" Voices: ${inst.Voices?.length}`);
      inst.Voices?.forEach((v, vi) => {
        console.log(`    Voice[${vi}] VoiceId=${v.VoiceId} midiId=${v.midiInstrumentId}`);
      });
    });

    if (mode === 'satb') {
      // Phát tất cả — restore Volume = 1
      instruments.forEach(inst =>
        inst.Voices?.forEach(v => { v.Volume = 1; })
      );
      return;
    }

    // SATB mapping theo cấu trúc XML:
    // ─ 2 Parts (phổ biến HTTLVN):
    //   Part 0 (Treble): Voice[0]=Soprano (VoiceId=1), Voice[1]=Alto (VoiceId=2)
    //   Part 1 (Bass):   Voice[0]=Tenor  (VoiceId=1), Voice[1]=Bass  (VoiceId=2)
    // ─ 4 Parts:
    //   Part 0=S, Part 1=A, Part 2=T, Part 3=B (mỗi Part chỉ có 1 Voice)

    const numParts = instruments.length;

    instruments.forEach((inst, pi) => {
      inst.Voices?.forEach((voice, vi) => {
        let audible = false;

        if (numParts >= 4) {
          // 4-Part: mỗi Part = 1 bè
          audible = (mode === 'soprano' && pi === 0)
                 || (mode === 'alto'    && pi === 1)
                 || (mode === 'tenor'   && pi === 2)
                 || (mode === 'bass'    && pi === 3);
        } else {
          // 2-Part: Part 0 = Treble (S+A), Part 1 = Bass (T+B)
          // VoiceId=1 → bè trên (S hoặc T), VoiceId=2 → bè dưới (A hoặc B)
          const voiceId = voice.VoiceId ?? (vi + 1);
          if (mode === 'soprano') audible = (pi === 0 && voiceId === 1);
          else if (mode === 'alto')    audible = (pi === 0 && voiceId === 2);
          else if (mode === 'tenor')   audible = (pi === 1 && voiceId === 1);
          else if (mode === 'bass')    audible = (pi === 1 && voiceId === 2);
        }

        voice.Volume = audible ? 1 : 0;
      });
    });
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
