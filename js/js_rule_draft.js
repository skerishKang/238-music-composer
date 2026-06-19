// js_rule_draft.js — 빈 작업용 규칙 기반 2마디 멜로디 초안
// 500줄 이내 유지

import { buildDiatonic, buildProgression, normalizeRoot, noteName } from './js_theory.js';

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

function createSeedMelodyText() {
  const root = normalizeRoot($('rootSelect')?.value || 'C');
  const mode = $('modeSelect')?.value || 'major';
  const pattern = $('progressionSelect')?.value || 'pop';
  const diatonic = buildDiatonic(root, mode);
  const chords = buildProgression([[], []], diatonic, pattern).slice(0, 2);
  const shapes = [[0, 1, 2, 1], [2, 1, 0, 0]];

  return chords.map((recommendation, barIndex) => {
    const chordPcs = recommendation.chord.intervals
      .map((interval) => (recommendation.chord.rootPc + interval) % 12);
    const shape = shapes[barIndex] || shapes[0];
    return shape.map((index) => `${noteName(chordPcs[index % chordPcs.length])}4:q`).join(' ');
  }).join(' | ');
}

function applySeedDraft() {
  const input = $('melodyInput');
  if (!input || input.value.trim()) return;

  const root = normalizeRoot($('rootSelect')?.value || 'C');
  const mode = $('modeSelect')?.value || 'major';
  const draftText = createSeedMelodyText();
  input.value = draftText;
  input.dispatchEvent(new Event('input', { bubbles: true }));

  const summary = $('resultSummary');
  if (summary) {
    summary.textContent = `${root} ${mode === 'minor' ? '단조' : '장조'} · 규칙 기반 2마디 멜로디 초안 생성`;
  }

  window.setTimeout(() => {
    if (input.value === draftText) $('analyzeButton')?.click();
  }, 280);
  window.setTimeout(() => showToast('규칙 기반 2마디 멜로디 초안을 만들었습니다'), 340);
}

function interceptEmptyDraftClick(event) {
  const button = event.target.closest('#melodyAiButton');
  const input = $('melodyInput');
  if (!button || !input || input.value.trim()) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  applySeedDraft();
}

function initRuleDraft() {
  document.addEventListener('click', interceptEmptyDraftClick, true);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRuleDraft);
} else {
  initRuleDraft();
}
