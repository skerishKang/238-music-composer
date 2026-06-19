// js_project_file.js — 작곡 프로젝트 파일 내보내기·불러오기
// 500줄 이내 유지

import { parseMelody } from './js_theory.js';

const PROJECT_FORMAT = '238-music-composer-project';
const PROJECT_VERSION = 1;
const MAX_FILE_SIZE = 1024 * 1024;
const MAX_MELODY_LENGTH = 20000;
const CHORD_QUALITIES = new Set(['maj', 'min', 'dim', 'aug']);

const $ = (id) => document.getElementById(id);
let toastTimer = null;

function setStatus(message, tone = 'neutral') {
  const status = $('saveStatus');
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function notify(message) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimer) window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2400);
}

function readSelectedChordChoices() {
  const selected = Array.from(document.querySelectorAll('.chord-candidate.is-selected'));
  if (!selected.length) return [];

  const choices = [];
  let hasAlternate = false;
  for (const button of selected) {
    const barIndex = Number(button.dataset.barIndex);
    const candidateIndex = Number(button.dataset.candidateIndex);
    const rootPc = Number(button.dataset.chordRootPc);
    const quality = button.dataset.chordQuality;
    if (!Number.isInteger(barIndex) || barIndex < 0 || !Number.isInteger(rootPc) || !CHORD_QUALITIES.has(quality)) {
      return [];
    }
    choices[barIndex] = { rootPc, quality };
    hasAlternate ||= candidateIndex > 0;
  }

  const complete = choices.length && Array.from(
    { length: choices.length },
    (_, index) => Boolean(choices[index]),
  ).every(Boolean);
  return complete && hasAlternate ? choices : [];
}

function readProject() {
  return {
    melody: $('melodyInput')?.value || '',
    settings: {
      root: $('rootSelect')?.value || 'C',
      mode: $('modeSelect')?.value || 'major',
      bpm: $('bpmInput')?.value || '96',
      progression: $('progressionSelect')?.value || 'pop',
      accompaniment: $('patternSelect')?.value || 'arpeggio',
    },
    selectedChordChoices: readSelectedChordChoices(),
  };
}

function hasOption(id, value) {
  const select = $(id);
  return Array.from(select?.options || []).some((option) => option.value === String(value));
}

function normalizeBpm(value) {
  const bpm = Math.round(Number(value));
  if (!Number.isFinite(bpm) || bpm < 40 || bpm > 220) {
    throw new Error('BPM 값이 올바르지 않습니다.');
  }
  return String(bpm);
}

function validateMelody(melody) {
  if (!melody.trim()) return parseMelody('');
  const parsed = parseMelody(melody);
  if (parsed.errors.length) {
    throw new Error('프로젝트 안의 멜로디 형식을 확인해 주세요.');
  }
  return parsed;
}

function normalizeSelectedChordChoices(value, bars) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new Error('저장된 코드 선택 정보를 확인해 주세요.');
  }
  if (value.length === 0) return [];
  if (value.length !== bars) {
    throw new Error('저장된 코드 선택의 마디 수가 맞지 않습니다.');
  }
  return value.map((choice) => {
    if (!choice || !Number.isInteger(choice.rootPc) || choice.rootPc < 0 || choice.rootPc > 11
      || !CHORD_QUALITIES.has(choice.quality)) {
      throw new Error('저장된 코드 후보 정보를 확인해 주세요.');
    }
    return { rootPc: choice.rootPc, quality: choice.quality };
  });
}

function parseProject(rawText) {
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch (_) {
    throw new Error('JSON 형식의 프로젝트 파일이 아닙니다.');
  }

  if (!payload || payload.format !== PROJECT_FORMAT || payload.version !== PROJECT_VERSION) {
    throw new Error('지원하지 않는 프로젝트 파일입니다.');
  }

  const project = payload.project;
  const settings = project?.settings;
  if (!project || typeof project.melody !== 'string' || !settings) {
    throw new Error('프로젝트 내용이 완전하지 않습니다.');
  }
  if (project.melody.length > MAX_MELODY_LENGTH) {
    throw new Error('멜로디가 너무 길어 불러올 수 없습니다.');
  }
  if (!hasOption('rootSelect', settings.root) || !hasOption('modeSelect', settings.mode)) {
    throw new Error('지원하지 않는 조성 또는 모드입니다.');
  }
  if (!hasOption('progressionSelect', settings.progression) || !hasOption('patternSelect', settings.accompaniment)) {
    throw new Error('지원하지 않는 진행 또는 반주입니다.');
  }
  if (!project.melody.trim() && project.selectedChordChoices?.length) {
    throw new Error('빈 멜로디에는 코드 선택을 저장할 수 없습니다.');
  }
  const parsed = validateMelody(project.melody);

  return {
    melody: project.melody,
    settings: {
      root: String(settings.root),
      mode: String(settings.mode),
      bpm: normalizeBpm(settings.bpm),
      progression: String(settings.progression),
      accompaniment: String(settings.accompaniment),
    },
    selectedChordChoices: normalizeSelectedChordChoices(project.selectedChordChoices, parsed.bars),
  };
}

function setControl(id, value) {
  const control = $(id);
  if (!control) return;
  control.value = value;
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function restoreSelectedChordChoices(project) {
  if (!project.selectedChordChoices.length) return;
  const input = $('melodyInput');
  window.setTimeout(() => {
    if (!input || input.value !== project.melody) return;
    $('analyzeButton')?.click();
    project.selectedChordChoices.forEach((choice, barIndex) => {
      document.querySelector(
        `.chord-candidate[data-bar-index="${barIndex}"][data-chord-root-pc="${choice.rootPc}"][data-chord-quality="${choice.quality}"]`,
      )?.click();
    });
    notify('프로젝트 파일을 불러왔습니다');
  }, 360);
}

function applyProject(project) {
  setControl('rootSelect', project.settings.root);
  setControl('modeSelect', project.settings.mode);
  setControl('bpmInput', project.settings.bpm);
  setControl('progressionSelect', project.settings.progression);
  setControl('patternSelect', project.settings.accompaniment);

  const melodyInput = $('melodyInput');
  if (melodyInput) {
    melodyInput.value = project.melody;
    melodyInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  restoreSelectedChordChoices(project);
  setStatus('프로젝트 불러옴', 'restored');
  notify('프로젝트 파일을 불러왔습니다');
}

function downloadProject() {
  let project;
  try {
    project = parseProject(JSON.stringify({
      format: PROJECT_FORMAT,
      version: PROJECT_VERSION,
      project: readProject(),
    }));
  } catch (error) {
    notify(error?.message || '현재 작업을 저장할 수 없습니다.');
    return;
  }

  const payload = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    project,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  link.href = url;
  link.download = `238-music-project-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('프로젝트 파일을 저장했습니다');
}

async function importProject(event) {
  const input = event.target;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) {
    notify('프로젝트 파일은 1MB 이하만 불러올 수 있습니다');
    return;
  }

  try {
    const project = parseProject(await file.text());
    applyProject(project);
  } catch (error) {
    notify(error?.message || '프로젝트 파일을 읽을 수 없습니다.');
  }
}

function initProjectFileTools() {
  $('projectExportButton')?.addEventListener('click', downloadProject);
  $('projectImportButton')?.addEventListener('click', () => $('projectImportInput')?.click());
  $('projectImportInput')?.addEventListener('change', importProject);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProjectFileTools);
} else {
  initProjectFileTools();
}
