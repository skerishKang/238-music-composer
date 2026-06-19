// js_chord_candidates.js — 코드 후보 카드 렌더링
// 500줄 이내 유지

import { explainMatch, formatChordName } from './js_theory.js';

function empty(host, message) {
  host.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'chord-candidates-empty';
  box.textContent = message;
  host.appendChild(box);
}

function sameChord(a, b) {
  if (!a || !b) return false;
  return a.chord.rootPc === b.chord.rootPc && a.chord.quality === b.chord.quality;
}

function confidenceLabel(value) {
  const pct = Math.round((value || 0) * 100);
  if (pct >= 75) return `${pct}% 잘 맞음`;
  if (pct >= 55) return `${pct}% 무난함`;
  return `${pct}% 실험적`;
}

export function renderChordCandidates(host, candidatesByBar, options = {}) {
  if (!host) return;
  const { selected = [], onSelect } = options;
  const hasCandidates = Array.isArray(candidatesByBar) && candidatesByBar.some((list) => list && list.length);
  if (!hasCandidates) {
    host.innerHTML = '';
    return;
  }

  host.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'chord-candidates-title';
  title.innerHTML = '<strong>코드 후보</strong><span>마디마다 마음에 드는 코드를 직접 고를 수 있어요.</span>';
  host.appendChild(title);

  candidatesByBar.forEach((candidates, barIndex) => {
    if (!candidates || !candidates.length) return;
    const row = document.createElement('section');
    row.className = 'chord-candidate-row';
    row.setAttribute('aria-label', `${barIndex + 1}마디 코드 후보`);

    const label = document.createElement('div');
    label.className = 'chord-candidate-bar-label';
    label.textContent = `${barIndex + 1}마디`;
    row.appendChild(label);

    const list = document.createElement('div');
    list.className = 'chord-candidate-list';

    candidates.forEach((rec, candidateIndex) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chord-candidate${sameChord(rec, selected[barIndex]) ? ' is-selected' : ''}`;
      button.dataset.barIndex = String(barIndex);
      button.dataset.candidateIndex = String(candidateIndex);
      button.dataset.chordRootPc = String(rec.chord.rootPc);
      button.dataset.chordQuality = rec.chord.quality;

      const name = document.createElement('span');
      name.className = 'candidate-name';
      name.textContent = formatChordName(rec.chord);

      const meta = document.createElement('span');
      meta.className = 'candidate-meta';
      meta.textContent = `${rec.chord.roman} · ${confidenceLabel(rec.confidence)}`;

      const why = document.createElement('span');
      why.className = 'candidate-why';
      why.textContent = explainMatch(rec.chord, rec.matchCount || 0, rec.passingCount || 0);

      button.appendChild(name);
      button.appendChild(meta);
      button.appendChild(why);
      button.addEventListener('click', () => onSelect && onSelect(barIndex, candidateIndex));
      list.appendChild(button);
    });

    row.appendChild(list);
    host.appendChild(row);
  });
}
