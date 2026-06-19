// js_project_persistence.js — 브라우저 내 작업 자동 저장·복원
// 500줄 이내 유지

const STORAGE_KEY = '238-music-composer:project:v1';
const VERSION = 1;

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toFiniteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeNote(note) {
  if (!isPlainObject(note)) return null;
  const duration = toFiniteNumber(note.duration, 1);
  const bar = Math.max(1, Math.floor(toFiniteNumber(note.bar, 1)));
  const beat = Math.max(0, toFiniteNumber(note.beat, 0));

  if (note.rest) {
    return { rest: true, duration, bar, beat };
  }

  const pc = Math.floor(toFiniteNumber(note.pc, -1));
  const octave = Math.floor(toFiniteNumber(note.octave, 4));
  if (pc < 0 || pc > 11 || octave < 0 || octave > 9 || typeof note.pitch !== 'string') {
    return null;
  }

  return {
    token: typeof note.token === 'string' ? note.token : `${note.pitch}${octave}:q`,
    pc,
    pitch: note.pitch,
    octave,
    midi: Math.floor(toFiniteNumber(note.midi, (octave + 1) * 12 + pc)),
    duration,
    bar,
    beat,
  };
}

function sanitizeChord(chord) {
  if (!isPlainObject(chord)) return null;
  const rootPc = Math.floor(toFiniteNumber(chord.rootPc, -1));
  if (rootPc < 0 || rootPc > 11 || typeof chord.rootName !== 'string' || typeof chord.quality !== 'string') {
    return null;
  }
  return {
    degree: Math.max(1, Math.floor(toFiniteNumber(chord.degree, 1))),
    rootPc,
    rootName: chord.rootName,
    quality: chord.quality,
    roman: typeof chord.roman === 'string' ? chord.roman : '',
    intervals: Array.isArray(chord.intervals) ? chord.intervals.map((value) => Math.floor(toFiniteNumber(value))).filter((value) => value >= 0 && value < 12) : [],
    notes: Array.isArray(chord.notes) ? chord.notes.filter((value) => typeof value === 'string') : [],
  };
}

function sanitizeRecommendation(rec) {
  if (!isPlainObject(rec)) return null;
  const chord = sanitizeChord(rec.chord);
  if (!chord) return null;
  return {
    chord,
    matchCount: Math.max(0, Math.floor(toFiniteNumber(rec.matchCount, 0))),
    passingCount: Math.max(0, Math.floor(toFiniteNumber(rec.passingCount, 0))),
    score: toFiniteNumber(rec.score, 0),
    confidence: Math.max(0, Math.min(1, toFiniteNumber(rec.confidence, 0))),
  };
}

function sanitizeSettings(settings) {
  const source = isPlainObject(settings) ? settings : {};
  return {
    root: typeof source.root === 'string' ? source.root : 'C',
    mode: source.mode === 'minor' ? 'minor' : 'major',
    bpm: Math.max(40, Math.min(220, Math.round(toFiniteNumber(source.bpm, 96)))),
    progression: typeof source.progression === 'string' ? source.progression : 'pop',
    accompaniment: typeof source.accompaniment === 'string' ? source.accompaniment : 'arpeggio',
  };
}

function sanitizeProject(value) {
  if (!isPlainObject(value)) return null;
  const notes = Array.isArray(value.notes) ? value.notes.map(sanitizeNote).filter(Boolean) : [];
  const recommendations = Array.isArray(value.lastRecommendations)
    ? value.lastRecommendations.map(sanitizeRecommendation).filter(Boolean)
    : [];
  return {
    notes,
    lastRecommendations: recommendations,
    pattern: typeof value.pattern === 'string' ? value.pattern : 'pop',
    accompaniment: typeof value.accompaniment === 'string' ? value.accompaniment : 'arpeggio',
    settings: sanitizeSettings(value.settings),
  };
}

export function createProjectPersistence(options) {
  const {
    state,
    getSettings,
    applySettings,
    onStatus,
  } = options;
  let saveTimer = null;

  function setStatus(message, tone = 'neutral') {
    if (typeof onStatus === 'function') onStatus(message, tone);
  }

  function snapshot() {
    return {
      notes: state.notes,
      lastRecommendations: state.lastRecommendations,
      pattern: state.pattern,
      accompaniment: state.accompaniment,
      settings: getSettings(),
    };
  }

  function saveNow() {
    saveTimer = null;
    try {
      const payload = {
        version: VERSION,
        savedAt: Date.now(),
        project: snapshot(),
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      setStatus('자동 저장됨', 'saved');
      return true;
    } catch (_) {
      setStatus('자동 저장을 사용할 수 없습니다', 'warning');
      return false;
    }
  }

  function scheduleSave() {
    if (saveTimer) window.clearTimeout(saveTimer);
    setStatus('저장 중…', 'saving');
    saveTimer = window.setTimeout(saveNow, 260);
  }

  function restore() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { restored: false };
      const payload = JSON.parse(raw);
      if (!isPlainObject(payload) || payload.version !== VERSION) return { restored: false };
      const project = sanitizeProject(payload.project);
      if (!project) return { restored: false };

      state.notes = project.notes;
      state.lastRecommendations = project.lastRecommendations;
      state.chordCandidates = [];
      state.history = [];
      state.pattern = project.pattern;
      state.accompaniment = project.accompaniment;
      applySettings(project.settings);
      setStatus(project.notes.length ? '저장된 작업 불러옴' : '저장된 설정 불러옴', 'restored');
      return { restored: true, savedAt: toFiniteNumber(payload.savedAt, 0) };
    } catch (_) {
      setStatus('저장된 작업을 읽을 수 없습니다', 'warning');
      return { restored: false };
    }
  }

  function flush() {
    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveNow();
  }

  return { scheduleSave, restore, flush };
}
