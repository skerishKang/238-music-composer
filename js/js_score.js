// js_score.js — VexFlow 기반 멜로디/코드 진행 악보 렌더
// 500줄 이내 유지

import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.5/+esm';
import { groupByBar } from './js_theory.js';

const DURATION_MAP = {
  4: 'w',
  2: 'h',
  1: 'q',
  0.5: '8',
  0.25: '16',
  0.125: '32',
};

function vexDuration(value) {
  return DURATION_MAP[value] || 'q';
}

function clearHost(host) {
  while (host.firstChild) host.removeChild(host.firstChild);
}

function makeEmpty(host, message) {
  clearHost(host);
  const empty = document.createElement('div');
  empty.className = 'vex-empty';
  empty.textContent = message;
  host.appendChild(empty);
}

function staveWidth(noteCount) {
  if (noteCount <= 0) return 160;
  return Math.max(220, 90 + noteCount * 38);
}

// 멜로디를 VexFlow로 렌더
export function renderMelodyScore(host, notes, options = {}) {
  if (!host) return;
  if (!notes || notes.length === 0) {
    makeEmpty(host, '멜로디가 없습니다. 건반을 눌러보세요.');
    return;
  }

  clearHost(host);
  const bars = groupByBar(notes);
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(staveWidth(notes.length) * bars.length, 200);
  const context = renderer.getContext();
  context.setFont('Arial', 10);

  let x = 10;
  bars.forEach((barNotes, idx) => {
    const stave = new Stave(x, 20, staveWidth(barNotes.length));
    if (idx === 0) stave.addClef('treble').addKeySignature('C');
    stave.setContext(context).draw();

    if (barNotes.length === 0) {
      x += staveWidth(0) + 8;
      return;
    }

    const staveNotes = [];
    barNotes.forEach((note) => {
      if (note.rest) {
        staveNotes.push(new StaveNote({ keys: ['b/4'], duration: `${vexDuration(note.duration)}r` }));
        return;
      }
      const key = `${note.pitch.toLowerCase().replace('b', 'b')}/${note.octave}`;
      const staveNote = new StaveNote({
        keys: [key],
        duration: vexDuration(note.duration),
      });
      if (note.pitch.includes('#')) {
        staveNote.addModifier(new Accidental('#'), 0);
      }
      staveNotes.push(staveNote);
    });

    try {
      const voice = new Voice({ num_beats: 4, beat_value: 4 });
      voice.setStrict(false);
      voice.addTickables(staveNotes);
      new Formatter().joinVoices([voice]).format([voice], staveWidth(barNotes.length) - 40);
      voice.draw(context, stave);
    } catch (err) {
      console.warn('VexFlow 멜로디 렌더 실패', err);
    }

    x += staveWidth(barNotes.length) + 8;
  });
}

// 코드 진행을 가로 한 줄 pill로 렌더 — 멜로디 악보 카드 상단에 들어감
export function renderChordStrip(host, recommendations) {
  if (!host) return;
  host.innerHTML = '';
  if (!recommendations || recommendations.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'chord-strip-empty';
    empty.textContent = '코드 추천을 누르면 진행이 표시됩니다';
    host.appendChild(empty);
    return;
  }
  recommendations.forEach((rec, idx) => {
    const pill = document.createElement('span');
    pill.className = 'chord-pill';
    const chord = rec.chord;
    const name = `${chord.rootName}${chordSuffixForUi(chord.quality)}`;
    const num = document.createElement('span');
    num.className = 'chord-pill-num';
    num.textContent = String(idx + 1);
    const nameEl = document.createElement('span');
    nameEl.className = 'chord-pill-name';
    nameEl.textContent = name;
    const roman = document.createElement('span');
    roman.className = 'chord-pill-roman';
    roman.textContent = chord.roman;
    pill.appendChild(num);
    pill.appendChild(nameEl);
    pill.appendChild(roman);
    host.appendChild(pill);
  });
}

// 코드 진행을 텍스트 악보(보드)로 렌더 — VexFlow 위에 텍스트 그리기
export function renderChordScore(host, recommendations, diatonic, options = {}) {
  if (!host) return;
  if (!recommendations || recommendations.length === 0) {
    makeEmpty(host, '코드 추천을 먼저 실행해 주세요.');
    return;
  }

  clearHost(host);

  const container = document.createElement('div');
  container.className = 'chord-board';

  recommendations.forEach((rec, idx) => {
    const cell = document.createElement('div');
    cell.className = 'chord-board-cell';
    const chord = rec.chord;
    const name = `${chord.rootName}${chordSuffixForUi(chord.quality)}`;

    const barLabel = document.createElement('div');
    barLabel.className = 'chord-board-bar';
    barLabel.textContent = `마디 ${idx + 1}`;

    const nameEl = document.createElement('div');
    nameEl.className = 'chord-board-name';
    nameEl.textContent = name;

    const roman = document.createElement('div');
    roman.className = 'chord-board-roman';
    roman.textContent = chord.roman;

    const notesWrap = document.createElement('div');
    notesWrap.className = 'chord-board-notes';
    chord.notes.forEach((n) => {
      const note = document.createElement('span');
      note.className = 'chord-board-note';
      note.textContent = n;
      notesWrap.appendChild(note);
    });

    cell.appendChild(barLabel);
    cell.appendChild(nameEl);
    cell.appendChild(roman);
    cell.appendChild(notesWrap);
    container.appendChild(cell);
  });

  host.appendChild(container);
}

function chordSuffixForUi(quality) {
  if (quality === 'maj') return '';
  if (quality === 'min') return 'm';
  if (quality === 'dim') return 'dim';
  if (quality === 'aug') return 'aug';
  return '';
}

// PNG 다운로드 — 현재 멜로디 호스트의 SVG를 추출
export function exportMelodyPng(host) {
  const svg = host.querySelector('svg');
  if (!svg) return null;
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(blob);
}
