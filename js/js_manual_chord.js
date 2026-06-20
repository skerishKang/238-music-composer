// js_manual_chord.js — 마디별 코드 직접 편집
// 500줄 이내 유지

import { noteName } from './js_theory.js';

const ROOTS = Array.from({ length: 12 }, (_, rootPc) => ({ rootPc, name: noteName(rootPc) }));
const QUALITIES = [
  { value: 'maj', label: '장화음' },
  { value: 'min', label: '단화음' },
  { value: 'dim', label: '감화음' },
  { value: 'aug', label: '증화음' },
];

const $ = (id) => document.getElementById(id);

function intervalsFor(quality) {
  if (quality === 'min') return [0, 3, 7];
  if (quality === 'dim') return [0, 3, 6];
  if (quality === 'aug') return [0, 4, 8];
  return [0, 4, 7];
}

export function createManualChordRecommendation(rootPc, quality) {
  const intervals = intervalsFor(quality);
  return {
    chord: {
      rootPc,
      rootName: noteName(rootPc),
      quality,
      roman: '직접',
      intervals,
      notes: intervals.map((interval) => noteName(rootPc + interval)),
    },
    matchCount: 0,
    passingCount: 0,
    score: 0,
    confidence: 0.5,
    manual: true,
  };
}

function option(value, label) {
  const node = document.createElement('option');
  node.value = String(value);
  node.textContent = label;
  return node;
}

function setDisabled(disabled) {
  ['manualChordBar', 'manualChordRoot', 'manualChordQuality', 'manualChordApply', 'manualChordReset'].forEach((id) => {
    const control = $(id);
    if (control) control.disabled = disabled;
  });
  const hint = $('manualChordHint');
  if (hint) hint.textContent = disabled
    ? '코드 추천 또는 코드 진행 만들기 후 사용할 수 있어요.'
    : '현재 마디의 코드를 직접 지정하거나 기본 추천으로 되돌릴 수 있어요.';
}

function syncBars() {
  const select = $('manualChordBar');
  if (!select) return;
  const count = document.querySelectorAll('#chordStrip .chord-pill').length;
  const previous = select.value;
  select.innerHTML = '';
  for (let index = 0; index < count; index += 1) {
    select.appendChild(option(index, `${index + 1}마디`));
  }
  if (count) select.value = Number(previous) < count ? previous : '0';
  setDisabled(count === 0);
}

function selectedBar() {
  const bar = Number($('manualChordBar')?.value);
  return Number.isInteger(bar) && bar >= 0 ? bar : null;
}

function applyManualChord() {
  const bar = selectedBar();
  const rootPc = Number($('manualChordRoot')?.value);
  const quality = $('manualChordQuality')?.value;
  if (bar === null || !Number.isInteger(rootPc) || !QUALITIES.some((item) => item.value === quality)) return;
  document.dispatchEvent(new CustomEvent('composer:set-manual-chord', {
    detail: { bar, rootPc, quality },
  }));
}

function resetChordChoice() {
  const bar = selectedBar();
  if (bar === null) return;
  document.dispatchEvent(new CustomEvent('composer:reset-chord-choice', {
    detail: { bar },
  }));
}

function init() {
  const rootSelect = $('manualChordRoot');
  const qualitySelect = $('manualChordQuality');
  ROOTS.forEach(({ rootPc, name }) => rootSelect?.appendChild(option(rootPc, name)));
  QUALITIES.forEach(({ value, label }) => qualitySelect?.appendChild(option(value, label)));
  $('manualChordApply')?.addEventListener('click', applyManualChord);
  $('manualChordReset')?.addEventListener('click', resetChordChoice);

  const chordStrip = $('chordStrip');
  if (chordStrip) new MutationObserver(syncBars).observe(chordStrip, { childList: true, subtree: true });
  syncBars();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
