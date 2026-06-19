// js_piano.js — 피아노 건반 UI·이벤트
// 500줄 이내 유지

import { BLACK_KEYS, SHARP_NAMES, formatDuration } from './js_theory.js';

const PIANO_OCTAVES = [3, 4]; // C3 ~ B4
const WHITE_PER_OCTAVE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_PER_OCTAVE = ['C#', 'D#', 'F#', 'G#', 'A#'];

const KEYBOARD_WHITE = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"];
const KEYBOARD_BLACK = ['w', 'e', '', 't', 'y', 'u', '', 'o', 'p', ''];

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
  const { onKeyPress, onKeyRelease } = callbacks;
  const { whites, blacks } = buildKeyList();
  rootEl.innerHTML = '';

  // 흰건반 렌더
  whites.forEach((w, idx) => {
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
  function pointerDown(e) {
    const target = e.target.closest('.piano-key, .piano-black');
    if (!target) return;
    e.preventDefault();
    let duration = 1;
    if (e.shiftKey || e.button === 2 || e.detail >= 2) duration = 0.5;
    if (e.altKey) duration = 2;
    flash(target, duration);
  }
  function contextMenu(e) {
    e.preventDefault();
  }

  rootEl.addEventListener('pointerdown', pointerDown);
  rootEl.addEventListener('contextmenu', contextMenu);

  // 더블클릭 = 짧은 음표
  rootEl.addEventListener('dblclick', (e) => {
    e.preventDefault();
    const target = e.target.closest('.piano-key, .piano-black');
    if (!target) return;
    flash(target, 0.5);
  });

  // 키보드 입력
  function keyIndexOf(pitch, octave) {
    return [...rootEl.querySelectorAll('.piano-key, .piano-black')]
      .find((el) => el.dataset.pitch === `${pitch}${octave}`);
  }

  function handleKey(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const key = e.key.toLowerCase();
    const idxW = KEYBOARD_WHITE.indexOf(key);
    const idxB = KEYBOARD_BLACK.indexOf(key);
    if (idxW < 0 && idxB < 0) return;
    if (idxW >= 0 && idxW < whites.length) {
      const w = whites[idxW];
      const el = keyIndexOf(w.pitch, w.octave);
      let duration = 1;
      if (e.shiftKey) duration = 0.5;
      if (e.altKey) duration = 2;
      flash(el, duration);
      e.preventDefault();
      return;
    }
    if (idxB >= 0 && idxB < blacks.length) {
      const b = blacks[idxB];
      const el = keyIndexOf(b.pitch, b.octave);
      let duration = 1;
      if (e.shiftKey) duration = 0.5;
      if (e.altKey) duration = 2;
      flash(el, duration);
      e.preventDefault();
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
