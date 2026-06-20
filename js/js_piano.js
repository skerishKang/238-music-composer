// js_piano.js — 피아노 건반 UI·이벤트
// 500줄 이내 유지

import { BLACK_KEYS, SHARP_NAMES, formatDuration } from './js_theory.js';

const PIANO_OCTAVES = [3, 4]; // C3 ~ B4
const WHITE_PER_OCTAVE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_PER_OCTAVE = ['C#', 'D#', 'F#', 'G#', 'A#'];
const ALLOWED_DURATIONS = new Set([0.125, 0.25, 0.5, 1, 2, 4]);
const DURATION_OPTIONS = [
  ['0.25', '16분음표'],
  ['0.5', '8분음표'],
  ['1', '4분음표'],
  ['2', '2분음표'],
  ['4', '온음표'],
];

const KEYBOARD_WHITE = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"];
const KEYBOARD_BLACK = ['w', 'e', '', 't', 'y', 'u', '', 'o', 'p', ''];

function selectedDuration(value) {
  const duration = Number(value);
  return ALLOWED_DURATIONS.has(duration) ? duration : 1;
}

function modifiedDuration(baseDuration, event) {
  if (event.altKey) return Math.min(4, baseDuration * 2);
  if (event.shiftKey || event.button === 2 || event.detail >= 2) return Math.max(0.125, baseDuration / 2);
  return baseDuration;
}

function ensureDurationControl(rootEl, labelEl) {
  const existing = document.getElementById('noteDurationSelect');
  if (existing instanceof HTMLSelectElement) return existing;

  const control = document.createElement('label');
  control.className = 'piano-duration-control';
  control.htmlFor = 'noteDurationSelect';
  const title = document.createElement('span');
  title.textContent = '건반 음 길이';
  const select = document.createElement('select');
  select.id = 'noteDurationSelect';
  select.className = 'piano-duration-select';
  select.setAttribute('aria-label', '새로 입력할 음의 길이');
  DURATION_OPTIONS.forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = value === '1';
    select.appendChild(option);
  });
  control.append(title, select);

  if (labelEl) labelEl.insertAdjacentElement('afterend', control);
  else rootEl.insertAdjacentElement('beforebegin', control);
  return select;
}

// 건반 데이터 생성
function buildKeyList() {
  const whites = [];
  const blacks = [];
  PIANO_OCTAVES.forEach((octave) => {
    WHITE_PER_OCTAVE.forEach((name) => {
      whites.push({
        pitch: name,
        octave,
        pc: SHARP_NAMES.indexOf(name),
        kind: 'white',
        keyHint: KEYBOARD_WHITE[whites.length] || '',
      });
    });
    BLACK_PER_OCTAVE.forEach((name) => {
      blacks.push({
        pitch: name,
        octave,
        pc: SHARP_NAMES.indexOf(name),
        kind: 'black',
        keyHint: KEYBOARD_BLACK[blacks.length] || '',
      });
    });
  });
  return { whites, blacks };
}

function blackOffsetPercent(whiteIndex) {
  // 검은건반은 두 흰건반 사이. whiteIndex는 검은건반의 "왼쪽 흰건반 인덱스".
  const whiteWidth = 100 / (PIANO_OCTAVES.length * WHITE_PER_OCTAVE.length);
  const blackWidth = whiteWidth * 0.62;
  return {
    left: (whiteIndex + 1) * whiteWidth - blackWidth / 2,
    width: blackWidth,
  };
}

export function mountPiano(rootEl, labelEl, callbacks = {}) {
  const { onKeyPress, onKeyRelease, getDuration } = callbacks;
  const durationSelect = ensureDurationControl(rootEl, labelEl);
  const { whites, blacks } = buildKeyList();
  rootEl.innerHTML = '';

  // 흰건반 렌더
  whites.forEach((w) => {
    const keyEl = document.createElement('button');
    keyEl.type = 'button';
    keyEl.className = `piano-key${w.pitch === 'C' ? ' is-c' : ''}`;
    keyEl.dataset.pitch = `${w.pitch}${w.octave}`;
    keyEl.dataset.pc = String(w.pc);
    keyEl.setAttribute('aria-label', `${w.pitch}${w.octave} 입력`);
    keyEl.innerHTML = `<span class="key-label">${w.pitch}</span>${w.keyHint ? `<span class="key-hint">${w.keyHint.toUpperCase()}</span>` : ''}<span class="piano-octave-marker">${w.octave}</span>`;
    rootEl.appendChild(keyEl);
  });

  // 검은건반 위치 (C 다음은 검은, D 다음은 검은, E 다음은 없음, ...)
  const blackOrder = [0, 1, 3, 4, 5]; // C, D, F, G, A
  let whiteCursor = 0;
  let blackIdx = 0;
  PIANO_OCTAVES.forEach(() => {
    blackOrder.forEach((offset) => {
      const whiteBefore = whiteCursor + offset;
      const black = blacks[blackIdx];
      if (!black) return;
      const { left, width } = blackOffsetPercent(whiteBefore);
      const keyEl = document.createElement('button');
      keyEl.type = 'button';
      keyEl.className = 'piano-black';
      keyEl.dataset.pitch = `${black.pitch}${black.octave}`;
      keyEl.dataset.pc = String(black.pc);
      keyEl.style.left = `${left}%`;
      keyEl.style.width = `${width}%`;
      keyEl.setAttribute('aria-label', `${black.pitch}${black.octave} 입력`);
      keyEl.innerHTML = `${black.keyHint ? `<span class="key-hint">${black.keyHint.toUpperCase()}</span>` : ''}<span class="key-label">${black.pitch.replace('#', '♯')}</span>`;
      rootEl.appendChild(keyEl);
      blackIdx += 1;
    });
    whiteCursor += WHITE_PER_OCTAVE.length;
  });

  if (labelEl) {
    const lowest = `C${PIANO_OCTAVES[0]}`;
    const highest = `B${PIANO_OCTAVES[PIANO_OCTAVES.length - 1]}`;
    labelEl.textContent = `${lowest} ~ ${highest}`;
  }

  // 활성 상태 추적
  const active = new Set();
  const defaultDuration = () => selectedDuration(getDuration?.() ?? durationSelect.value);

  function flash(keyEl, durationValue = 1) {
    if (!keyEl) return;
    keyEl.classList.add('is-active');
    if (active.has(keyEl)) return;
    active.add(keyEl);
    const token = `${keyEl.dataset.pitch}:${formatDuration(durationValue)}`;
    onKeyPress && onKeyPress({ token, pitch: keyEl.dataset.pitch, pc: Number(keyEl.dataset.pc), duration: durationValue });
    window.setTimeout(() => {
      keyEl.classList.remove('is-active');
      active.delete(keyEl);
      onKeyRelease && onKeyRelease(keyEl.dataset.pitch);
    }, Math.max(140, durationValue * 220));
  }

  // 마우스/터치 이벤트
  function pointerDown(event) {
    const target = event.target.closest('.piano-key, .piano-black');
    if (!target) return;
    event.preventDefault();
    flash(target, modifiedDuration(defaultDuration(), event));
  }
  function contextMenu(event) {
    event.preventDefault();
  }

  rootEl.addEventListener('pointerdown', pointerDown);
  rootEl.addEventListener('contextmenu', contextMenu);

  // 더블클릭 = 기본 길이의 절반
  rootEl.addEventListener('dblclick', (event) => {
    event.preventDefault();
    const target = event.target.closest('.piano-key, .piano-black');
    if (!target) return;
    flash(target, Math.max(0.125, defaultDuration() / 2));
  });

  // 키보드 입력
  function keyIndexOf(pitch, octave) {
    return [...rootEl.querySelectorAll('.piano-key, .piano-black')]
      .find((el) => el.dataset.pitch === `${pitch}${octave}`);
  }

  function handleKey(event) {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
    const key = event.key.toLowerCase();
    const idxW = KEYBOARD_WHITE.indexOf(key);
    const idxB = KEYBOARD_BLACK.indexOf(key);
    if (idxW < 0 && idxB < 0) return;
    if (idxW >= 0 && idxW < whites.length) {
      const white = whites[idxW];
      const el = keyIndexOf(white.pitch, white.octave);
      flash(el, modifiedDuration(defaultDuration(), event));
      event.preventDefault();
      return;
    }
    if (idxB >= 0 && idxB < blacks.length) {
      const black = blacks[idxB];
      const el = keyIndexOf(black.pitch, black.octave);
      flash(el, modifiedDuration(defaultDuration(), event));
      event.preventDefault();
    }
  }
  window.addEventListener('keydown', handleKey);

  return {
    destroy() {
      rootEl.removeEventListener('pointerdown', pointerDown);
      rootEl.removeEventListener('contextmenu', contextMenu);
      window.removeEventListener('keydown', handleKey);
    },
  };
}
