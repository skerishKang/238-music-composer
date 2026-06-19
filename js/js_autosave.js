// js_autosave.js — 멜로디·설정·선택 코드 브라우저 자동 저장
// 500줄 이내 유지

import { parseMelody } from './js_theory.js';

const STORAGE_KEY = '238-music-composer:autosave:v1';
const STORAGE_VERSION = 2;
const WATCHED_IDS = ['melodyInput', 'rootSelect', 'modeSelect', 'bpmInput', 'progressionSelect', 'patternSelect'];
const CHORD_QUALITIES = new Set(['maj', 'min', 'dim', 'aug']);
const CHORD_RESTORE_DELAY = 380;

const $ = (id) => document.getElementById(id);
let lastSnapshot = '';
let saveTimer = null;
let restoreTimer = null;
let restoring = false;

function setStatus(message, tone = 'neutral') {
  const status = $('saveStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function readSelectedChordChoices() {
  const choices = [];
  const selected = Array.from(document.querySelectorAll('.chord-candidate.is-selected'));

  for (const button of selected) {
    const bar = Number(button.dataset.barIndex);
    const candidateIndex = Number(button.dataset.candidateIndex);
    const rootPc = Number(button.dataset.chordRootPc);
    const quality = button.dataset.chordQuality;
    if (!Number.isInteger(bar) || bar < 0 || !Number.isInteger(rootPc)
      || rootPc < 0 || rootPc > 11 || !CHORD_QUALITIES.has(quality)) {
      return [];
    }
    if (candidateIndex > 0) choices.push({ bar, rootPc, quality });
  }

  choices.sort((left, right) => left.bar - right.bar);
  return new Set(choices.map((choice) => choice.bar)).size === choices.length ? choices : [];
}

function readProject() {
  return {
    version: STORAGE_VERSION,
    melody: $('melodyInput')?.value || '',
    root: $('rootSelect')?.value || 'C',
    mode: $('modeSelect')?.value || 'major',
    bpm: $('bpmInput')?.value || '96',
    progression: $('progressionSelect')?.value || 'pop',
    accompaniment: $('patternSelect')?.value || 'arpeggio',
    selectedChordChoices: readSelectedChordChoices(),
  };
}

function snapshotProject() {
  return JSON.stringify(readProject());
}

function validStoredProject(value) {
  return value
    && (value.version === 1 || value.version === STORAGE_VERSION)
    && typeof value.melody === 'string'
    && typeof value.root === 'string'
    && typeof value.mode === 'string'
    && typeof value.bpm === 'string'
    && typeof value.progression === 'string'
    && typeof value.accompaniment === 'string';
}

function normalizeStoredChordChoices(value, melody) {
  if (!Array.isArray(value) || value.length === 0) return [];
  const parsed = parseMelody(melody);
  if (parsed.errors.length) return [];

  const choices = value.map((choice) => {
    if (!choice || !Number.isInteger(choice.bar) || choice.bar < 0 || choice.bar >= parsed.bars
      || !Number.isInteger(choice.rootPc) || choice.rootPc < 0 || choice.rootPc > 11
      || !CHORD_QUALITIES.has(choice.quality)) {
      return null;
    }
    return { bar: choice.bar, rootPc: choice.rootPc, quality: choice.quality };
  });
  if (choices.some((choice) => choice === null)) return [];
  return new Set(choices.map((choice) => choice.bar)).size === choices.length ? choices : [];
}

function setControlValue(id, value) {
  const control = $(id);
  if (!control || value === undefined || value === null) return;
  const allowed = Array.from(control.options || []).some((option) => option.value === String(value));
  if (control.tagName === 'SELECT' && !allowed) return;
  control.value = String(value);
}

function finishRestore(saved) {
  restoring = false;
  lastSnapshot = snapshotProject();
  setStatus(saved.melody.trim() ? '저장된 작업 불러옴' : '저장된 설정 불러옴', 'restored');
}

function restoreSelectedChordChoices(saved, choices, attempt = 0) {
  const input = $('melodyInput');
  if (!input || input.value !== saved.melody) {
    finishRestore(saved);
    return;
  }

  $('analyzeButton')?.click();
  const candidatesReady = document.querySelectorAll('.chord-candidate').length > 0;
  if (!candidatesReady && attempt < 3) {
    restoreTimer = window.setTimeout(() => restoreSelectedChordChoices(saved, choices, attempt + 1), 120);
    return;
  }

  document.dispatchEvent(new CustomEvent('composer:restore-chord-choices', {
    detail: { choices },
  }));
  finishRestore(saved);
}

function restoreProject() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!validStoredProject(saved)) return false;

    restoring = true;
    setControlValue('rootSelect', saved.root);
    setControlValue('modeSelect', saved.mode);
    setControlValue('bpmInput', saved.bpm);
    setControlValue('progressionSelect', saved.progression);
    setControlValue('patternSelect', saved.accompaniment);

    const input = $('melodyInput');
    if (input) input.value = saved.melody;

    // js_app.js의 내부 상태와 맞춘다. 반주 설정과 텍스트 파싱은 기존 이벤트 경로를 재사용한다.
    $('progressionSelect')?.dispatchEvent(new Event('change', { bubbles: true }));
    $('patternSelect')?.dispatchEvent(new Event('change', { bubbles: true }));
    input?.dispatchEvent(new Event('input', { bubbles: true }));

    const choices = normalizeStoredChordChoices(saved.selectedChordChoices, saved.melody);
    if (!choices.length) {
      finishRestore(saved);
      return true;
    }

    setStatus('저장된 코드 선택 불러오는 중…', 'saving');
    restoreTimer = window.setTimeout(() => restoreSelectedChordChoices(saved, choices), CHORD_RESTORE_DELAY);
    return true;
  } catch (_) {
    restoring = false;
    setStatus('저장된 작업을 읽을 수 없습니다', 'warning');
    return false;
  }
}

function saveNow() {
  saveTimer = null;
  if (restoring) return;
  const snapshot = snapshotProject();
  if (snapshot === lastSnapshot) {
    setStatus('자동 저장됨', 'saved');
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, snapshot);
    lastSnapshot = snapshot;
    setStatus('자동 저장됨', 'saved');
  } catch (_) {
    setStatus('자동 저장을 사용할 수 없습니다', 'warning');
  }
}

function scheduleSave() {
  if (restoring) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  setStatus('저장 중…', 'saving');
  saveTimer = window.setTimeout(saveNow, 320);
}

function flushSave() {
  if (restoring) return;
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = null;
  saveNow();
}

function detectProgrammaticChanges() {
  if (restoring) return;
  const next = snapshotProject();
  if (next !== lastSnapshot) scheduleSave();
}

function initAutosave() {
  const restored = restoreProject();
  if (!restored) {
    lastSnapshot = snapshotProject();
    setStatus('이 브라우저에 자동 저장', 'neutral');
  }

  WATCHED_IDS.forEach((id) => {
    const control = $(id);
    control?.addEventListener('input', scheduleSave);
    control?.addEventListener('change', scheduleSave);
  });
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('.chord-candidate') : null;
    if (target) scheduleSave();
  });

  window.setInterval(detectProgrammaticChanges, 700);
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSave();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAutosave);
} else {
  initAutosave();
}
