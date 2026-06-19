// js_empty_state_draft.js — 빈 악보에서 AI 멜로디 초안 시작
// 500줄 이내 유지

import { buildDiatonic, noteName, normalizeRoot } from './js_theory.js';

const $ = (id) => document.getElementById(id);

function buildBar(chord, octave = 4) {
  const pcs = chord.intervals.map((interval) => (chord.rootPc + interval) % 12);
  const shape = [0, 1, 2, 1];
  return shape
    .map((index) => `${noteName(pcs[index % pcs.length])}${octave}:q`)
    .join(' ');
}

function buildStarterMelody() {
  const root = normalizeRoot($('rootSelect')?.value || 'C');
  const mode = $('modeSelect')?.value || 'major';
  const diatonic = buildDiatonic(root, mode);
  const tonic = diatonic[0];
  const dominant = diatonic[4] || diatonic[0];
  return `${buildBar(tonic)} | ${buildBar(dominant)}`;
}

function startFromEmptyState(event) {
  const trigger = event.target.closest('#melodyAiButton');
  const input = $('melodyInput');
  if (!trigger || !input || input.value.trim()) return;

  // 기존 app의 "씨앗 멜로디 필요" 처리보다 먼저 실행한다.
  event.preventDefault();
  event.stopImmediatePropagation();

  input.value = buildStarterMelody();
  input.dispatchEvent(new Event('input', { bubbles: true }));
  window.setTimeout(() => $('analyzeButton')?.click(), 320);
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
