// js_autosave.js — 멜로디·설정 브라우저 자동 저장
// 500줄 이내 유지

const STORAGE_KEY = '238-music-composer:autosave:v1';
const WATCHED_IDS = ['melodyInput', 'rootSelect', 'modeSelect', 'bpmInput', 'progressionSelect', 'patternSelect'];

const $ = (id) => document.getElementById(id);
let lastSnapshot = '';
let saveTimer = null;

function setStatus(message, tone = 'neutral') {
  const status = $('saveStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function readProject() {
  return {
    version: 1,
    melody: $('melodyInput')?.value || '',
    root: $('rootSelect')?.value || 'C',
    mode: $('modeSelect')?.value || 'major',
    bpm: $('bpmInput')?.value || '96',
    progression: $('progressionSelect')?.value || 'pop',
    accompaniment: $('patternSelect')?.value || 'arpeggio',
  };
}

function snapshotProject() {
  return JSON.stringify(readProject());
}

function validStoredProject(value) {
  return value
    && value.version === 1
    && typeof value.melody === 'string'
    && typeof value.root === 'string'
    && typeof value.mode === 'string'
    && typeof value.bpm === 'string'
    && typeof value.progression === 'string'
    && typeof value.accompaniment === 'string';
}

function setControlValue(id, value) {
  const control = $(id);
  if (!control || value === undefined || value === null) return;
  const allowed = Array.from(control.options || []).some((option) => option.value === String(value));
  if (control.tagName === 'SELECT' && !allowed) return;
  control.value = String(value);
}

function restoreProject() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!validStoredProject(saved)) return false;

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

    lastSnapshot = snapshotProject();
    setStatus(saved.melody.trim() ? '저장된 작업 불러옴' : '저장된 설정 불러옴', 'restored');
    return true;
  } catch (_) {
    setStatus('저장된 작업을 읽을 수 없습니다', 'warning');
    return false;
  }
}

function saveNow() {
  saveTimer = null;
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
  if (saveTimer) window.clearTimeout(saveTimer);
  setStatus('저장 중…', 'saving');
  saveTimer = window.setTimeout(saveNow, 320);
}

function flushSave() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = null;
  saveNow();
}

function detectProgrammaticChanges() {
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
