// js_transpose.js — 멜로디와 선택 코드 진행 전조
// 500줄 이내 유지

import { buildMelodyText, normalizeRoot, noteName, parseMelody, rootPc } from './js_theory.js';

const $ = (id) => document.getElementById(id);
let compositionAnchored = false;
let transactionActive = false;
let lastTranspose = null;
let restoreGeneration = 0;

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function chordParts(label) {
  if (label.endsWith('dim')) return { root: label.slice(0, -3), quality: 'dim' };
  if (label.endsWith('aug')) return { root: label.slice(0, -3), quality: 'aug' };
  if (label.endsWith('m')) return { root: label.slice(0, -1), quality: 'min' };
  return { root: label, quality: 'maj' };
}

function currentChordChoices(delta = 0) {
  return Array.from(document.querySelectorAll('#chordStrip .chord-pill-name'))
    .map((node, bar) => {
      const { root, quality } = chordParts(node.textContent?.trim() || '');
      const sourcePc = rootPc(root);
      return sourcePc < 0 ? null : { bar, rootPc: (sourcePc + delta + 12) % 12, quality };
    })
    .filter(Boolean);
}

function shiftNotes(notes, delta) {
  return notes.map((note) => {
    if (note.rest) return note;
    const midi = Math.max(0, Math.min(127, (note.midi ?? ((note.octave + 1) * 12 + note.pc)) + delta));
    const pc = ((midi % 12) + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    return {
      ...note,
      midi,
      pc,
      pitch: noteName(pc),
      octave,
      token: `${noteName(pc)}${octave}:${note.duration}`,
    };
  });
}

function setRevertAvailability(enabled) {
  const button = $('transposeUndoButton');
  if (!button) return;
  button.disabled = !enabled;
  button.setAttribute('aria-disabled', String(!enabled));
}

function resetMelodyHistory() {
  document.dispatchEvent(new CustomEvent('composer:history-reset'));
}

function restoreChoices(snapshot, generation) {
  const input = $('melodyInput');
  const rootSelect = $('rootSelect');
  if (generation !== restoreGeneration || !input || !rootSelect || input.value !== snapshot.melody || normalizeRoot(rootSelect.value) !== snapshot.root) return;
  transactionActive = true;
  $('analyzeButton')?.click();
  snapshot.choices.forEach((choice) => {
    document.dispatchEvent(new CustomEvent('composer:set-manual-chord', { detail: choice }));
  });
  transactionActive = false;
}

function applyCompositionSnapshot(snapshot, message) {
  const rootSelect = $('rootSelect');
  const input = $('melodyInput');
  if (!rootSelect || !input) return;

  transactionActive = true;
  rootSelect.value = snapshot.root;
  rootSelect.dispatchEvent(new Event('change', { bubbles: true }));
  input.value = snapshot.melody;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  rootSelect.dataset.compositionRoot = snapshot.root;
  compositionAnchored = Boolean(snapshot.melody.trim());
  resetMelodyHistory();
  transactionActive = false;
  const generation = ++restoreGeneration;
  window.setTimeout(() => restoreChoices(snapshot, generation), 280);
  showToast(message);
}

function transpose() {
  const rootSelect = $('rootSelect');
  const input = $('melodyInput');
  if (!rootSelect || !input) return;
  const parsed = parseMelody(input.value);
  if (!parsed.notes.length || parsed.errors.length) {
    showToast(parsed.errors[0] || '전조할 멜로디가 없습니다');
    return;
  }

  const target = normalizeRoot(rootSelect.value);
  const source = normalizeRoot(rootSelect.dataset.compositionRoot || target);
  const delta = rootPc(target) - rootPc(source);
  if (!delta) {
    showToast('이미 선택한 조성입니다');
    return;
  }

  const before = { root: source, melody: input.value, choices: currentChordChoices() };
  const after = {
    root: target,
    melody: buildMelodyText(shiftNotes(parsed.notes, delta)),
    choices: currentChordChoices(delta),
  };
  lastTranspose = before;
  setRevertAvailability(true);
  applyCompositionSnapshot(after, `${source} → ${target}로 전조했습니다`);
}

function revertTranspose() {
  if (!lastTranspose) {
    showToast('원복할 전조가 없습니다');
    return;
  }
  const before = lastTranspose;
  lastTranspose = null;
  setRevertAvailability(false);
  applyCompositionSnapshot(before, `${before.root} 조성으로 전조를 원복했습니다`);
}

function clearStaleRevert() {
  if (transactionActive) return;
  restoreGeneration += 1;
  if (!lastTranspose) return;
  lastTranspose = null;
  setRevertAvailability(false);
}

function ensureButton() {
  const rootSelect = $('rootSelect');
  const input = $('melodyInput');
  if (!rootSelect || !input || $('transposeButton')) return;
  rootSelect.dataset.compositionRoot = normalizeRoot(rootSelect.value);
  compositionAnchored = Boolean(input.value.trim());

  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'transposeButton';
  button.className = 'ghost-button';
  button.textContent = '전조 적용';
  button.title = '현재 멜로디와 선택 코드를 조성에 맞춰 이동합니다';
  rootSelect.insertAdjacentElement('afterend', button);

  const undoButton = document.createElement('button');
  undoButton.type = 'button';
  undoButton.id = 'transposeUndoButton';
  undoButton.className = 'ghost-button';
  undoButton.textContent = '전조 원복';
  undoButton.title = '마지막 전조 전의 멜로디·조성·코드를 한 번에 되돌립니다';
  undoButton.disabled = true;
  undoButton.setAttribute('aria-disabled', 'true');
  button.insertAdjacentElement('afterend', undoButton);

  button.addEventListener('click', transpose);
  undoButton.addEventListener('click', revertTranspose);

  const anchorComposition = () => {
    if (!compositionAnchored && input.value.trim()) {
      rootSelect.dataset.compositionRoot = normalizeRoot(rootSelect.value);
      compositionAnchored = true;
    }
  };
  input.addEventListener('input', () => {
    anchorComposition();
    clearStaleRevert();
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && event.target.closest('.piano-key, .piano-black')) {
      anchorComposition();
      clearStaleRevert();
    }
  }, true);
  document.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('.chord-candidate, #manualChordApply, #manualChordReset, #analyzeButton, #progressionButton')) clearStaleRevert();
  }, true);
  rootSelect.addEventListener('change', () => {
    if (!transactionActive) clearStaleRevert();
    if (!input.value.trim()) {
      rootSelect.dataset.compositionRoot = normalizeRoot(rootSelect.value);
      compositionAnchored = false;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureButton);
} else {
  ensureButton();
}
