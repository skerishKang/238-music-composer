// js_ui.js — DOM 헬퍼, 토스트, 코드 카드 렌더링
// 500줄 이내 유지

import { formatChordName, explainMatch } from './js_theory.js';

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

let toastTimer = null;
export function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('show'), 2400);
}

export function updateStats(notes, recommendations) {
  const noteCount = notes.filter((n) => !n.rest).length;
  const barCount = recommendations ? recommendations.length : (notes.length ? Math.max(...notes.map((n) => n.bar || 1)) : 0);
  const confidence = recommendations && recommendations.length
    ? Math.round((recommendations.reduce((s, r) => s + (r.confidence || 0), 0) / recommendations.length) * 100) + '%'
    : '-';
  const n = $('#statNotes');
  const b = $('#statBars');
  const c = $('#statConfidence');
  if (n) n.textContent = String(noteCount);
  if (b) b.textContent = String(barCount);
  if (c) c.textContent = confidence;
}

export function renderChordGrid(host, recommendations) {
  if (!host) return;
  host.innerHTML = '';
  if (!recommendations.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '아직 추천된 코드가 없습니다.';
    host.appendChild(empty);
    return;
  }

  recommendations.forEach((rec, idx) => {
    const card = document.createElement('article');
    card.className = 'chord-card';

    const header = document.createElement('header');
    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'chord-name';
    name.textContent = formatChordName(rec.chord);
    const meta = document.createElement('div');
    meta.className = 'chord-meta';
    meta.textContent = `마디 ${idx + 1} · ${rec.chord.roman} · ${rec.chord.quality}`;
    left.appendChild(name);
    left.appendChild(meta);
    const badge = document.createElement('span');
    const pct = Math.round(rec.confidence * 100);
    badge.className = `badge${pct >= 75 ? '' : pct >= 55 ? ' warn' : ' low'}`;
    badge.textContent = `${pct}%`;
    header.appendChild(left);
    header.appendChild(badge);
    card.appendChild(header);

    const melodyPcs = new Set();
    // 우리는 melody 정보는 외부에서 함께 전달받아야 함
    // melodyPcs는 renderChordGridWithMelody가 처리

    const chordNotes = document.createElement('div');
    chordNotes.className = 'chord-notes';
    const chordLabel = document.createElement('span');
    chordLabel.className = 'label';
    chordLabel.textContent = '코드 구성음';
    chordNotes.appendChild(chordLabel);
    const list = document.createElement('div');
    list.className = 'note-list';
    rec.chord.notes.forEach((n) => {
      const pill = document.createElement('span');
      pill.className = 'note-pill';
      pill.textContent = n;
      list.appendChild(pill);
    });
    chordNotes.appendChild(list);
    card.appendChild(chordNotes);

    const explanation = document.createElement('div');
    explanation.className = 'explanation';
    explanation.textContent = explainMatch(rec.chord, rec.matchCount || 0, rec.passingCount || 0);
    card.appendChild(explanation);

    host.appendChild(card);
  });
}

// 멜로디 정보를 함께 받아서 멜로디 노트를 코드 카드에 표시
export function renderChordGridWithMelody(host, recommendations, melodyNotes) {
  if (!host) return;
  host.innerHTML = '';
  if (!recommendations.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '아직 추천된 코드가 없습니다.';
    host.appendChild(empty);
    return;
  }

  const grouped = new Map();
  melodyNotes.forEach((n) => {
    if (n.rest) return;
    const list = grouped.get(n.bar) || [];
    list.push(n);
    grouped.set(n.bar, list);
  });

  recommendations.forEach((rec, idx) => {
    const bar = idx + 1;
    const melodyInBar = grouped.get(bar) || [];
    const chord = rec.chord;
    const chordPcs = new Set(chord.intervals.map((iv) => (chord.rootPc + iv) % 12));

    const card = document.createElement('article');
    card.className = 'chord-card';

    const header = document.createElement('header');
    const left = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'chord-name';
    name.textContent = formatChordName(chord);
    const meta = document.createElement('div');
    meta.className = 'chord-meta';
    meta.textContent = `마디 ${bar} · ${chord.roman} · ${chord.quality}`;
    left.appendChild(name);
    left.appendChild(meta);
    const badge = document.createElement('span');
    const pct = Math.round(rec.confidence * 100);
    badge.className = `badge${pct >= 75 ? '' : pct >= 55 ? ' warn' : ' low'}`;
    badge.textContent = `${pct}%`;
    header.appendChild(left);
    header.appendChild(badge);
    card.appendChild(header);

    const chordNotes = document.createElement('div');
    chordNotes.className = 'chord-notes';
    const chordLabel = document.createElement('span');
    chordLabel.className = 'label';
    chordLabel.textContent = '코드 구성음';
    chordNotes.appendChild(chordLabel);
    const list = document.createElement('div');
    list.className = 'note-list';
    chord.notes.forEach((n) => {
      const pill = document.createElement('span');
      pill.className = 'note-pill';
      pill.textContent = n;
      list.appendChild(pill);
    });
    chordNotes.appendChild(list);
    card.appendChild(chordNotes);

    if (melodyInBar.length) {
      const melodyBox = document.createElement('div');
      melodyBox.className = 'melody-notes';
      const melodyLabel = document.createElement('span');
      melodyLabel.className = 'label';
      melodyLabel.textContent = '멜로디 매칭';
      melodyBox.appendChild(melodyLabel);
      const mlist = document.createElement('div');
      mlist.className = 'note-list';
      melodyInBar.forEach((m) => {
        const pill = document.createElement('span');
        const inChord = chordPcs.has(m.pc);
        pill.className = `note-pill${inChord ? ' match' : ' passing'}`;
        pill.textContent = `${m.pitch}${m.octave}`;
        mlist.appendChild(pill);
      });
      melodyBox.appendChild(mlist);
      card.appendChild(melodyBox);
    }

    const explanation = document.createElement('div');
    explanation.className = 'explanation';
    explanation.textContent = explainMatch(chord, rec.matchCount || 0, rec.passingCount || 0);
    card.appendChild(explanation);

    host.appendChild(card);
  });
}

// 한 줄 미니 멜로디: 최근 N개 음을 pill로 시각화
export function renderMiniMelody(host, notes, options = {}) {
  if (!host) return;
  const limit = options.limit || 16;
  host.innerHTML = '';
  const empty = document.createElement('span');
  empty.className = 'mini-empty';
  empty.textContent = '건반을 눌러 멜로디를 쌓아보세요';
  host.appendChild(empty);

  const items = notes.slice(-limit);
  items.forEach((note) => {
    if (note.rest) return;
    const pill = document.createElement('span');
    pill.className = 'mini-note';
    pill.textContent = `${note.pitch}${note.octave}`;
    pill.title = `${note.pitch}${note.octave} · ${note.duration}박`;
    host.appendChild(pill);
  });
  if (items.some((n) => !n.rest)) {
    if (empty.parentNode === host) host.removeChild(empty);
  }
  host.scrollLeft = host.scrollWidth;
}

// 한 줄 미니 코드 진행
export function renderMiniChords(host, recommendations, diatonic) {
  if (!host) return;
  host.innerHTML = '';
  if (!recommendations || recommendations.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'mini-empty';
    empty.textContent = '코드 추천을 누르면 진행이 표시됩니다';
    host.appendChild(empty);
    return;
  }
  recommendations.forEach((rec, idx) => {
    const pill = document.createElement('span');
    pill.className = 'mini-chord';
    const name = `${rec.chord.rootName}${chordSuffixForUi(rec.chord.quality)}`;
    pill.innerHTML = `<span class="mini-chord-num">${idx + 1}</span><span class="mini-chord-name">${name}</span><span class="mini-chord-roman">${rec.chord.roman}</span>`;
    host.appendChild(pill);
  });
}

function chordSuffixForUi(quality) {
  if (quality === 'maj') return '';
  if (quality === 'min') return 'm';
  if (quality === 'dim') return 'dim';
  if (quality === 'aug') return 'aug';
  return '';
}
