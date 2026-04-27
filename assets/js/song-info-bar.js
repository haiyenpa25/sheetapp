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

  /* ─── Render strip ─────────────────────────────────────── */
  function _render(info) {
    const inner = document.getElementById('si-inner');
    if (!inner) return;

    const chips = [];
    if (info.key)          chips.push(`<span class="si-chip si-key">\uD83C\uDFB5 ${info.key} ${info.mode}</span>`);
    if (info.timeBeats)    chips.push(`<span class="si-chip si-time">\u2669 ${info.timeBeats}/${info.timeBeatType}</span>`);
    if (info.tempo)        chips.push(`<span class="si-chip si-tempo">= ${info.tempo} bpm</span>`);
    if (info.measureCount) chips.push(`<span class="si-chip si-measures">${info.measureCount} nh\u1ECBp</span>`);

    // Chord set chip — c\u1EADp nh\u1EADt sau khi ChordCanvas load xong (delay nh\u1ECF)
    const currentSet   = window.ChordCanvas?.getCurrentSet?.();
    const chordCount   = Object.keys(window.ChordCanvas?.getCustomChords?.() ?? {}).length;
    if (currentSet && currentSet !== 'default') {
      const countLabel = chordCount > 0 ? `\u25CF ${chordCount} h\u1EE3p \u00E2m` : '\u25CB Ch\u01B0a c\u00F3';
      const chipClass  = chordCount > 0 ? 'si-chip si-chord-set si-chord-has' : 'si-chip si-chord-set si-chord-empty';
      chips.push(`<span class="${chipClass}" title="B\u1ED9 h\u1EE3p \u00E2m: ${currentSet}">\uD83C\uDFB8 ${currentSet} \u00B7 ${countLabel}</span>`);
    } else if (currentSet === 'default') {
      chips.push(`<span class="si-chip si-chord-set" title="H\u1EE3p \u00E2m t\u1EEB TLH (g\u1ED1c)">\uD83C\uDFB8 TLH (g\u1ED1c)</span>`);
    }

    inner.innerHTML = chips.join('');
  }

  /* G\u1ECDi l\u1EA1i _render \u0111\u1EC3 c\u1EADp nh\u1EADt chord chip sau khi set switch */
  function refreshChordChip() {
    if (_songData) _render(_songData);
  }

  function _toggle() {
    const inner = document.getElementById('si-inner');
    if (!inner) return;
    const collapsed = inner.classList.toggle('si-collapsed');
    const btn = document.getElementById('btn-song-info-toggle');
    if (btn) btn.title = collapsed ? 'Hiện thông tin bài' : 'Thu gọn';
    if (btn) btn.textContent = collapsed ? '▶' : '▼';
  }

  /* Tr\u1EA3 v\u1EC1 info \u0111\u00E3 parse \u0111\u1EC3 c\u00E1c module kh\u00E1c d\u00F9ng */
  function getSongInfo() { return _songData; }

  /* Tr\u1EA3 v\u1EC1 t\u00EAn t\u00F4ng g\u1ED1c (e.g. "G", "Bb", "Am") */
  function getSongKey()  { return _songData?.key || ''; }

  return { init, loadSong, clearSong, getSongInfo, getSongKey, refreshChordChip };
})();

window.SongInfoBar = SongInfoBar;
