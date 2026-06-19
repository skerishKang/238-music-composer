// js_audio.js — Web Audio 기반 멜로디/반주 재생
// 500줄 이내 유지

import { groupByBar } from './js_theory.js';

let ctx = null;
let masterGain = null;
let activeNodes = [];
let stopFlag = false;

const PEAK_BASS = 0.32;
const PEAK_CHORD = 0.22;

// 반주 패턴: 각 트리거는 { t(박자 오프셋), d(길이, 박자), idx(코드 음 인덱스 0=루트 1=3도 2=5도 3=7도), vel(0.4~1) }
// 박자 = 4박자 마디 기준
const ACCOMPANIMENT_PATTERNS = {
  off: [],
  block: [
    { t: 0, d: 4, idx: 0, vel: 1.0 },
  ],
  arpeggio: [
    { t: 0, d: 1, idx: 0, vel: 0.9 },
    { t: 1, d: 1, idx: 1, vel: 0.7 },
    { t: 2, d: 1, idx: 2, vel: 0.7 },
    { t: 3, d: 1, idx: 1, vel: 0.7 },
  ],
  pop8: [
    { t: 0, d: 0.5, idx: 0, vel: 0.95 },
    { t: 0.5, d: 0.5, idx: 2, vel: 0.55 },
    { t: 1, d: 0.5, idx: 0, vel: 0.85 },
    { t: 1.5, d: 0.5, idx: 2, vel: 0.55 },
    { t: 2, d: 0.5, idx: 0, vel: 0.95 },
    { t: 2.5, d: 0.5, idx: 2, vel: 0.55 },
    { t: 3, d: 0.5, idx: 0, vel: 0.85 },
    { t: 3.5, d: 0.5, idx: 2, vel: 0.55 },
  ],
  waltz: [
    { t: 0, d: 1, idx: 0, vel: 1.0 },
    { t: 1, d: 1, idx: 2, vel: 0.7 },
    { t: 2, d: 1, idx: 1, vel: 0.7 },
  ],
  funk16: [
    { t: 0, d: 0.25, idx: 0, vel: 1.0 },
    { t: 0.5, d: 0.25, idx: 2, vel: 0.6 },
    { t: 1, d: 0.25, idx: 0, vel: 0.85 },
    { t: 1.5, d: 0.25, idx: 2, vel: 0.6 },
    { t: 2, d: 0.25, idx: 0, vel: 1.0 },
    { t: 2.5, d: 0.25, idx: 2, vel: 0.6 },
    { t: 3, d: 0.25, idx: 0, vel: 0.85 },
    { t: 3.5, d: 0.25, idx: 2, vel: 0.6 },
  ],
};

export const ACCOMPANIMENT_LABELS = {
  off: '반주 끄기',
  block: '블록 코드',
  arpeggio: '아르페지오',
  pop8: '팝 8비트',
  waltz: '발라드 3/4',
  funk16: '펑크 16비트',
};

function ensureContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) {
    throw new Error('이 브라우저는 Web Audio를 지원하지 않습니다.');
  }
  ctx = new Ctor();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.45;
  masterGain.connect(ctx.destination);
  return ctx;
}

function midiOf(pitch, octave) {
  return (octave + 1) * 12 + pitch;
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function envelope(node, when, duration, peak = 0.6) {
  const attack = 0.015;
  const decay = 0.12;
  const sustain = 0.55;
  const release = 0.18;
  node.gain.cancelScheduledValues(when);
  node.gain.setValueAtTime(0.0001, when);
  node.gain.exponentialRampToValueAtTime(peak, when + attack);
  node.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), when + attack + decay);
  const releaseAt = when + Math.max(attack + decay + 0.05, duration - release);
  node.gain.setValueAtTime(Math.max(0.0001, peak * sustain), releaseAt);
  node.gain.exponentialRampToValueAtTime(0.0001, releaseAt + release);
}

function playTone(freq, when, duration, type = 'triangle', peak = 0.5) {
  if (stopFlag) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(masterGain);
  envelope(gain, when, duration, peak);
  osc.start(when);
  osc.stop(when + duration + 0.4);
  activeNodes.push(osc, gain);
  osc.onended = () => {
    activeNodes = activeNodes.filter((n) => n !== osc && n !== gain);
  };
}

function beatDuration(bpm) {
  return 60 / Math.max(40, Math.min(220, bpm));
}

function scheduleMelody(melodyNotes, startAt, bpm) {
  if (!melodyNotes || melodyNotes.length === 0) return startAt;
  const beat = beatDuration(bpm);
  const grouped = groupByBar(melodyNotes);
  let time = startAt;
  grouped.forEach((barNotes) => {
    barNotes.forEach((note) => {
      if (note.rest) return;
      const dur = note.duration * beat;
      const freq = midiToFreq(midiOf(note.pc, note.octave));
      playTone(freq, time, dur * 0.95, 'triangle', 0.42);
      time += dur;
    });
    const used = barNotes.reduce((sum, note) => sum + (note.rest ? 0 : note.duration), 0);
    if (used < 4) {
      time += (4 - used) * beat;
    } else if (used > 4) {
      time -= (used - 4) * beat;
    }
  });
  return time;
}

function scheduleChords(recommendations, startAt, bpm) {
  const beat = beatDuration(bpm);
  recommendations.forEach((rec, idx) => {
    const chord = rec.chord;
    const chordStart = startAt + idx * 4 * beat;
    chord.intervals.forEach((iv, k) => {
      const pc = (chord.rootPc + iv) % 12;
      const octave = k === 0 ? 3 : 4;
      const freq = midiToFreq((octave + 1) * 12 + pc);
      playTone(freq, chordStart, 4 * beat * 0.95, 'sine', k === 0 ? 0.32 : 0.22);
    });
  });
}

function scheduleAccompaniment(recommendations, patternName, startAt, bpm) {
  const pattern = ACCOMPANIMENT_PATTERNS[patternName] || ACCOMPANIMENT_PATTERNS.off;
  if (pattern.length === 0) return startAt;
  const beat = beatDuration(bpm);
  recommendations.forEach((rec, idx) => {
    const chord = rec.chord;
    const barStart = startAt + idx * 4 * beat;
    pattern.forEach((step) => {
      const when = barStart + step.t * beat;
      const interval = chord.intervals[Math.min(step.idx, chord.intervals.length - 1)];
      const pc = (chord.rootPc + interval) % 12;
      const octave = step.idx === 0 ? 2 : 3;
      const freq = midiToFreq((octave + 1) * 12 + pc);
      const peak = (step.idx === 0 ? PEAK_BASS : PEAK_CHORD) * (step.vel || 0.8);
      const dur = Math.max(0.08, step.d * beat);
      playTone(freq, when, dur * 0.92, step.idx === 0 ? 'triangle' : 'sine', peak);
    });
  });
  return startAt + recommendations.length * 4 * beat;
}

export async function playSequence(melodyNotes, recommendations, options = {}) {
  stopSequence();
  ensureContext();
  if (ctx.state === 'suspended') await ctx.resume();
  const bpm = options.bpm || 96;
  const pattern = options.pattern || 'off';
  const startAt = ctx.currentTime + 0.08;

  // `off`는 실제로도 멜로디만 재생한다. 다른 스타일은 코드 기반 반주을 함께 스케줄한다.
  if (pattern !== 'off') {
    scheduleChords(recommendations, startAt, bpm);
    scheduleAccompaniment(recommendations, pattern, startAt, bpm);
  }

  const endAt = scheduleMelody(melodyNotes, startAt, bpm);
  const totalMs = Math.max(800, (endAt - startAt + 0.4) * 1000);
  if (options.onEnd) {
    window.setTimeout(() => options.onEnd(), totalMs);
  }
  return totalMs;
}

export function stopSequence() {
  stopFlag = true;
  activeNodes.forEach((node) => {
    try { node.stop && node.stop(); } catch (_) { /* noop */ }
  });
  activeNodes = [];
  setTimeout(() => { stopFlag = false; }, 50);
}

export function previewNote(pitch, octave, duration = 0.5) {
  ensureContext();
  if (ctx.state === 'suspended') ctx.resume();
  const pc = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(pitch);
  if (pc < 0) return;
  playTone(midiToFreq(midiOf(pc, octave)), ctx.currentTime + 0.02, duration, 'triangle', 0.45);
}
