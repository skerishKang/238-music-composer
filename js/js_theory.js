// js_theory.js — 음이론·멜로디 파싱·코드 추천
// 500줄 이내 유지

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export { SHARP_NAMES };
const FLAT_TO_SHARP = {
  Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#',
  'C♭': 'B', 'F♭': 'E', 'B♭': 'A#', 'E♭': 'D#', 'A♭': 'G#',
};
const BLACK_KEYS = new Set(['C#', 'D#', 'F#', 'G#', 'A#']);
export { BLACK_KEYS };

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

// 장조·단조의 7도 안에서 각 디그리(1~7)별 코드 품질과 로마자
const DIATONIC = {
  major: [
    { quality: 'maj', roman: 'I' },
    { quality: 'min', roman: 'ii' },
    { quality: 'min', roman: 'iii' },
    { quality: 'maj', roman: 'IV' },
    { quality: 'maj', roman: 'V' },
    { quality: 'min', roman: 'vi' },
    { quality: 'dim', roman: 'vii°' },
  ],
  minor: [
    { quality: 'min', roman: 'i' },
    { quality: 'dim', roman: 'ii°' },
    { quality: 'maj', roman: 'III' },
    { quality: 'min', roman: 'iv' },
    { quality: 'min', roman: 'v' },
    { quality: 'maj', roman: 'VI' },
    { quality: 'maj', roman: 'VII' },
  ],
};

const PROGRESSION_PATTERNS = {
  pop:     [0, 4, 5, 3],
  ballad:  [0, 5, 2, 3],
  jazz:    [1, 4, 0, 4],
  minor:   [0, 5, 2, 6],
  emo:     [5, 3, 0, 4],
  loop:    [0, 5, 3, 4],
};

export const PROGRESSION_LABELS = {
  pop: 'I-V-vi-IV',
  ballad: 'I-VI-iii-IV',
  jazz: 'ii-V-I',
  minor: 'i-VI-III-VII',
  emo: 'vi-IV-I-V',
  loop: 'I-vi-IV-V',
};

export function normalizeRoot(root) {
  if (!root) return 'C';
  const trimmed = root.trim();
  if (FLAT_TO_SHARP[trimmed]) return FLAT_TO_SHARP[trimmed];
  const head = trimmed.charAt(0).toUpperCase();
  const tail = trimmed.slice(1).replace('b', '#');
  return head + (tail === '♭' ? '' : tail);
}

export function rootPc(root) {
  return SHARP_NAMES.indexOf(normalizeRoot(root));
}

export function noteName(pc) {
  return SHARP_NAMES[((pc % 12) + 12) % 12];
}

// 길이 표기(박자) → 4분음표 기준 길이
export function durationValue(token) {
  if (!token) return 1;
  const t = token.toLowerCase();
  if (t === 'w') return 4;
  if (t === 'h' || t === '2') return 2;
  if (t === 'q' || t === '1') return 1;
  if (t === 'e' || t === '8') return 0.5;
  if (t === 's' || t === '16') return 0.25;
  if (t === 't' || t === '32') return 0.125;
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function formatDuration(value) {
  if (value === 4) return 'w';
  if (value === 2) return 'h';
  if (value === 1) return 'q';
  if (value === 0.5) return 'e';
  if (value === 0.25) return 's';
  if (value === 0.125) return 't';
  return String(value);
}

const NOTE_REGEX = /^([A-Ga-g])([#b♯♭]?)(\d)?(?::?(\d+(?:\.\d+)?)?([whqes]|16|32)?)?$/;

// 텍스트 → {notes, errors, hasExplicitBars, beatLimit}
export function parseMelody(text) {
  const errors = [];
  const notes = [];
  const tokens = (text || '')
    .replace(/\n/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
  let bar = 1;
  let beatInBar = 0;
  let hasExplicitBars = false;

  for (const raw of tokens) {
    if (raw === '|') {
      hasExplicitBars = true;
      bar += 1;
      beatInBar = 0;
      continue;
    }
    const match = raw.match(NOTE_REGEX);
    if (!match) {
      if (raw === '-' || raw.toLowerCase() === 'rest' || raw === '0') {
        notes.push({ rest: true, duration: 1, bar, beat: beatInBar });
        beatInBar += 1;
        if (!hasExplicitBars && beatInBar >= 4) { bar += 1; beatInBar = 0; }
        continue;
      }
      errors.push(`인식할 수 없는 토큰: ${raw}`);
      continue;
    }
    const [, letter, accidental, octaveStr, , dur] = match;
    const acc = accidental === 'b' || accidental === '♭' ? 'b' : accidental === '#' || accidental === '♯' ? '#' : '';
    let pitch = letter.toUpperCase() + acc;
    if (FLAT_TO_SHARP[pitch]) pitch = FLAT_TO_SHARP[pitch];
    const pc = SHARP_NAMES.indexOf(pitch);
    if (pc < 0) {
      errors.push(`지원하지 않는 음: ${raw}`);
      continue;
    }
    const octave = octaveStr ? Number(octaveStr) : 4;
    const midi = (octave + 1) * 12 + pc;
    const duration = durationValue(dur);
    notes.push({ token: `${pitch}${octave}:${formatDuration(duration)}`, pc, pitch, octave, midi, duration, bar, beat: beatInBar });
    beatInBar += duration;
    if (!hasExplicitBars && beatInBar >= 4) { bar += 1; beatInBar = 0; }
  }

  const maxBar = notes.length
    ? notes.reduce((m, n) => Math.max(m, n.bar || 1), 1)
    : (hasExplicitBars ? Math.max(1, bar - 1) : 1);
  return { notes, errors, hasExplicitBars, bars: maxBar };
}

export function groupByBar(notes) {
  const map = new Map();
  for (const n of notes) {
    const bar = n.bar || 1;
    if (!map.has(bar)) map.set(bar, []);
    map.get(bar).push(n);
  }
  if (map.size === 0) map.set(1, []);
  const result = [];
  const maxBar = Math.max(...map.keys());
  for (let i = 1; i <= maxBar; i += 1) {
    result.push(map.get(i) || []);
  }
  return result;
}

// 7개 디아토닉 코드 메타데이터 생성
export function buildDiatonic(rootInput, mode) {
  const root = rootPc(rootInput);
  const scale = mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const table = DIATONIC[mode];
  return scale.map((interval, idx) => {
    const rootPcValue = (root + interval) % 12;
    const intervals = qualityToIntervals(table[idx].quality);
    const notes = intervals.map((iv) => noteName((rootPcValue + iv) % 12));
    return {
      degree: idx + 1,
      rootPc: rootPcValue,
      rootName: noteName(rootPcValue),
      quality: table[idx].quality,
      roman: table[idx].roman,
      intervals,
      notes,
    };
  });
}

function qualityToIntervals(quality) {
  if (quality === 'maj') return [0, 4, 7];
  if (quality === 'min') return [0, 3, 7];
  if (quality === 'dim') return [0, 3, 6];
  if (quality === 'aug') return [0, 4, 8];
  return [0, 4, 7];
}

export function chordSuffix(quality) {
  if (quality === 'maj') return '';
  if (quality === 'min') return 'm';
  if (quality === 'dim') return 'dim';
  if (quality === 'aug') return 'aug';
  return '';
}

export function formatChordName(chord) {
  return `${chord.rootName}${chordSuffix(chord.quality)}`;
}

function scoreChordForBar(barNotes, chord, idx, diatonic) {
  const melodyPcs = barNotes.filter((n) => !n.rest).map((n) => n.pc);
  let score = 0;
  let matchCount = 0;
  let passingCount = 0;
  const set = new Set(chord.notes.map((n) => SHARP_NAMES.indexOf(n)));
  const scaleSet = new Set(diatonic.map((c) => c.rootPc));

  for (const pc of melodyPcs) {
    if (set.has(pc)) {
      score += 5;
      matchCount += 1;
      if (pc === chord.rootPc) score += 2.5;
    } else if (scaleSet.has(pc)) {
      score += 1.6;
      passingCount += 1;
    } else {
      score -= 2.2;
    }
  }

  score += positionBias(idx, diatonic.length, melodyPcs);
  const denom = Math.max(1, melodyPcs.length * 7 + 4);
  const confidence = Math.max(0.35, Math.min(0.98, 0.4 + score / denom));
  return { chord, matchCount, passingCount, score, confidence };
}

export function recommendForBar(barNotes, diatonic) {
  const melodyPcs = barNotes.filter((n) => !n.rest).map((n) => n.pc);
  if (melodyPcs.length === 0) {
    return pickFallback(diatonic, 0, 0);
  }
  return recommendTopForBar(barNotes, diatonic, 1)[0];
}

function positionBias(idx, total, melodyPcs) {
  const dominant = 4; // V
  const tonic = 0;
  let bias = 0;
  if (idx === tonic) bias += 1.2;
  if (idx === dominant) bias += 1.0;
  if (idx === total - 1 && melodyPcs.some((pc) => pc === (idx - 1))) bias += 0.6;
  return bias;
}

function pickFallback(diatonic, idx, total) {
  const fallbackIdx = [0, 5, 3, 4][idx % 4];
  const chord = diatonic[fallbackIdx] || diatonic[0];
  return { chord, matchCount: 0, passingCount: 0, score: 0, confidence: 0.5 };
}

export function recommendTopForBar(barNotes, diatonic, limit = 3) {
  const melodyPcs = barNotes.filter((n) => !n.rest).map((n) => n.pc);
  if (melodyPcs.length === 0) {
    return [0, 5, 3].map((_, idx) => pickFallback(diatonic, idx, 3)).slice(0, limit);
  }
  return diatonic
    .map((chord, idx) => scoreChordForBar(barNotes, chord, idx, diatonic))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function recommendTopAll(bars, diatonic, limit = 3) {
  return bars.map((barNotes) => recommendTopForBar(barNotes, diatonic, limit));
}

export function recommendAll(bars, diatonic) {
  return bars.map((barNotes, i) => recommendForBar(barNotes, diatonic));
}

export function buildProgression(bars, diatonic, patternName) {
  const pattern = PROGRESSION_PATTERNS[patternName] || PROGRESSION_PATTERNS.pop;
  return bars.map((barNotes, i) => {
    const idx = pattern[i % pattern.length];
    const chord = diatonic[idx] || diatonic[0];
    const melodyPcs = barNotes.filter((n) => !n.rest).map((n) => n.pc);
    const matchCount = chord.intervals
      .map((iv) => (chord.rootPc + iv) % 12)
      .filter((pc) => melodyPcs.includes(pc)).length;
    const passingCount = melodyPcs.length - matchCount;
    const confidence = melodyPcs.length === 0
      ? 0.55
      : Math.max(0.45, Math.min(0.95, 0.5 + matchCount * 0.12));
    return { chord, matchCount, passingCount, score: matchCount * 5, confidence };
  });
}

export function explainMatch(chord, matchCount, passingCount) {
  if (matchCount === 0 && passingCount === 0) {
    return `${chord.roman} 진행의 기본 위치입니다. 멜로디가 없어 추천도는 기본값입니다.`;
  }
  if (matchCount >= passingCount + 1) {
    return `${chord.roman}(${formatChordName(chord)}) 코드 구성음과 멜로디가 잘 맞습니다.`;
  }
  if (passingCount > 0 && matchCount > 0) {
    return `${chord.roman}의 구성음과 함께 스케일 패싱 노트가 자연스럽게 흐릅니다.`;
  }
  return `${chord.roman} 진행의 텐션이 느껴지는 위치입니다. 멜로디에 따라 바꿔보세요.`;
}

// 코드 이름을 멜로디 텍스트에 추가 (예: "C4:q E4:q | G4:q" + " | C | G")
export function buildMelodyText(notes) {
  if (!notes.length) return '';
  const grouped = groupByBar(notes);
  return grouped
    .map((bar) => bar.map((n) => (n.rest ? '-' : n.token)).join(' '))
    .join(' | ');
}
