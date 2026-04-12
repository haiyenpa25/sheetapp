/**
 * transpose-engine.js
 * Lõi MusicXML Transposition được tiếp sức bởi Tonal.js
 */
const TransposeEngine = (() => {

  // Ánh xạ 12 nốt Chromatic (để dự phòng và đồng bộ hoá enharmonic)
  const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

  // Interval map cho 12 semitones
  const SEMITONE_TO_INTERVAL = {
    0: '1P', 1: '2m', 2: '2M', 3: '3m', 4: '3M', 5: '4P', 6: '4A',
    7: '5P', 8: '6m', 9: '6M', 10: '7m', 11: '7M', 12: '8P'
  };

  function getInterval(semitones) {
      const dir = semitones < 0 ? '-' : '';
      const abs = Math.abs(semitones) % 12;
      return dir + SEMITONE_TO_INTERVAL[abs];
  }

  // Ép định dạng 1 nốt sang thăng/giáng dựa trên target config
  function forceEnharmonic(noteName, useFlats) {
      if (!window.Tonal) return noteName;
      const tNote = window.Tonal.Note.get(noteName);
      if (tNote.empty) return noteName;
      
      const chroma = tNote.chroma;
      return useFlats ? NOTES_FLAT[chroma] : NOTES_SHARP[chroma];
  }

  /**
   * Dịch giọng một hợp âm hoàn chỉnh (có tính cả bass notes như Cmaj7/G).
   */
  function transposeChord(chordName, semitones, useFlats = false) {
      if (!chordName || semitones === 0) return chordName;
      if (!window.Tonal) return chordName;

      try {
          const interv = getInterval(semitones);
          // Tonal.Chord.transpose sẽ tự động dịch root và bass note!
          let tr = window.Tonal.Chord.transpose(chordName, interv);
          
          // Phân tách Root và Bass để ép enharmonic
          const parts = tr.split('/');
          let rootNote = parts[0].match(/^[A-G][#b]*/)[0];
          let suffix = parts[0].substring(rootNote.length);
          
          let forcedRoot = forceEnharmonic(rootNote, useFlats);
          let res = forcedRoot + suffix;
          if (parts.length > 1) {
             res += '/' + forceEnharmonic(parts[1], useFlats);
          }
          return res;
      } catch (e) {
          console.error("Tonal Transpose Error", e);
          return chordName;
      }
  }

  /**
   * Tính toán điệu tính mới (Fifths)
   * (Đã bị vô hiệu hoá - Nhường quyền Transpose trực tiếp cho OSMD Native)
   */
  function transposeXML(xmlString, semitones) {
    // OSMD Native TransposeCalculator sẽ lo liệu tất cả (nốt nhạc + hợp âm)
    return xmlString;
  }

  // ==========================================
  // CAPO AI CALCULATOR
  // ==========================================
  const OPEN_CHORDS = ['C', 'G', 'D', 'A', 'E', 'Am', 'Em', 'Dm'];

  function scoreCapoPos(chordList, capoFret) {
      if (!window.Tonal) return -1;
      let score = 0;
      chordList.forEach(c => {
          // Khi kẹp Capo ở ngăn 2 (D -> C) thì hợp âm giảm 2 semitones
          const tr = transposeChord(c, -capoFret, false); 
          const parts = tr.split('/');
          const rootAndQuality = parts[0].replace(/maj|min|dim|aug|sus|add|\d.*/g, '');
          const isStandardOpen = OPEN_CHORDS.includes(rootAndQuality) || OPEN_CHORDS.includes(parts[0]);
          if (isStandardOpen) {
              score += 1.0;
          } else if (parts[0].length <= 2) {
              score += 0.3; // Hợp âm ngắn (không phải hợp âm chặn phức tạp)
          }
      });
      return score;
  }

  function suggestBestCapo(chordList) {
      if (!chordList || chordList.length === 0 || !window.Tonal) return 0;
      let bestCapo = 0;
      let maxScore = -1;
      
      // Khảo sát 12 ngăn capo
      for (let capo = 0; capo < 12; capo++) {
          const s = scoreCapoPos(chordList, capo);
          // Ưu tiên capo ngăn thấp (để đễ đàn) bằng cách trừ nhẹ điểm theo số ngăn
          const weightedScore = s - (capo * 0.05); 
          
          if (weightedScore > maxScore) {
              maxScore = weightedScore;
              bestCapo = capo;
          }
      }
      return bestCapo;
  }

  // Helpers
  function extractChordsFromXML(xmlString) {
      if (!xmlString) return [];
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');
      const chords = [];
      doc.querySelectorAll('harmony').forEach(h => {
          const r = h.querySelector('root > root-step');
          if (!r) return;
          let name = r.textContent.trim();
          const a = h.querySelector('root > root-alter');
          const alt = a ? parseFloat(a.textContent) : 0;
          if (alt === 1) name += '#';
          if (alt === -1) name += 'b';
          chords.push(name);
      });
      // Loại bỏ trùng lặp để giảm tính toán
      return [...new Set(chords)];
  }

  function _createEl(doc, tag, text) {
      const el = doc.createElement(tag);
      el.textContent = text;
      return el;
  }
  function _createAndAppend(doc, parent, tagName, text) {
    const el = _createEl(doc, tagName, text);
    parent.appendChild(el);
    return el;
  }

  function _semitoneToFifths(currentFifths, semitones) {
    const keyFifths = [0,  1, 2, 3, 4, 5,  6,-5,-4,-3,-2,-1];
    let curIdx = keyFifths.indexOf(_normF(currentFifths));
    if (curIdx === -1) return currentFifths + Math.round(semitones * 7 / 12);
    const newIdx = ((curIdx + semitones) % 12 + 12) % 12;
    return keyFifths[newIdx];
  }

  function _normF(f) {
    while (f > 6)  f -= 12;
    while (f < -6) f += 12;
    return f;
  }

  function _chromaticToDiatonic(semitones) {
    const steps = [0,1,1,2,2,3,3,4,5,5,6,6,7];
    const abs = Math.abs(semitones) % 12;
    return Math.sign(semitones) * steps[abs];
  }

  return { transposeChord, transposeXML, suggestBestCapo, extractChordsFromXML, NOTES_SHARP, NOTES_FLAT };
})();
