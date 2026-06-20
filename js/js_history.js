// js_history.js — 멜로디 되돌리기·다시 실행
// 500줄 이내 유지

const HISTORY_LIMIT = 80;
const PIANO_KEYS = '.piano-key, .piano-black';
const ONE_STEP_ACTIONS = '#melodyAiButton, #clearMelodyButton, #sampleButton';
const PIANO_SHORTCUTS = new Set(['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'w', 'e', 't', 'y', 'u', 'o', 'p']);

const $ = (id) => document.getElementById(id);
let undoStack = [];
let redoStack = [];
let baseline = '';
let pendingSnapshot = null;
let settleTimer = null;
let toastTimer = null;
let restoringInput = false;

function isTextField(target) {
  return target instanceof HTMLElement
    && (target.matches('input, textarea, select') || target.isContentEditable);
}

function setDisabled(button, disabled) {
  if (!button) return;
  button.disabled = disabled;
  button.setAttribute('aria-disabled', String(disabled));
}

function updateControls() {
  setDisabled($('undoButton'), undoStack.length === 0);
  setDisabled($('redoButton'), redoStack.length === 0);
}

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function currentText() {
  return $('melodyInput')?.value || '';
}

function pushUndo(snapshot) {
  if (undoStack.at(-1) === snapshot) return;
  undoStack.push(snapshot);
  if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
  redoStack = [];
}

function commitPending() {
  if (pendingSnapshot === null) return;
  const next = currentText();
  if (next !== pendingSnapshot) pushUndo(pendingSnapshot);
  baseline = next;
  pendingSnapshot = null;
  updateControls();
}

function scheduleCommit(delay = 0) {
  if (settleTimer) window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(commitPending, delay);
}

function beginChange(delay = 0) {
  if (restoringInput) return;
  commitPending();
  pendingSnapshot = baseline;
  scheduleCommit(delay);
}

function beginTextChange() {
  if (restoringInput) return;
  if (pendingSnapshot === null) pendingSnapshot = baseline;
  scheduleCommit(320);
}

function resetCompositionHistory() {
  if (settleTimer) window.clearTimeout(settleTimer);
  settleTimer = null;
  pendingSnapshot = null;
  baseline = currentText();
  undoStack = [];
  redoStack = [];
  updateControls();
}

function applySnapshot(snapshot, direction) {
  const input = $('melodyInput');
  restoringInput = true;
  if (input) {
    input.value = snapshot;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  restoringInput = false;
  baseline = snapshot;
  pendingSnapshot = null;
  const summary = $('resultSummary');
  if (summary) {
    summary.textContent = direction === 'undo'
      ? '이전 멜로디로 되돌렸습니다.'
      : '되돌린 멜로디를 다시 적용했습니다.';
  }
  showToast(direction === 'undo' ? '되돌리기' : '다시 실행');
}

function undo() {
  commitPending();
  if (!undoStack.length) return;
  const current = currentText();
  const previous = undoStack.pop();
  if (redoStack.at(-1) !== current) redoStack.push(current);
  applySnapshot(previous, 'undo');
  updateControls();
}

function redo() {
  commitPending();
  if (!redoStack.length) return;
  const current = currentText();
  const next = redoStack.pop();
  if (undoStack.at(-1) !== current) undoStack.push(current);
  applySnapshot(next, 'redo');
  updateControls();
}

function isPianoShortcut(event) {
  return !event.ctrlKey && !event.metaKey
    && !isTextField(event.target) && PIANO_SHORTCUTS.has(event.key.toLowerCase());
}

function isPianoEvent(event) {
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(target?.closest(PIANO_KEYS));
}

function init() {
  baseline = currentText();
  updateControls();

  document.addEventListener('pointerdown', (event) => {
    if (isPianoEvent(event)) beginChange();
  }, true);
  document.addEventListener('dblclick', (event) => {
    if (isPianoEvent(event)) beginChange();
  }, true);

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (!target) return;
    if (target.id === 'undoButton' || target.id === 'redoButton') {
      event.preventDefault();
      event.stopImmediatePropagation();
      target.id === 'undoButton' ? undo() : redo();
      return;
    }
    if (target.matches(ONE_STEP_ACTIONS)) beginChange();
  }, true);

  $('melodyInput')?.addEventListener('input', beginTextChange);
  $('projectImportInput')?.addEventListener('change', () => beginChange(500), true);
  document.addEventListener('composer:history-reset', resetCompositionHistory);

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && !isTextField(event.target)) {
      if (key === 'z') {
        event.preventDefault();
        event.stopImmediatePropagation();
        event.shiftKey ? redo() : undo();
        return;
      }
      if (key === 'y') {
        event.preventDefault();
        event.stopImmediatePropagation();
        redo();
        return;
      }
    }
    if (isPianoShortcut(event)) beginChange();
  }, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
