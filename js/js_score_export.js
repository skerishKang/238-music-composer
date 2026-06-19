// js_score_export.js — 현재 멜로디와 선택 코드 진행을 완성 악보 SVG로 내보내기
// 500줄 이내 유지

import { exportCompleteScoreSvg } from './js_score.js';

const $ = (id) => document.getElementById(id);

function showToast(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function readSelectedChords() {
  return Array.from(document.querySelectorAll('#chordStrip .chord-pill'))
    .map((pill) => ({
      chord: {
        rootName: pill.querySelector('.chord-pill-name')?.textContent?.trim() || '',
        quality: '',
        roman: pill.querySelector('.chord-pill-roman')?.textContent?.trim() || '',
      },
    }))
    .filter((rec) => rec.chord.rootName);
}

function progressionLabel() {
  return $('progressionSelect')?.selectedOptions?.[0]?.textContent?.trim() || '';
}

function downloadSvg(url) {
  const link = document.createElement('a');
  link.href = url;
  link.download = '238-music-composer-complete-score.svg';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCompleteScore() {
  const scoreHost = $('melodyScore');
  if (!scoreHost?.querySelector('svg')) {
    showToast('내보낼 멜로디 악보가 없습니다');
    return;
  }

  let recommendations = readSelectedChords();
  if (!recommendations.length) {
    $('analyzeButton')?.click();
    recommendations = readSelectedChords();
  }
  if (!recommendations.length) {
    showToast('코드 추천을 먼저 실행해 주세요');
    return;
  }

  const url = exportCompleteScoreSvg(scoreHost, recommendations, {
    root: $('rootSelect')?.value || '',
    mode: $('modeSelect')?.value || '',
    bpm: $('bpmInput')?.value || '',
    progression: progressionLabel(),
  });
  if (!url) {
    showToast('완성 악보를 만들 수 없습니다');
    return;
  }
  downloadSvg(url);
  showToast('완성 악보 SVG 다운로드 시작');
}

function init() {
  $('exportScoreButton')?.addEventListener('click', exportCompleteScore);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
