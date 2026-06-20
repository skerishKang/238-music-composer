// js_history_sync_guard.js — 되돌리기 직후 앱 상태 동기화 보호막
// 500줄 이내 유지

const RESTORE_SYNC_DELAY = 340;
const HISTORY_BUTTONS = '#undoButton, #redoButton';
const BLOCKED_BUTTONS = '#melodyAiButton, #analyzeButton, #playButton, #progressionButton, #clearMelodyButton, #sampleButton, #projectImportButton';
const PIANO_KEYS = '.piano-key, .piano-black, #pianoRestButton';
const PIANO_SHORTCUTS = new Set(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'w', 'e', 't', 'y', 'u', 'o', 'p']);

const $ = (id) => document.getElementById(id);
let syncUntil = 0;
let toastTimer = null;

function isTextField(target) {
  return target instanceof HTMLElement
    && (target.matches('input, textarea, select') || target.isContentEditable);
}

function isSyncing() {
  return Date.now() < syncUntil;
}

function startSyncGuard() {
  syncUntil = Date.now() + RESTORE_SYNC_DELAY;
}

function showToast() {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = '멜로디를 동기화하고 있습니다';
  toast.classList.add('show');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function block(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  showToast();
}

function closestButton(event) {
  const target = event.target instanceof Element ? event.target : null;
  return target?.closest('button') || null;
}

function isPianoEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(target?.closest(PIANO_KEYS));
}

function isPianoShortcut(event) {
  return !event.ctrlKey && !event.metaKey
    && !isTextField(event.target) && PIANO_SHORTCUTS.has(event.key.toLowerCase());
}

window.addEventListener('click', (event) => {
  const button = closestButton(event);
  if (!button) return;
  if (button.matches(HISTORY_BUTTONS)) {
    if (isSyncing()) block(event);
    else if (!button.disabled) startSyncGuard();
    return;
  }
  if (isSyncing() && button.matches(BLOCKED_BUTTONS)) block(event);
}, true);

window.addEventListener('pointerdown', (event) => {
  if (isSyncing() && isPianoEvent(event)) block(event);
}, true);

window.addEventListener('dblclick', (event) => {
  if (isSyncing() && isPianoEvent(event)) block(event);
}, true);

window.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.isComposing) return;
  const key = event.key.toLowerCase();
  const historyShortcut = (event.ctrlKey || event.metaKey)
    && !isTextField(event.target) && (key === 'z' || key === 'y');
  if (historyShortcut) {
    if (isSyncing()) block(event);
    else startSyncGuard();
    return;
  }
  if (isSyncing() && isPianoShortcut(event)) block(event);
}, true);
