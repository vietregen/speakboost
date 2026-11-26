// Thành phần giao diện dùng chung. Mọi chữ đưa vào trang đều qua textContent để an toàn.
import * as S from './speech.js';
import * as P from './progress.js';

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const starsText = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));

const live = new Set();
const cleanups = new Set();
export function addCleanup(fn) { cleanups.add(fn); }
export function disposeAll() {
  S.stopModel(); S.stopListening();
  for (const r of live) r.dispose();
  live.clear();
  for (const fn of cleanups) fn();
  cleanups.clear();
}

export function listenButtons(text, audio) {
  if (!text) return null;
  return h('div', { class: 'row' },
    h('button', { class: 'btn btn-soft', onclick: () => S.playModel(text, { audio }) }, '🔊 Nghe mẫu'),
    h('button', { class: 'btn btn-soft', onclick: () => S.playModel(text, { audio, rate: 0.7 }) }, '🐢 Nghe chậm'),
  );
}

/**
 * Khu luyện nói: nghe mẫu, nói để máy nhận diện, ghi âm và nghe lại.
 * evaluate(alternatives) -> { stars, title, body: Node[] , detail }
 */
export function speakPanel({ text, audio, evaluate, meta, continuous = false, onResult }) {
  const result = h('div', { class: 'result', 'aria-live': 'polite' });
  const rec = new S.Recorder(continuous ? 60 : 15);
  live.add(rec);

  const finish = (outcome, source) => {
    P.record({ ...meta, source, stars: outcome.stars, detail: outcome.detail || '' });
    if (onResult) onResult(outcome, source);
  };

  const showOutcome = (outcome) => {
    result.replaceChildren(
      h('div', { class: 'result-label' }, 'Kết quả nhận diện lời nói · không phải điểm phát âm'),
      h('div', { class: `result-stars s${outcome.stars}`, 'aria-label': `${outcome.stars} trên 3 sao` }, starsText(outcome.stars)),
      h('p', { class: 'result-title' }, outcome.title),
      ...(outcome.body || []),
    );
  };

  // --- Nói để máy nghe ---
  let listening = false;
  const sayBtn = h('button', { class: 'btn btn-main' }, '🎤 Nói');
  sayBtn.addEventListener('click', async () => {
    if (listening) { S.stopListening(); return; }
    listening = true;
    sayBtn.classList.add('active');
    sayBtn.textContent = continuous ? '⏹ Nói xong thì bấm dừng' : '👂 Máy đang nghe… (bấm để dừng)';
    result.replaceChildren(h('p', { class: 'muted' }, continuous ? 'Bạn nói hết các câu, rồi bấm dừng.' : 'Bạn nói to, rõ nhé.'));
    const res = await S.listen({ continuous });
    listening = false;
    sayBtn.classList.remove('active');
    sayBtn.textContent = '🎤 Nói lại';
    if (res.error) {
      result.replaceChildren(h('p', { class: 'warn' }, res.message || 'Máy chưa nghe được, bạn thử lại nhé.'));
      return;
    }
    const outcome = evaluate(res.alternatives);
    showOutcome(outcome);
    finish(outcome, 'asr_match');
  });

  // --- Ghi âm và nghe lại ---
  const playBtn = h('button', { class: 'btn btn-soft', disabled: true, onclick: () => rec.play() }, '▶ Nghe lại giọng bạn');
  const recBtn = h('button', { class: 'btn btn-soft' }, '⏺ Ghi âm');
  const selfCheck = h('div', { class: 'self-check', hidden: true },
    h('p', {}, 'Bạn nghe lại và tự so với mẫu:'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-soft', onclick: () => selfRate(2) }, '😀 Giống mẫu'),
      h('button', { class: 'btn btn-soft', onclick: () => selfRate(1) }, '🤔 Chưa giống, tập thêm'),
    ),
  );
  function selfRate(stars) {
    selfCheck.hidden = true;
    const outcome = { stars, title: stars === 2 ? 'Bạn tự đánh giá: giống mẫu.' : 'Bạn tự đánh giá: cần tập thêm.', detail: 'tu_danh_gia' };
    result.replaceChildren(
      h('div', { class: 'result-label' }, 'Bạn tự đánh giá · máy không chấm'),
      h('div', { class: `result-stars s${stars}` }, starsText(stars)),
      h('p', { class: 'result-title' }, outcome.title),
    );
    finish(outcome, 'self_check');
  }
  recBtn.addEventListener('click', async () => {
    try {
      if (rec.recording) {
        await rec.stop();
        recBtn.textContent = '⏺ Ghi âm lại';
        recBtn.classList.remove('active');
        playBtn.disabled = false;
        if (!S.support.recognition) selfCheck.hidden = false;
        return;
      }
      await rec.start();
      recBtn.textContent = '⏹ Dừng ghi';
      recBtn.classList.add('active');
    } catch (err) {
      result.replaceChildren(h('p', { class: 'warn' }, 'Chưa ghi âm được. ', S.micHelp()));
    }
  });

  const controls = h('div', { class: 'row' },
    S.support.recognition ? sayBtn : null,
    S.support.recorder ? recBtn : null,
    S.support.recorder ? playBtn : null,
  );

  return h('div', { class: 'speak-panel' }, listenButtons(text, audio), controls, selfCheck, result);
}

// Hiển thị câu mục tiêu với từ máy đã nghe / chưa nghe.
export function wordLine(words) {
  return h('p', { class: 'word-line' }, ...words.map((w) =>
    h('span', { class: w.heard ? 'w-ok' : 'w-miss', title: w.heard ? 'máy đã nghe' : 'máy chưa nghe rõ' }, w.word)));
}

export function heardLine(heard) {
  return h('p', { class: 'heard' }, 'Máy nghe được: ', h('q', {}, heard || '(chưa có chữ nào)'));
}

export function sentenceOutcome(best) {
  const r = best.ratio;
  const stars = r >= 0.9 ? 3 : r >= 0.6 ? 2 : r > 0 ? 1 : 0;
  const miss = best.missing.slice(0, 4).join(', ');
  const title = stars === 3 ? 'Máy nghe rõ cả câu. Tuyệt vời!'
    : stars === 2 ? `Máy nghe được gần hết. Chưa nghe rõ: ${miss}.`
    : stars === 1 ? `Máy mới nghe được một phần. Bạn nghe mẫu rồi thử lại nhé.`
    : 'Máy chưa nghe ra câu này. Bạn nghe mẫu rồi thử lại nhé.';
  return { stars, title, body: [wordLine(best.words), heardLine(best.heard)], detail: `ty_le_khop=${r.toFixed(2)}` };
}
