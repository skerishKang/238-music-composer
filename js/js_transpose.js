// js_transpose.js — 멜로디와 선택 코드 진행 전조
// 500줄 이내 유지

import { buildMelodyText, normalizeRoot, noteName, parseMelody, rootPc } from './js_theory.js';

const $ = (id) => document.getElementById(id);

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

function currentChordChoices(delta) {
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
    return {
      ...note,
      midi,
      pc,
      pitch: noteName(pc),
      octave: Math.floor(midi / 12) - 1,
      token: `${noteName(pc)}${Math.floor(midi / 12) - 1}:${note.duration}`,
    };
  });
}

function restoreChoices(choices) {
  $('analyzeButton')?.click();
  choices.forEach((choice) => {
    document.dispatchEvent(new CustomEvent('composer:set-manual-chord', { detail: choice }));
  });
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

  const choices = currentChordChoices(delta);
  input.value = buildMelodyText(shiftNotes(parsed.notes, delta));
  input.dispatchEvent(new Event('input', { bubbles: true }));
  rootSelect.dataset.compositionRoot = target;
  window.setTimeout(() => restoreChoices(choices), 280);
  showToast(`${source} → ${target}로 전조했습니다`);
}

function ensureButton() {
  const rootSelect = $('rootSelect');
  if (!rootSelect || $('transposeButton')) return;
  rootSelect.dataset.compositionRoot = normalizeRoot(rootSelect.value);
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'transposeButton';
  button.className = 'ghost-button';
  button.textContent = '전조 적용';
  button.title = '현재 멜로디와 선택 코드를 조성에 맞춰 이동합니다';
  rootSelect.insertAdjacentElement('afterend', button);
  button.addEventListener('click', transpose);
  rootSelect.addEventListener('change', () => {
    if (!$('melodyInput')?.value.trim()) rootSelect.dataset.compositionRoot = normalizeRoot(rootSelect.value);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', ensureButton);
} else {
  ensureButton();
}
