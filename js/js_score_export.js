// js_score_export.js — 완성 악보 SVG와 멜로디·코드 MIDI 내보내기
// 500줄 이내 유지

import { exportCompleteScoreSvg } from './js_score.js';
import { parseMelody } from './js_theory.js';

const TICKS_PER_BEAT = 480;
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
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

function download(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
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
  download(url, '238-music-composer-complete-score.svg');
  showToast('완성 악보 SVG 다운로드 시작');
}

function bytesOfText(text) {
  return Array.from(new TextEncoder().encode(text));
}

function u16(value) {
  return [(value >> 8) & 0xff, value & 0xff];
}

function u32(value) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function vlq(value) {
  let number = Math.max(0, Math.floor(value));
  const output = [number & 0x7f];
  while ((number >>= 7) > 0) output.unshift((number & 0x7f) | 0x80);
  return output;
}

function chunk(type, bytes) {
  return [...bytesOfText(type), ...u32(bytes.length), ...bytes];
}

function timedEvent(tick, order, bytes) {
  return { tick: Math.max(0, Math.round(tick)), order, bytes };
}

function makeTrack(events) {
  const ordered = [...events].sort((left, right) => left.tick - right.tick || left.order - right.order);
  let previous = 0;
  const bytes = [];
  ordered.forEach((item) => {
    bytes.push(...vlq(item.tick - previous), ...item.bytes);
    previous = item.tick;
  });
  bytes.push(0x00, 0xff, 0x2f, 0x00);
  return chunk('MTrk', bytes);
}

function trackName(name) {
  const text = bytesOfText(name);
  return [0xff, 0x03, ...vlq(text.length), ...text];
}

function tempoMeta(bpm) {
  const safeBpm = Math.max(40, Math.min(220, Number(bpm) || 96));
  const micros = Math.round(60000000 / safeBpm);
  return [0xff, 0x51, 0x03, (micros >> 16) & 0xff, (micros >> 8) & 0xff, micros & 0xff];
}

function midiNumber(value) {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function chordParts(label) {
  if (label.endsWith('dim')) return { root: label.slice(0, -3), intervals: [0, 3, 6] };
  if (label.endsWith('aug')) return { root: label.slice(0, -3), intervals: [0, 4, 8] };
  if (label.endsWith('m')) return { root: label.slice(0, -1), intervals: [0, 3, 7] };
  return { root: label, intervals: [0, 4, 7] };
}

function selectedMidiChords() {
  return readSelectedChords()
    .map((rec) => chordParts(rec.chord.rootName))
    .map(({ root, intervals }) => ({ rootPc: SHARP_NAMES.indexOf(root), intervals }))
    .filter((chord) => chord.rootPc >= 0);
}

function noteTick(note) {
  return ((Math.max(1, note.bar || 1) - 1) * 4 + Math.max(0, note.beat || 0)) * TICKS_PER_BEAT;
}

function melodyEvents(notes) {
  const events = [];
  notes.filter((note) => !note.rest).forEach((note) => {
    const tick = noteTick(note);
    const duration = Math.max(1, Math.round((note.duration || 1) * TICKS_PER_BEAT));
    const pitch = midiNumber(note.midi ?? ((note.octave + 1) * 12 + note.pc));
    events.push(timedEvent(tick, 1, [0x90, pitch, 94]));
    events.push(timedEvent(tick + duration, 0, [0x80, pitch, 0]));
  });
  return events;
}

function chordEvents(chords) {
  const events = [];
  chords.forEach((chord, bar) => {
    const tick = bar * 4 * TICKS_PER_BEAT;
    const duration = 4 * TICKS_PER_BEAT;
    chord.intervals.forEach((interval, index) => {
      const pitch = midiNumber(48 + chord.rootPc + interval + (index === 2 ? 12 : 0));
      events.push(timedEvent(tick, 1, [0x91, pitch, index === 0 ? 72 : 56]));
      events.push(timedEvent(tick + duration, 0, [0x81, pitch, 0]));
    });
  });
  return events;
}

export function buildMidiFile(notes, chords, bpm = 96) {
  const header = [...bytesOfText('MThd'), ...u32(6), ...u16(1), ...u16(2), ...u16(TICKS_PER_BEAT)];
  const metaTrack = makeTrack([
    timedEvent(0, 0, trackName('238 Music Composer')),
    timedEvent(0, 0, tempoMeta(bpm)),
    timedEvent(0, 0, [0xff, 0x58, 0x04, 4, 2, 24, 8]),
  ]);
  const performanceTrack = makeTrack([
    timedEvent(0, 0, trackName('Melody and Chords')),
    timedEvent(0, 0, [0xc0, 0]),
    timedEvent(0, 0, [0xc1, 0]),
    ...melodyEvents(notes),
    ...chordEvents(chords),
  ]);
  return new Uint8Array([...header, ...metaTrack, ...performanceTrack]);
}

function exportMidi() {
  const parsed = parseMelody($('melodyInput')?.value || '');
  if (!parsed.notes.length || parsed.errors.length) {
    showToast(parsed.errors[0] || '내보낼 멜로디가 없습니다');
    return;
  }
  let chords = selectedMidiChords();
  if (!chords.length) {
    $('analyzeButton')?.click();
    chords = selectedMidiChords();
  }
  if (!chords.length) {
    showToast('코드 추천을 먼저 실행해 주세요');
    return;
  }
  const bytes = buildMidiFile(parsed.notes, chords, Number($('bpmInput')?.value) || 96);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  download(url, '238-music-composer.mid');
  showToast('멜로디와 코드 MIDI 다운로드 시작');
}

function init() {
  $('exportScoreButton')?.addEventListener('click', exportCompleteScore);
  $('exportMidiButton')?.addEventListener('click', exportMidi);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
