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
  pop: [0, 4, 5, 3],
  ballad: [0, 5, 2, 3],
  jazz: [1, 4, 0, 4],
  minor: [0, 5, 2, 6],
  emo: [5, 3, 0, 4],
  loop: [0, 5, 3, 4],
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

export function durationValue(token) {
  if (!token) return 1;
  const value = token.toLowerCase();
  if (value === 'w') return 4;
  if (value === 'h' || value === '2') return 2;
  if (value === 'q' || value === '1') return 1;
  if (value === 'e' || value === '8') return 0.5;
  if (value === 's' || value === '16') return 0.25;
  if (value === 't' || value === '32') return 0.125;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
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

function advanceAutomaticBar(position, duration) {
  const nextBeat = position.beat + duration;
  return {
    bar: position.bar + Math.floor(nextBeat / 4),
    beat: nextBeat % 4,
  };
}

// 명시적 |가 하나라도 있으면 전체 입력을 명시적 마디 모드로 파싱한다.
// 이전에는 첫 마디가 정확히 4박인 뒤 |가 나오면 자동 마디 증가와 | 증가가 중복됐다.
export function parseMelody(text) {
  const errors = [];
  const notes = [];
  const tokens = (text || '')
    .replace(/\n/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const hasExplicitBars = tokens.includes('|');
  let bar = 1;
  let beatInBar = 0;

  for (const raw of tokens) {
    if (raw === '|') {
      bar += 1;
      beatInBar = 0;
      continue;
    }

    const match = raw.match(NOTE_REGEX);
    if (!match) {
      if (raw === '-' || raw.toLowerCase() === 'rest' || raw === '0') {
        notes.push({ rest: true, duration: 1, bar, beat: beatInBar });
        if (hasExplicitBars) {
          beatInBar += 1;
        } else {
          const next = advanceAutomaticBar({ bar, beat: beatInBar }, 1);
          bar = next.bar;
          beatInBar = next.beat;
        }
        continue;
      }
      errors.push(`인식할 수 없는 토큰: ${raw}`);
      continue;
    }

    const [, letter, accidental, octaveStr, , durationToken] = match;
    const normalizedAccidental = accidental === 'b' || accidental === '♭'
      ? 'b'
      : accidental === '#' || accidental === '♯'
        ? '#'
        : '';
    let pitch = letter.toUpperCase() + normalizedAccidental;
    if (FLAT_TO_SHARP[pitch]) pitch = FLAT_TO_SHARP[pitch];
    const pc = SHARP_NAMES.indexOf(pitch);
    if (pc < 0) {
      errors.push(`지원하지 않는 음: ${raw}`);
      continue;
    }

    const octave = octaveStr ? Number(octaveStr) : 4;
    const duration = durationValue(durationToken);
    notes.push({
      token: `${pitch}${octave}:${formatDuration(duration)}`,
      pc,
      pitch,
      octave,
      midi: (octave + 1) * 12 + pc,
      duration,
      bar,
      beat: beatInBar,
    });

    if (hasExplicitBars) {
      beatInBar += duration;
    } else {
      const next = advanceAutomaticBar({ bar, beat: beatInBar }, duration);
      bar = next.bar;
      beatInBar = next.beat;
    }
  }

  const maxBar = notes.length
    ? notes.reduce((max, note) => Math.max(max, note.bar || 1), 1)
    : (hasExplicitBars ? Math.max(1, bar - 1) : 1);
  return { notes, errors, hasExplicitBars, bars: maxBar };
}

export function groupByBar(notes) {
  const map = new Map();
  for (const note of notes) {
    const bar = note.bar || 1;
    if (!map.has(bar)) map.set(bar, []);
    map.get(bar).push(note);
  }
  if (map.size === 0) map.set(1, []);

  const maxBar = Math.max(...map.keys());
  const bars = [];
  for (let bar = 1; bar <= maxBar; bar += 1) {
    bars.push(map.get(bar) || []);
  }
  return bars;
}

export function buildDiatonic(rootInput, mode) {
  const tonic = rootPc(rootInput);
  const scale = mode === 'minor' ? MINOR_SCALE : MAJOR_SCALE;
  const table = DIATONIC[mode] || DIATONIC.major;
  return scale.map((interval, index) => {
    const rootPcValue = (tonic + interval) % 12;
    const quality = table[index].quality;
    const intervals = qualityToIntervals(quality);
    return {
      degree: index + 1,
      rootPc: rootPcValue,
      rootName: noteName(rootPcValue),
      quality,
      roman: table[index].roman,
      intervals,
      notes: intervals.map((value) => noteName((rootPcValue + value) % 12)),
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

function positionBias(index, total, melodyPcs) {
  const tonic = 0;
  const dominant = 4;
  let bias = 0;
  if (index === tonic) bias += 1.2;
  if (index === dominant) bias += 1.0;
  if (index === total - 1 && melodyPcs.some((pc) => pc === index - 1)) bias += 0.6;
  return bias;
}

function scoreChordForBar(barNotes, chord, index, diatonic) {
  const melodyPcs = barNotes.filter((note) => !note.rest).map((note) => note.pc);
  const chordPcs = new Set(chord.notes.map((name) => SHARP_NAMES.indexOf(name)));
  const scaleRoots = new Set(diatonic.map((item) => item.rootPc));
  let score = 0;
  let matchCount = 0;
  let passingCount = 0;

  for (const pc of melodyPcs) {
    if (chordPcs.has(pc)) {
      score += 5;
      matchCount += 1;
      if (pc === chord.rootPc) score += 2.5;
    } else if (scaleRoots.has(pc)) {
      score += 1.6;
      passingCount += 1;
    } else {
      score -= 2.2;
    }
  }

  score += positionBias(index, diatonic.length, melodyPcs);
  const denominator = Math.max(1, melodyPcs.length * 7 + 4);
  const confidence = Math.max(0.35, Math.min(0.98, 0.4 + score / denominator));
  return { chord, matchCount, passingCount, score, confidence };
}

function pickFallback(diatonic, index) {
  const fallbackIndex = [0, 5, 3, 4][index % 4];
  const chord = diatonic[fallbackIndex] || diatonic[0];
  return { chord, matchCount: 0, passingCount: 0, score: 0, confidence: 0.5 };
}

export function recommendTopForBar(barNotes, diatonic, limit = 3) {
  const melodyPcs = barNotes.filter((note) => !note.rest).map((note) => note.pc);
  if (melodyPcs.length === 0) {
    return [0, 1, 2].map((index) => pickFallback(diatonic, index)).slice(0, limit);
  }
  return diatonic
    .map((chord, index) => scoreChordForBar(barNotes, chord, index, diatonic))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function recommendForBar(barNotes, diatonic) {
  return recommendTopForBar(barNotes, diatonic, 1)[0];
}

export function recommendTopAll(bars, diatonic, limit = 3) {
  return bars.map((barNotes) => recommendTopForBar(barNotes, diatonic, limit));
}

export function recommendAll(bars, diatonic) {
  return bars.map((barNotes) => recommendForBar(barNotes, diatonic));
}

export function buildProgression(bars, diatonic, patternName) {
  const pattern = PROGRESSION_PATTERNS[patternName] || PROGRESSION_PATTERNS.pop;
  return bars.map((barNotes, index) => {
    const chord = diatonic[pattern[index % pattern.length]] || diatonic[0];
    const melodyPcs = barNotes.filter((note) => !note.rest).map((note) => note.pc);
    const chordPcs = chord.intervals.map((interval) => (chord.rootPc + interval) % 12);
    const matchCount = chordPcs.filter((pc) => melodyPcs.includes(pc)).length;
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

export function buildMelodyText(notes) {
  if (!notes.length) return '';
  return groupByBar(notes)
    .map((bar) => bar.map((note) => (note.rest ? '-' : note.token)).join(' '))
    .join(' | ');
}
