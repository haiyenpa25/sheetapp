/**
 * song-info-bar.js — Sprint A1
 * Strip thông tin bài nhạc: tông, nhịp, BPM, số nhịp
 * Hiển thị ngay khi load bài để user biết context ngay lập tức.
 */
const SongInfoBar = (() => {
  'use strict';

  let _songData = null;

  function init() {
    document.getElementById('btn-song-info-toggle')?.addEventListener('click', _toggle);
  }

  function loadSong(xmlString, song) {
    if (!xmlString) { clearSong(); return; }
    _songData = _parseXml(xmlString, song);
    _render(_songData);
    document.getElementById('song-info-strip')?.classList.remove('si-hidden');
  }

  function clearSong() {
    _songData = null;
    document.getElementById('song-info-strip')?.classList.add('si-hidden');
  }

  /* ─── Parse MusicXML ─────────────────────────────────────── */
  function _parseXml(xmlString, song) {
    const info = {
      number:       song?.httlvnId ? String(song.httlvnId).padStart(3, '0') : '',
      title:        song?.title || '',
      key:          '',
      mode:         '',
      timeBeats:    '',
      timeBeatType: '',
      tempo:        '',
      measureCount: 0,
    };

    try {
      const parser = new DOMParser();
      const doc    = parser.parseFromString(xmlString, 'text/xml');

      // Key signature
      const keyEl = doc.querySelector('key');
      if (keyEl) {
        const fifths = parseInt(keyEl.querySelector('fifths')?.textContent || '0');
        const mode   = (keyEl.querySelector('mode')?.textContent || 'major').toLowerCase();
        info.key     = _fifthsToKeyName(fifths, mode);
        info.mode    = mode === 'minor' ? 'thứ' : 'trưởng';
      }

      // Time signature
      const timeEl = doc.querySelector('time');
      if (timeEl) {
        info.timeBeats    = timeEl.querySelector('beats')?.textContent || '';
        info.timeBeatType = timeEl.querySelector('beat-type')?.textContent || '';
      }

      // Tempo — metronome element or <sound tempo="..."/>
      const perMin = doc.querySelector('per-minute');
      if (perMin) {
        info.tempo = Math.round(parseFloat(perMin.textContent));
      } else {
        const soundEl = doc.querySelector('sound[tempo]');
        if (soundEl) info.tempo = Math.round(parseFloat(soundEl.getAttribute('tempo')));
      }

      // Measure count (first part only)
      const part = doc.querySelector('part');
      if (part) info.measureCount = part.querySelectorAll('measure').length;

    } catch (e) {
      console.warn('[SongInfoBar] Parse error:', e);
    }

    return info;
  }

  /* Chuyển đổi fifths → tên key (C, G, Am...) */
  function _fifthsToKeyName(fifths, mode) {
    const sharps = ['C','G','D','A','E','B','F#','C#'];
    const flats  = ['C','F','Bb','Eb','Ab','Db','Gb','Cb'];
    const key = fifths >= 0 ? sharps[Math.min(fifths, 7)] : flats[Math.min(-fifths, 7)];

    if (mode === 'minor') {
      const minorMap = {
        C:'Am', G:'Em', D:'Bm', A:'F#m', E:'C#m', B:'G#m', 'F#':'D#m', 'C#':'A#m',
        F:'Dm', Bb:'Gm', Eb:'Cm', Ab:'Fm', Db:'Bbm', Gb:'Ebm', Cb:'Abm',
      };
      return minorMap[key] || key + 'm';
    }
    return key;
  }

  /* ─── Render strip ──────────────────────────────────────── */
  function _render(info) {
    const inner = document.getElementById('si-inner');
    if (!inner) return;

    const chips = [];
    if (info.key)          chips.push(`<span class="si-chip si-key">🎵 ${info.key} ${info.mode}</span>`);
    if (info.timeBeats)    chips.push(`<span class="si-chip si-time">♩ ${info.timeBeats}/${info.timeBeatType}</span>`);
    if (info.tempo)        chips.push(`<span class="si-chip si-tempo">= ${info.tempo} bpm</span>`);
    if (info.measureCount) chips.push(`<span class="si-chip si-measures">${info.measureCount} nhịp</span>`);

    inner.innerHTML = chips.join('');
  }

  function _toggle() {
    const inner = document.getElementById('si-inner');
    if (!inner) return;
    const collapsed = inner.classList.toggle('si-collapsed');
    const btn = document.getElementById('btn-song-info-toggle');
    if (btn) btn.title = collapsed ? 'Hiện thông tin bài' : 'Thu gọn';
    if (btn) btn.textContent = collapsed ? '▶' : '▼';
  }

  /* Trả về info đã parse để các module khác dùng (e.g. PerformanceNotes) */
  function getSongInfo() { return _songData; }

  return { init, loadSong, clearSong, getSongInfo };
})();

window.SongInfoBar = SongInfoBar;
