/**
 * transpose-engine.js
 * Xử lý dịch giọng MusicXML theo semitones.
 * Approach: Modify XML DOM trực tiếp (đáng tin cậy hơn OSMD internal API).
 * Hỗ trợ: transpose nốt nhạc + chord symbols.
 */
const TransposeEngine = (() => {

  // 12 note chromatic scale (sharps & flats)
  const NOTES_SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const NOTES_FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

  // Map từ tên note sang index
  const NOTE_TO_IDX = {};
  NOTES_SHARP.forEach((n,i) => { NOTE_TO_IDX[n] = i; });
  NOTE_TO_IDX['Db'] = 1; NOTE_TO_IDX['Eb'] = 3; NOTE_TO_IDX['Gb'] = 6;
  NOTE_TO_IDX['Ab'] = 8; NOTE_TO_IDX['Bb'] = 10;

  // Tonality preference (sharp keys dùng sharp, flat keys dùng flat)
  const SHARP_KEYS = [1,2,3,4,5,6];   // fifths >= 1 → sharp
  const FLAT_KEYS  = [-1,-2,-3,-4,-5,-6,-7];  // fifths <= -1 → flat

  /**
   * Transpose chord name lên/xuống semitones.
   *  VD: transposeChord("G", 2)  → "A"
   *      transposeChord("Cadd9", -1) → "Badd9"
   *      transposeChord("F#m7", 3)  → "Am7"
   */
  function transposeChord(chordName, semitones) {
    if (!chordName || semitones === 0) return chordName;

    // Regex: bắt root note (A-G, kèm #/b, rồi suffix)
    const match = chordName.match(/^([A-G][#b]?)(.*)/);
    if (!match) return chordName;

    const root    = match[1];
    const suffix  = match[2];
    const idx     = NOTE_TO_IDX[root];
    if (idx === undefined) return chordName;

    const newIdx  = ((idx + semitones) % 12 + 12) % 12;
    // Chọn sharp hay flat dựa vào semitones direction
    const newRoot = semitones > 0 ? NOTES_SHARP[newIdx] : NOTES_FLAT[newIdx];
    return newRoot + suffix;
  }

  /**
   * Transpose toàn bộ MusicXML string lên/xuống semitones.
   * Sửa:
   *   - <key><fifths> — thay đổi tông chủ
   *   - <transpose><chromatic> — thay đổi transpose map
   *   - <harmony> chord symbols (text)
   *
   * @param {string} xmlString  - MusicXML gốc
   * @param {number} semitones  - Số semitone cần dịch (-12..+12)
   * @returns {string}          - MusicXML đã được dịch giọng
   */
  function transposeXML(xmlString, semitones) {
    if (semitones === 0) return xmlString;

    const parser = new DOMParser();
    const doc    = parser.parseFromString(xmlString, 'text/xml');

    if (doc.querySelector('parsererror')) {
      console.warn('[Transpose] XML parse error — returning original');
      return xmlString;
    }

    // 1) Update <key><fifths>
    doc.querySelectorAll('key').forEach(keyEl => {
      const fifthsEl = keyEl.querySelector('fifths');
      if (!fifthsEl) return;
      const oldFifths = parseInt(fifthsEl.textContent, 10) || 0;
      // Mỗi semitone tương đương +7 fifths (circle of fifths), mod 12
      // Nhưng dùng chromatic mapping đơn giản hơn:
      const newFifths = _semitoneToFifths(oldFifths, semitones);
      fifthsEl.textContent = newFifths;

      // Update mode nếu có
      const modeEl = keyEl.querySelector('mode');
      // mode không thay đổi (major/minor giữ nguyên)
    });

    // 2) Update hoặc thêm <transpose> element vào mỗi <part>
    const parts = doc.querySelectorAll('part');
    parts.forEach(part => {
      // Tìm measure đầu tiên, attributes đầu tiên
      const firstAttrs = part.querySelector('measure attributes');
      if (!firstAttrs) return;

      let transpEl = firstAttrs.querySelector('transpose');
      if (!transpEl) {
        transpEl = doc.createElement('transpose');
        const diatEl  = doc.createElement('diatonic');
        const chromEl = doc.createElement('chromatic');
        diatEl.textContent  = '0';
        chromEl.textContent = '0';
        transpEl.appendChild(diatEl);
        transpEl.appendChild(chromEl);
        firstAttrs.appendChild(transpEl);
      }
      const chromEl = transpEl.querySelector('chromatic') || _createAndAppend(doc, transpEl, 'chromatic', '0');
      const diatEl  = transpEl.querySelector('diatonic')  || _createAndAppend(doc, transpEl, 'diatonic',  '0');

      const oldChrom = parseInt(chromEl.textContent, 10) || 0;
      const oldDiat  = parseInt(diatEl.textContent,  10) || 0;
      chromEl.textContent = oldChrom + semitones;
      diatEl.textContent  = oldDiat  + _chromaticToDiatonic(semitones);
    });

    // 3) Transpose <harmony> chord roots
    doc.querySelectorAll('harmony').forEach(harmEl => {
      const rootEl = harmEl.querySelector('root > root-step');
      if (!rootEl) return;

      const alterEl = harmEl.querySelector('root > root-alter');
      const alter   = alterEl ? parseFloat(alterEl.textContent) : 0;

      // Build note name
      let rootName = rootEl.textContent.trim();
      if (alter === 1)  rootName += '#';
      if (alter === -1) rootName += 'b';

      const idx = NOTE_TO_IDX[rootName];
      if (idx === undefined) return;

      const newIdx   = ((idx + semitones) % 12 + 12) % 12;
      const useFlats = semitones < 0;
      const newNote  = useFlats ? NOTES_FLAT[newIdx] : NOTES_SHARP[newIdx];

      // Update root-step & root-alter
      const baseNote    = newNote.replace(/[#b]/, '');
      const newAlterVal = newNote.includes('#') ? 1 : newNote.includes('b') ? -1 : 0;

      rootEl.textContent = baseNote;
      if (alterEl) {
        if (newAlterVal === 0) alterEl.parentNode.removeChild(alterEl);
        else alterEl.textContent = newAlterVal;
      } else if (newAlterVal !== 0) {
        const newAlterEl = doc.createElement('root-alter');
        newAlterEl.textContent = newAlterVal;
        harmEl.querySelector('root').appendChild(newAlterEl);
      }
    });

    // Serialize lại
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  }

  // Helpers

  /** Chuyển đổi số fifths theo semitone offset */
  function _semitoneToFifths(currentFifths, semitones) {
    // Chromatic scale → circle of fifths mapping
    // Mỗi bước trên circle of fifths tương ứng +7 semitone (hoặc -5)
    // Simple: tính key mới từ key cũ
    const keyNotes  = ['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F'];
    const keyFifths = [0,   1,  2,  3,  4,  5,   6,  -5,  -4, -3,  -2, -1];

    // Tìm key hiện tại (note name)
    const curIdx = keyFifths.indexOf(normalFifths(currentFifths));
    if (curIdx === -1) return currentFifths + Math.round(semitones * 7 / 12);

    const newNoteIdx = ((curIdx + semitones) % 12 + 12) % 12;
    return keyFifths[newNoteIdx];
  }

  function normalFifths(f) {
    // Normalize to -6..6
    while (f > 6)  f -= 12;
    while (f < -6) f += 12;
    return f;
  }

  function _chromaticToDiatonic(semitones) {
    // Approximate: 12 semitones = 7 diatonic steps
    const steps = [0,1,1,2,2,3,3,4,5,5,6,6,7];
    const abs = Math.abs(semitones) % 12;
    return Math.sign(semitones) * steps[abs];
  }

  function _createAndAppend(doc, parent, tagName, textContent) {
    const el = doc.createElement(tagName);
    el.textContent = textContent;
    parent.appendChild(el);
    return el;
  }

  return { transposeChord, transposeXML, NOTES_SHARP, NOTES_FLAT, NOTE_TO_IDX };
})();
