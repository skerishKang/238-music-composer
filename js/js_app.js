// js_app.js — 진입점: 피아노 + 멜로디 + 코드 추천 + 악보 + 재생
// 500줄 이내 유지

import {
  parseMelody, buildMelodyText, buildDiatonic, recommendTopAll, buildProgression,
  groupByBar, PROGRESSION_LABELS, normalizeRoot, noteName,
} from './js_theory.js';
import { mountPiano } from './js_piano.js';
import { renderMelodyScore, renderChordStrip, exportMelodyPng } from './js_score.js';
import { playSequence, stopSequence, previewNote } from './js_audio.js';
import { toast, updateStats, renderMiniMelody, renderMiniChords } from './js_ui.js';
import { renderChordCandidates } from './js_chord_candidates.js';

const SAMPLE_MELODY = 'C4:q E4:e G4:e | A4:q G4:e E4:e | F4:h D4:h | G4:q E4:e C4:e | D4:q F4:e A4:e | G4:h E4:h | C4:w';
const BEATS_PER_BAR = 4;
const ACCOMPANIMENT = {
  off: { label: '멜로디만', hint: '반주 없이 멜로디만 먼저 들어봅니다.' },
  block: { label: '코드', hint: '마디마다 코드를 길게 눌러 안정적으로 들려줍니다.' },
  arpeggio: { label: '아르페지오', hint: '추천 코드를 잔잔한 피아노 반주로 들어봅니다.' },
  pop8: { label: '팝 리듬', hint: '8비트 리듬으로 조금 더 또렷하게 들어봅니다.' },
  waltz: { label: '발라드 3/4', hint: '3박 느낌의 발라드 반주입니다.' },
  funk16: { label: '펑크 16비트', hint: '짧고 리듬감 있는 16비트 반주입니다.' },
};

const state = {
  notes: [],
  lastRecommendations: [],
  chordCandidates: [],
  history: [],
  pattern: 'pop',
  accompaniment: 'arpeggio',
};

let pianoRef = null;
let textDebounce = null;
let textSource = 'piano';

const $ = (id) => document.getElementById(id);
const setText = (id, text) => {
  const el = $(id);
  if (el) el.textContent = text;
  return el;
};

function formatDurToken(value) {
  if (value === 4) return 'w';
  if (value === 2) return 'h';
  if (value === 1) return 'q';
  if (value === 0.5) return 'e';
  if (value === 0.25) return 's';
  if (value === 0.125) return 't';
  return String(value);
}

function normalizeBeat(value) {
  return Number((value || 0).toFixed(3));
}

function getNextNotePosition() {
  const last = state.notes[state.notes.length - 1];
  if (!last) return { bar: 1, beat: 0 };
  const nextBeat = (Number(last.beat) || 0) + (Number(last.duration) || 1);
  return {
    bar: (Number(last.bar) || 1) + Math.floor(nextBeat / BEATS_PER_BAR),
    beat: normalizeBeat(nextBeat % BEATS_PER_BAR),
  };
}

function makeNote({ pc, pitch, octave, duration, bar, beat }) {
  const safePc = Number.isFinite(pc) ? pc : 0;
  const safePitch = pitch || noteName(safePc);
  const safeOctave = Number.isFinite(octave) ? octave : 4;
  const safeDuration = duration || 1;
  return {
    token: `${safePitch}${safeOctave}:${formatDurToken(safeDuration)}`,
    pc: safePc,
    pitch: safePitch,
    octave: safeOctave,
    midi: (safeOctave + 1) * 12 + safePc,
    duration: safeDuration,
    bar: bar || 1,
    beat: normalizeBeat(beat),
  };
}

function setAccompaniment(pattern, options = {}) {
  const { announce = true } = options;
  const next = ACCOMPANIMENT[pattern] ? pattern : 'arpeggio';
  state.accompaniment = next;

  const select = $('patternSelect');
  if (select && select.value !== next) {
    select.value = next;
  }

  document.querySelectorAll('[data-accompaniment]').forEach((button) => {
    const selected = button.dataset.accompaniment === next;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  setText('accompanimentHint', ACCOMPANIMENT[next].hint);

  if (announce) {
    toast(`반주: ${ACCOMPANIMENT[next].label}`);
  }
}

function pushNote(noteInput) {
  const match = noteInput.token.match(/^([A-G][#b]?)(\d)/i);
  const octave = match ? Number(match[2]) : 4;
  const pitch = match ? match[1].toUpperCase() : noteInput.pitch;
  const duration = noteInput.duration || 1;
  const position = getNextNotePosition();
  const note = makeNote({
    pc: noteInput.pc,
    pitch,
    octave,
    duration,
    bar: position.bar,
    beat: position.beat,
  });
  state.notes.push(note);
  state.history.push({ type: 'add', note });
  state.lastRecommendations = [];
  state.chordCandidates = [];
  const drawer = $('candidatesDrawer');
  if (drawer) {
    drawer.hidden = true;
    drawer.open = false;
  }
  textSource = 'piano';
  refreshMelodyUi();
  setText('resultSummary', '멜로디가 바뀌었습니다. AI 코드 추천을 다시 눌러보세요.');
  previewNote(note.pitch, note.octave, 0.35);
}

function renderRecommendations() {
  renderChordStrip($('chordStrip'), state.lastRecommendations);
  renderMiniChords($('miniChords'), state.lastRecommendations);
  const hasCandidates = state.chordCandidates.some((list) => list && list.length);
  const drawer = $('candidatesDrawer');
  if (drawer) {
    drawer.hidden = !hasCandidates;
    const meta = $('candidatesMeta');
    if (meta) {
      meta.textContent = hasCandidates ? `(${state.chordCandidates.length}마디)` : '';
    }
  }
  renderChordCandidates($('chordCandidates'), hasCandidates ? state.chordCandidates : [], {
    selected: state.lastRecommendations,
    onSelect: chooseChordCandidate,
  });
}

function renderEmptyHint() {
  const host = $('melodyScore');
  const hint = $('emptyScoreHint');
  if (!host || !hint) return;
  const empty = state.notes.length === 0;
  hint.hidden = !empty;
  if (empty) {
    const vexEmpty = host.querySelector('.vex-empty');
    if (vexEmpty) vexEmpty.remove();
  }
}

function refreshMelodyUi() {
  if (textSource !== 'piano') return;
  const text = buildMelodyText(state.notes);
  const input = $('melodyInput');
  if (input && input.value !== text) {
    input.value = text;
  }
  updateStats(state.notes, state.lastRecommendations);
  renderMelodyScore($('melodyScore'), state.notes);
  renderEmptyHint();
  renderMiniMelody($('miniMelody'), state.notes);
  renderRecommendations();
}

function syncFromText() {
  if (textSource !== 'text') return;
  const text = $('melodyInput').value;
  const parsed = parseMelody(text);
  state.notes = parsed.notes;
  state.lastRecommendations = [];
  state.chordCandidates = [];
  if (parsed.errors.length) {
    toast(parsed.errors[0]);
  }
  updateStats(state.notes, state.lastRecommendations);
  renderMelodyScore($('melodyScore'), state.notes);
  renderEmptyHint();
  renderMiniMelody($('miniMelody'), state.notes);
  renderRecommendations();
}

function getContext() {
  const root = normalizeRoot($('rootSelect').value);
  const mode = $('modeSelect').value;
  const diatonic = buildDiatonic(root, mode);
  const bars = groupByBar(state.notes);
  return { root, mode, diatonic, bars };
}

function analyze() {
  if (state.notes.length === 0) {
    toast('먼저 멜로디를 입력해 주세요');
    return false;
  }
  const { root, mode, diatonic, bars } = getContext();
  state.chordCandidates = recommendTopAll(bars, diatonic, 3);
  state.lastRecommendations = state.chordCandidates.map((candidates) => candidates[0]);
  const avgConfidence = state.lastRecommendations.reduce((s, r) => s + r.confidence, 0) / state.lastRecommendations.length;
  const summary = `${root} ${mode === 'major' ? '장조' : '단조'} · ${bars.length}마디 분석 완료 · 평균 추천도 ${Math.round(avgConfidence * 100)}%`;
  setText('resultSummary', summary);
  renderRecommendations();
  const drawer = $('candidatesDrawer');
  if (drawer) {
    drawer.hidden = false;
    drawer.open = true;
  }
  updateStats(state.notes, state.lastRecommendations);
  toast('AI 코드 후보 추천 완료');
  return true;
}

function chooseChordCandidate(barIndex, candidateIndex) {
  const candidates = state.chordCandidates[barIndex];
  if (!candidates || !candidates[candidateIndex]) return;
  state.lastRecommendations[barIndex] = candidates[candidateIndex];
  renderRecommendations();
  updateStats(state.notes, state.lastRecommendations);
  toast(`${barIndex + 1}마디 코드를 선택했습니다`);
}

function restoreChordChoices(choices) {
  let changed = false;
  (Array.isArray(choices) ? choices : []).forEach(({ bar, rootPc, quality }) => {
    const candidates = state.chordCandidates[bar];
    const next = candidates?.find((item) => item.chord.rootPc === rootPc && item.chord.quality === quality);
    const current = state.lastRecommendations[bar];
    if (!next || (current && current.chord.rootPc === rootPc && current.chord.quality === quality)) return;
    state.lastRecommendations[bar] = next;
    changed = true;
  });
  if (!changed) return;
  renderRecommendations();
  updateStats(state.notes, state.lastRecommendations);
}

function makeProgression() {
  if (state.notes.length === 0) {
    toast('멜로디를 먼저 입력해 주세요');
    return false;
  }
  state.pattern = $('progressionSelect').value;
  const { root, mode, diatonic, bars } = getContext();
  state.lastRecommendations = buildProgression(bars, diatonic, state.pattern);
  state.chordCandidates = [];
  const summary = `${root} ${mode === 'major' ? '장조' : '단조'} · ${PROGRESSIONS_LABEL(state.pattern)} 진행 적용`;
  setText('resultSummary', summary);
  renderRecommendations();
  updateStats(state.notes, state.lastRecommendations);
  toast('코드 진행 적용 완료');
  return true;
}

function PROGRESSIONS_LABEL(key) {
  return PROGRESSION_LABELS[key] || '';
}

function preferredOctave() {
  const melodicNotes = state.notes.filter((n) => !n.rest);
  const last = melodicNotes[melodicNotes.length - 1];
  return last && Number.isFinite(last.octave) ? Math.max(3, Math.min(5, last.octave)) : 4;
}

function appendSuggestedMelody() {
  if (state.notes.length === 0) {
    toast('먼저 건반으로 씨앗 멜로디를 입력해 주세요');
    return;
  }
  state.pattern = $('progressionSelect').value;
  const { root, mode, diatonic, bars } = getContext();
  const draftBars = bars.concat([[], []]);
  const futureChords = buildProgression(draftBars, diatonic, state.pattern).slice(bars.length, bars.length + 2);
  const startBar = bars.length + 1;
  const octave = preferredOctave();

  futureChords.forEach((rec, barOffset) => {
    const chordPcs = rec.chord.intervals.map((iv) => (rec.chord.rootPc + iv) % 12);
    const melodicShape = [0, 2, 1, 2];
    melodicShape.forEach((chordIndex, beat) => {
      const pc = chordPcs[chordIndex % chordPcs.length];
      const pitch = noteName(pc);
      const note = makeNote({
        pc,
        pitch,
        octave,
        duration: 1,
        bar: startBar + barOffset,
        beat,
      });
      state.notes.push(note);
      state.history.push({ type: 'ai-draft', note });
    });
  });

  textSource = 'piano';
  const allBars = groupByBar(state.notes);
  state.lastRecommendations = buildProgression(allBars, diatonic, state.pattern);
  state.chordCandidates = [];
  refreshMelodyUi();
  setText('resultSummary', `${root} ${mode === 'major' ? '장조' : '단조'} · 코드 기반 2마디 멜로디 초안 추가`);
  toast('AI 연결 전: 코드 기반 멜로디 초안을 추가했습니다');
}

async function play() {
  if (state.notes.length === 0) {
    toast('재생할 멜로디가 없습니다');
    return;
  }
  if (!state.lastRecommendations.length && !analyze()) {
    return;
  }
  const bpm = Number($('bpmInput').value) || 96;
  const pattern = state.accompaniment;
  toast(`재생 시작 (${ACCOMPANIMENT[pattern].label})`);
  await playSequence(state.notes, state.lastRecommendations, { bpm, pattern, onEnd: () => toast('재생 완료') });
}

function stop() {
  stopSequence();
  toast('정지');
}

function undo() {
  if (state.notes.length === 0) {
    toast('되돌릴 노트가 없습니다');
    return;
  }
  state.notes.pop();
  state.lastRecommendations = [];
  state.chordCandidates = [];
  textSource = 'piano';
  refreshMelodyUi();
}

function clearMelody() {
  state.notes = [];
  state.lastRecommendations = [];
  state.chordCandidates = [];
  textSource = 'piano';
  refreshMelodyUi();
  setText('resultSummary', '아래 피아노를 눌러 멜로디를 입력하세요.');
  renderChordStrip($('chordStrip'), []);
  renderMelodyScore($('melodyScore'), []);
  renderMiniMelody($('miniMelody'), []);
  renderMiniChords($('miniChords'), []);
  renderChordCandidates($('chordCandidates'), [], {});
  const drawer = $('candidatesDrawer');
  if (drawer) {
    drawer.hidden = true;
    drawer.open = false;
  }
  renderEmptyHint();
  updateStats([], []);
  toast('멜로디를 지웠습니다');
}

function loadSample() {
  const input = $('melodyInput');
  input.value = SAMPLE_MELODY;
  textSource = 'text';
  syncFromText();
  textSource = 'piano';
  toast('예시 멜로디를 불러왔습니다');
}

function exportPng() {
  const url = exportMelodyPng($('melodyScore'));
  if (!url) {
    toast('내보낼 악보가 없습니다');
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = '238-music-composer-melody.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('악보 SVG 다운로드 시작');
}

function attachEvents() {
  pianoRef = mountPiano($('piano'), $('pianoLabel'), {
    onKeyPress: pushNote,
  });

  $('melodyInput').addEventListener('input', () => {
    textSource = 'text';
    if (textDebounce) clearTimeout(textDebounce);
    textDebounce = window.setTimeout(() => {
      syncFromText();
      textSource = 'piano';
    }, 250);
  });
  $('melodyInput').addEventListener('focus', () => { textSource = 'text'; });
  $('melodyInput').addEventListener('blur', () => { textSource = 'piano'; });

  $('analyzeButton').addEventListener('click', analyze);
  $('progressionButton').addEventListener('click', makeProgression);
  $('playButton').addEventListener('click', play);
  $('stopButton').addEventListener('click', stop);
  $('undoButton').addEventListener('click', undo);
  $('clearMelodyButton').addEventListener('click', clearMelody);
  $('sampleButton').addEventListener('click', loadSample);
  $('melodyAiButton').addEventListener('click', appendSuggestedMelody);
  $('exportButton') && $('exportButton').addEventListener('click', exportPng);
  document.addEventListener('composer:restore-chord-choices', (event) => {
    restoreChordChoices(event.detail?.choices);
  });

  document.querySelectorAll('[data-accompaniment]').forEach((button) => {
    button.addEventListener('click', () => setAccompaniment(button.dataset.accompaniment));
  });

  $('progressionSelect').addEventListener('change', (e) => {
    state.pattern = e.target.value;
  });

  const patternSelect = $('patternSelect');
  if (patternSelect) {
    setAccompaniment(patternSelect.value || state.accompaniment, { announce: false });
    patternSelect.addEventListener('change', (e) => setAccompaniment(e.target.value));
  }
}

function init() {
  attachEvents();
  renderMelodyScore($('melodyScore'), []);
  renderChordStrip($('chordStrip'), []);
  renderMiniMelody($('miniMelody'), []);
  renderMiniChords($('miniChords'), []);
  renderChordCandidates($('chordCandidates'), [], {});
  const drawer = $('candidatesDrawer');
  if (drawer) {
    drawer.hidden = true;
    drawer.open = false;
  }
  renderEmptyHint();
  updateStats([], []);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
