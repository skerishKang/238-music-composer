// js_app.js — 진입점: 피아노 + 멜로디 + 코드 추천 + 악보 + 재생
// 500줄 이내 유지

import {
  parseMelody, buildMelodyText, buildDiatonic, recommendAll, buildProgression,
  groupByBar, PROGRESSION_LABELS, normalizeRoot,
} from './js_theory.js';
import { mountPiano } from './js_piano.js';
import { renderMelodyScore, renderChordScore, renderChordStrip, exportMelodyPng } from './js_score.js';
import { playSequence, stopSequence, previewNote } from './js_audio.js';
import { toast, updateStats, renderChordGridWithMelody, renderMiniMelody, renderMiniChords } from './js_ui.js';

const SAMPLE_MELODY = 'C4:q E4:e G4:e | A4:q G4:e E4:e | F4:h D4:h | G4:q E4:e C4:e | D4:q F4:e A4:e | G4:h E4:h | C4:w';

const state = {
  notes: [],
  lastRecommendations: [],
  history: [],
  pattern: 'pop',
  accompaniment: 'off',
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

function pushNote(noteInput) {
  // noteInput: { token, pitch, pc, duration, octave? }
  // 옥타브는 token에서 파싱
  const match = noteInput.token.match(/^([A-G][#b]?)(\d)/i);
  const octave = match ? Number(match[2]) : 4;
  const pitch = match ? match[1].toUpperCase() : noteInput.pitch;
  const dur = noteInput.duration || 1;
  const lastBar = state.notes.length ? state.notes[state.notes.length - 1].bar : 1;
  state.notes.push({
    token: `${pitch}${octave}:${formatDurToken(dur)}`,
    pc: noteInput.pc,
    pitch,
    octave,
    duration: dur,
    bar: lastBar,
    beat: 0,
  });
  state.history.push({ type: 'add', note: state.notes[state.notes.length - 1] });
  refreshMelodyUi();
  previewNote(pitch, octave, 0.35);
}

function formatDurToken(value) {
  if (value === 4) return 'w';
  if (value === 2) return 'h';
  if (value === 1) return 'q';
  if (value === 0.5) return 'e';
  if (value === 0.25) return 's';
  if (value === 0.125) return 't';
  return String(value);
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
  renderMiniMelody($('miniMelody'), state.notes);
  renderMiniChords($('miniChords'), state.lastRecommendations);
}

function syncFromText() {
  if (textSource !== 'text') return;
  const text = $('melodyInput').value;
  const parsed = parseMelody(text);
  state.notes = parsed.notes;
  if (parsed.errors.length) {
    toast(parsed.errors[0]);
  }
  updateStats(state.notes, state.lastRecommendations);
  renderMelodyScore($('melodyScore'), state.notes);
  renderMiniMelody($('miniMelody'), state.notes);
  renderMiniChords($('miniChords'), state.lastRecommendations);
}

function analyze() {
  if (state.notes.length === 0) {
    toast('먼저 멜로디를 입력해 주세요');
    return;
  }
  const root = normalizeRoot($('rootSelect').value);
  const mode = $('modeSelect').value;
  const diatonic = buildDiatonic(root, mode);
  const bars = groupByBar(state.notes);
  state.lastRecommendations = recommendAll(bars, diatonic);
  const avgConfidence = state.lastRecommendations.reduce((s, r) => s + r.confidence, 0) / state.lastRecommendations.length;
  const summary = `${root} ${mode === 'major' ? '장조' : '단조'} · ${bars.length}마디 분석 완료 · 평균 추천도 ${Math.round(avgConfidence * 100)}%`;
  setText('resultSummary', summary);
  renderChordStrip($('chordStrip'), state.lastRecommendations);
  renderMiniChords($('miniChords'), state.lastRecommendations);
  updateStats(state.notes, state.lastRecommendations);
  toast('코드 추천 완료');
}

function makeProgression() {
  if (state.notes.length === 0) {
    toast('멜로디를 먼저 입력해 주세요');
    return;
  }
  state.pattern = $('progressionSelect').value;
  const root = normalizeRoot($('rootSelect').value);
  const mode = $('modeSelect').value;
  const diatonic = buildDiatonic(root, mode);
  const bars = groupByBar(state.notes);
  state.lastRecommendations = buildProgression(bars, diatonic, state.pattern);
  const summary = `${root} ${mode === 'major' ? '장조' : '단조'} · ${PROGRESSIONS_LABEL(state.pattern)} 진행 적용`;
  setText('resultSummary', summary);
  renderChordStrip($('chordStrip'), state.lastRecommendations);
  renderMiniChords($('miniChords'), state.lastRecommendations);
  updateStats(state.notes, state.lastRecommendations);
  toast('진행 적용 완료');
}

function PROGRESSIONS_LABEL(key) {
  return PROGRESSION_LABELS[key] || '';
}

async function play() {
  if (state.notes.length === 0) {
    toast('재생할 멜로디가 없습니다');
    return;
  }
  if (!state.lastRecommendations.length) {
    analyze();
  }
  const bpm = Number($('bpmInput').value) || 96;
  const pattern = state.accompaniment;
  const labelMap = { off: '반주 없음', block: '블록 코드', arpeggio: '아르페지오', pop8: '팝 8비트', waltz: '발라드 3/4', funk16: '펑크 16비트' };
  toast(`재생 시작 (${labelMap[pattern] || pattern})`);
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
  refreshMelodyUi();
}

function clearMelody() {
  state.notes = [];
  state.lastRecommendations = [];
  refreshMelodyUi();
  setText('resultSummary', '멜로디를 입력하고 "코드 추천하기"를 눌러보세요.');
  renderChordStrip($('chordStrip'), []);
  renderMelodyScore($('melodyScore'), []);
  renderMiniMelody($('miniMelody'), []);
  renderMiniChords($('miniChords'), []);
  updateStats([], []);
  toast('멜로디를 지웠습니다');
}

function loadSample() {
  const input = $('melodyInput');
  input.value = SAMPLE_MELODY;
  textSource = 'text';
  syncFromText();
  textSource = 'piano';
  toast('샘플 멜로디를 불러왔습니다');
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
  $('exportButton') && $('exportButton').addEventListener('click', exportPng);

  const toggleTextButton = $('toggleTextButton');
  const textDrawer = $('textDrawer');
  if (toggleTextButton && textDrawer) {
    toggleTextButton.addEventListener('click', () => {
      textDrawer.open = !textDrawer.open;
    });
  }

  $('progressionSelect').addEventListener('change', (e) => {
    state.pattern = e.target.value;
  });

  const patternSelect = $('patternSelect');
  if (patternSelect) {
    state.accompaniment = patternSelect.value || 'off';
    patternSelect.addEventListener('change', (e) => {
      state.accompaniment = e.target.value;
      const labelMap = { off: '반주 끔', block: '블록 코드', arpeggio: '아르페지오', pop8: '팝 8비트', waltz: '발라드 3/4', funk16: '펑크 16비트' };
      toast(`반주: ${labelMap[state.accompaniment] || state.accompaniment}`);
    });
  }
}

function init() {
  attachEvents();
  renderMelodyScore($('melodyScore'), []);
  renderChordStrip($('chordStrip'), []);
  renderMiniMelody($('miniMelody'), []);
  renderMiniChords($('miniChords'), []);
  updateStats([], []);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
