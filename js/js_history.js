// js_history.js — 멜로디 되돌리기·다시 실행 상태 관리
// 500줄 이내 유지

function setDisabled(button, disabled) {
  if (!button) return;
  button.disabled = disabled;
  button.setAttribute('aria-disabled', String(disabled));
}

function isTextField(target) {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches('input, textarea, select') || target.isContentEditable;
}

export function mountMelodyHistory({
  undoButton,
  redoButton,
  getSnapshot,
  restoreSnapshot,
  limit = 80,
}) {
  const undoStack = [];
  const redoStack = [];

  function updateControls() {
    setDisabled(undoButton, undoStack.length === 0);
    setDisabled(redoButton, redoStack.length === 0);
  }

  function checkpoint() {
    const snapshot = getSnapshot();
    if (undoStack.at(-1) === snapshot) return false;
    undoStack.push(snapshot);
    if (undoStack.length > limit) undoStack.shift();
    redoStack.length = 0;
    updateControls();
    return true;
  }

  function undo() {
    if (!undoStack.length) return false;
    const current = getSnapshot();
    const previous = undoStack.pop();
    if (redoStack.at(-1) !== current) redoStack.push(current);
    restoreSnapshot(previous, 'undo');
    updateControls();
    return true;
  }

  function redo() {
    if (!redoStack.length) return false;
    const current = getSnapshot();
    const next = redoStack.pop();
    if (undoStack.at(-1) !== current) undoStack.push(current);
    restoreSnapshot(next, 'redo');
    updateControls();
    return true;
  }

  undoButton?.addEventListener('click', undo);
  redoButton?.addEventListener('click', redo);
  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing || isTextField(event.target)) return;
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
    const handled = event.shiftKey ? redo() : undo();
    if (handled) event.preventDefault();
  });

  updateControls();
  return { checkpoint, updateControls };
}
