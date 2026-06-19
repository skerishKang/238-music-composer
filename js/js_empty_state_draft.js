// js_empty_state_draft.js — 빈 악보에서 규칙 기반 멜로디 초안 시작
// 500줄 이내 유지

import { buildDiatonic, buildProgression, noteName, normalizeRoot } from './js_theory.js';

const $ = (id) => document.getElementById(id);
let toastTimer = null;

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function buildBar(chord, shape, octave = 4) {
  const pcs = chord.intervals.map((interval) => (chord.rootPc + interval) % 12);
  return shape
    .map((index) => `${noteName(pcs[index % pcs.length])}${octave}:q`)
    .join(' ');
}

function buildStarterMelody() {
  const root = normalizeRoot($('rootSelect')?.value || 'C');
  const mode = $('modeSelect')?.value || 'major';
  const pattern = $('progressionSelect')?.value || 'pop';
  const diatonic = buildDiatonic(root, mode);
  const chords = buildProgression([[], []], diatonic, pattern).slice(0, 2);
  const shapes = [[0, 1, 2, 1], [2, 1, 0, 0]];

  return {
    root,
    mode,
    text: chords.map((recommendation, index) => buildBar(
      recommendation.chord,
      shapes[index] || shapes[0],
    )).join(' | '),
  };
}

function startFromEmptyState(event) {
  const trigger = event.target.closest('#melodyAiButton');
  const input = $('melodyInput');
  if (!trigger || !input || input.value.trim()) return;

  // 기존 app의 "씨앗 멜로디 필요" 처리보다 먼저 실행한다.
  event.preventDefault();
  event.stopImmediatePropagation();

  const draft = buildStarterMelody();
  input.value = draft.text;
  input.dispatchEvent(new Event('input', { bubbles: true }));

  const summary = $('resultSummary');
  if (summary) {
    summary.textContent = `${draft.root} ${draft.mode === 'minor' ? '단조' : '장조'} · 규칙 기반 2마디 멜로디 초안 생성`;
  }

  window.setTimeout(() => {
    if (input.value === draft.text) $('analyzeButton')?.click();
  }, 320);
  window.setTimeout(() => showToast('규칙 기반 2마디 멜로디 초안을 만들었습니다'), 380);
}

function keepHiddenDrawerClosed() {
  const drawer = $('candidatesDrawer');
  if (!drawer) return;
  const closeWhenHidden = () => {
    if (drawer.hidden && drawer.open) drawer.open = false;
  };
  new MutationObserver(closeWhenHidden).observe(drawer, {
    attributes: true,
    attributeFilter: ['hidden'],
  });
  closeWhenHidden();
}

document.addEventListener('click', startFromEmptyState, true);
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', keepHiddenDrawerClosed);
} else {
  keepHiddenDrawerClosed();
}
