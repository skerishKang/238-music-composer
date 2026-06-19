// js_score.js — VexFlow 기반 멜로디/코드 진행 악보 렌더
// 500줄 이내 유지

import { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } from 'https://cdn.jsdelivr.net/npm/vexflow@4.2.5/+esm';
import { groupByBar } from './js_theory.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
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

function svgNode(name, attrs = {}, text = '') {
  const node = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (text) node.textContent = text;
  return node;
}

function svgDimension(svg, name, fallback) {
  const attribute = Number.parseFloat(svg.getAttribute(name));
  if (Number.isFinite(attribute) && attribute > 0) return attribute;
  const viewBox = svg.viewBox?.baseVal;
  const viewBoxValue = viewBox && name === 'width' ? viewBox.width : viewBox?.height;
  return Number.isFinite(viewBoxValue) && viewBoxValue > 0 ? viewBoxValue : fallback;
}

function scoreMetadata(options) {
  const mode = options.mode === 'minor' ? '단조' : options.mode === 'major' ? '장조' : '';
  return [
    options.root && mode ? `${options.root} ${mode}` : options.root,
    options.bpm ? `${options.bpm} BPM` : '',
    options.progression ? `${options.progression} 진행` : '',
  ].filter(Boolean).join(' · ');
}

function addChordLegend(svg, recommendations, width, startY) {
  const cellWidth = 142;
  const padding = 26;
  const columns = Math.max(1, Math.floor((width - padding * 2) / cellWidth));
  recommendations.forEach((rec, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x = padding + column * cellWidth;
    const y = startY + row * 28;
    const chord = rec.chord;
    const label = `${index + 1}마디 · ${chord.rootName}${chordSuffixForUi(chord.quality)} · ${chord.roman}`;
    const group = svgNode('g', { transform: `translate(${x} ${y})` });
    group.appendChild(svgNode('rect', {
      x: 0, y: -17, width: cellWidth - 8, height: 22, rx: 5,
      fill: '#eef2ff', stroke: '#c7d2fe', 'stroke-width': 1,
    }));
    group.appendChild(svgNode('text', {
      x: 8, y: -2, fill: '#3730a3', 'font-size': 11, 'font-family': 'Arial, sans-serif', 'font-weight': 700,
    }, label));
    svg.appendChild(group);
  });
  return Math.ceil(recommendations.length / columns) * 28;
}

// 현재 보이는 멜로디 SVG와 실제 선택된 코드를 하나의 독립 SVG로 내보낸다.
export function exportCompleteScoreSvg(host, recommendations, options = {}) {
  const source = host?.querySelector('svg');
  if (!source) return null;

  const sourceWidth = svgDimension(source, 'width', 800);
  const sourceHeight = svgDimension(source, 'height', 200);
  const width = Math.max(620, sourceWidth);
  const choices = Array.isArray(recommendations) ? recommendations.filter((rec) => rec?.chord) : [];
  const legendRows = Math.max(1, Math.ceil(choices.length / Math.max(1, Math.floor((width - 52) / 142))));
  const headerHeight = 76 + legendRows * 28;
  const height = headerHeight + sourceHeight + 20;
  const output = svgNode('svg', {
    xmlns: SVG_NS,
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-label': '238 Music Composer 완성 악보',
  });

  output.appendChild(svgNode('rect', { x: 0, y: 0, width, height, fill: '#ffffff' }));
  output.appendChild(svgNode('text', {
    x: 26, y: 30, fill: '#111827', 'font-size': 22, 'font-family': 'Arial, sans-serif', 'font-weight': 800,
  }, options.title || '238 Music Composer'));
  output.appendChild(svgNode('text', {
    x: 26, y: 52, fill: '#4b5563', 'font-size': 12, 'font-family': 'Arial, sans-serif',
  }, scoreMetadata(options) || '멜로디와 선택 코드 진행'));

  if (choices.length) {
    addChordLegend(output, choices, width, 82);
  } else {
    output.appendChild(svgNode('text', {
      x: 26, y: 82, fill: '#6b7280', 'font-size': 12, 'font-family': 'Arial, sans-serif',
    }, '선택된 코드 진행 없음'));
  }

  const scoreLayer = svgNode('g', { transform: `translate(0 ${headerHeight})` });
  Array.from(source.childNodes).forEach((child) => scoreLayer.appendChild(child.cloneNode(true)));
  output.appendChild(scoreLayer);

  const xml = new XMLSerializer().serializeToString(output);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(blob);
}

// 기존 멜로디 전용 SVG 추출 함수는 하위 호출 호환을 위해 유지한다.
export function exportMelodyPng(host) {
  const svg = host.querySelector('svg');
  if (!svg) return null;
  const xml = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(blob);
}
