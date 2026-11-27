// Ứng dụng học sinh SpeakBoost – bản mẫu Unit 1.
import * as C from './content.js';
import * as S from './speech.js';
import * as M from './match.js';
import * as P from './progress.js';
import { h, speakPanel, listenButtons, sentenceOutcome, heardLine, starsText, disposeAll } from './ui.js';
import * as Challenge from './challenge.js';
import * as Cloud from './cloud.js';

const root = document.getElementById('app');
let unit = null;
let index = null;
let fromExcel = false;
let needLogin = false;
const preview = C.isPreview();

const ACTIVITIES = [
  { key: 'vocabulary', route: 'vocab', icon: '🔤', name: 'Từ vựng', desc: 'Xem tranh, nghe và nói từ mới' },
  { key: 'patterns', route: 'patterns', icon: '💬', name: 'Mẫu câu', desc: 'Nghe và nói theo mẫu câu' },
  { key: 'dialogues', route: 'dialogues', icon: '👫', name: 'Hội thoại', desc: 'Nhập vai đọc hội thoại' },
  { key: 'roleplays', route: 'roleplays', icon: '🎭', name: 'Đóng vai', desc: 'Trả lời bạn trò chuyện' },
  { key: 'picture_tasks', route: 'pictures', icon: '🖼️', name: 'Nói qua tranh', desc: 'Nhìn tranh và kể' },
];

const level = () => P.getLevel();
const U = () => unit.meta.unit;
const meta = (activity, item) => ({ unit: U(), activity, item, level: level() });
const items = (section) => C.visibleItems(unit, section, { preview });
const byLevel = (list) => list.filter((x) => (x.level || 1) <= level());

function shell(title, ...content) {
  return h('div', { class: 'screen' },
    preview ? h('div', { class: 'preview-banner' }, 'CHẾ ĐỘ XEM TRƯỚC CỦA GIÁO VIÊN · có cả nội dung chưa duyệt',
      fromExcel ? ' · nội dung nhập từ Excel trên máy này, chưa đưa lên web' : '') : null,
    h('header', { class: 'topbar' },
      title ? h('a', { class: 'back', href: '#/' , 'aria-label': 'Về trang chính' }, '‹') : null,
      h('div', { class: 'topbar-title' }, title || 'SpeakBoost'),
      h('div', { class: 'level-pill', title: 'Mức độ đang luyện' }, `Mức ${level()}`),
    ),
    h('main', {}, ...content),
  );
}

function draftBadge(item) {
  if (!preview || item.review === 'approved') return null;
  return h('span', { class: 'badge-draft' }, item.review === 'needs_fix' ? 'Cần sửa' : 'Chưa duyệt');
}

function emptyState(msg) { return h('div', { class: 'card center' }, h('p', { class: 'big-emoji' }, '⏳'), h('p', {}, msg)); }

// ---------------- Trang chính ----------------
const LEVEL_ICONS = { 1: '🌱', 2: '🌿', 3: '🌳' };

// Tiến độ của một chặng: số từ vựng + mẫu câu ĐÚNG mức đó đã luyện, và thử thách của mức đó.
function levelProgress(lv) {
  const list = [...items('vocabulary'), ...items('patterns')].filter((x) => (x.level || 1) === lv);
  const done = list.filter((x) => P.bestStars(U(), x.id) > 0).length;
  return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0, trophy: P.bestStars(U(), Challenge.challengeId(lv)) };
}

function roadmap() {
  const cur = level();
  const stations = unit.levels.map((l) => {
    const pg = levelProgress(l.id);
    const on = l.id === cur;
    return h('button', {
      class: `station s${l.id} ${on ? 'current' : ''} ${pg.trophy ? 'cleared' : ''}`,
      'aria-pressed': String(on), 'aria-label': `Mức ${l.id} ${l.name}, đã luyện ${pg.done}/${pg.total}`,
      onclick: () => { P.setLevel(l.id); render(); },
    },
      on ? h('span', { class: 'you' }, 'Bạn ở đây') : null,
      h('span', { class: 'node', style: `--p:${pg.pct}` }, h('span', { class: 'node-icon' }, LEVEL_ICONS[l.id] || '⭐')),
      pg.trophy ? h('span', { class: 'cup', title: 'Đã vượt thử thách' }, '🏆') : null,
      h('span', { class: 'st-name' }, `Mức ${l.id}`),
      h('span', { class: 'st-sub' }, l.name));
  });
  return h('section', { class: 'roadmap', 'aria-label': 'Lộ trình các mức' },
    road(cur),
    ...stations,
    h('span', { class: 'goal', 'aria-hidden': 'true' }, '🏁'));
}

// Con đường nối 3 chặng; đoạn đã đi qua được tô màu.
function road(cur) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'road');
  svg.setAttribute('viewBox', '0 0 300 160');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  const seg1 = 'M50 44 C100 44 100 116 150 116';
  const seg2 = 'C200 116 200 44 250 44';
  const path = (d, cls) => {
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', d); p.setAttribute('class', cls); p.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(p);
  };
  path(`${seg1} ${seg2}`, 'road-base');
  if (cur >= 2) path(cur >= 3 ? `${seg1} ${seg2}` : seg1, 'road-done');
  return svg;
}

function renderHome() {
  const tiles = ACTIVITIES.map((a) => {
    const list = a.key === 'vocabulary' || a.key === 'patterns' ? byLevel(items(a.key)) : items(a.key);
    const sum = P.summary(U(), list.map((x) => x.id));
    const disabled = list.length === 0;
    return h(disabled ? 'div' : 'a', { class: `tile ${disabled ? 'disabled' : ''}`, href: disabled ? null : `#/${a.route}` },
      h('span', { class: 'tile-icon' }, a.icon),
      h('span', { class: 'tile-name' }, a.name),
      disabled ? null : h('span', { class: 'tile-bar' }, h('span', { style: `width:${sum.total ? Math.round((sum.done / sum.total) * 100) : 0}%` })),
      disabled ? null : h('span', { class: 'tile-progress' }, `${sum.done}/${sum.total}`));
  });

  const words = byLevel(items('vocabulary'));
  if (words.length) {
    const st = Challenge.status({ unitNo: U(), words, preview, unit });
    const best = P.bestStars(U(), Challenge.challengeId(level()));
    tiles.push(h('a', { class: `tile challenge-tile ${st.unlocked ? '' : 'locked'}`, href: '#/challenge' },
      h('span', { class: 'tile-icon' }, st.unlocked ? '🏆' : '🔒'),
      h('span', { class: 'tile-name' }, 'Thử thách'),
      st.unlocked ? null : h('span', { class: 'tile-bar' }, h('span', { style: `width:${Math.min(100, Math.round((st.done / st.need) * 100))}%` })),
      h('span', { class: 'tile-progress' }, st.unlocked ? (best ? starsText(best) : 'Mở rồi!') : `${st.done}/${st.need}`)));
  }

  const anyVisible = ACTIVITIES.some((a) => items(a.key).length);
  const totalStars = P.summary(U(), ACTIVITIES.flatMap((a) => items(a.key).map((x) => x.id))).stars;
  root.replaceChildren(shell(null,
    h('section', { class: 'hero' },
      h('p', { class: 'eyebrow' }, `Unit ${U()}`),
      h('h1', {}, unit.meta.title),
      h('div', { class: 'pills' },
        h('span', { class: 'pill' }, `🔥 ${P.daysPractised()} ngày`),
        h('span', { class: 'pill' }, `⭐ ${totalStars}`))),
    supportNotice(),
    anyVisible ? null : emptyState('Thầy cô chưa duyệt nội dung bài này. Bạn chờ thầy cô nhé!'),
    roadmap(),
    h('div', { class: 'tiles' }, ...tiles),
    h('footer', { class: 'foot' },
      whoAmI(),
      h('span', {}, '🔒 Không lưu giọng nói'),
      h('a', { href: 'dashboard.html', class: 'muted' }, 'Giáo viên')),
  ));
}

function whoAmI() {
  if (preview || !Cloud.configured()) return null;
  const st = Cloud.student();
  if (st) {
    return h('span', { class: 'who' }, `👋 ${st.nickname} · lớp ${st.class_name} `,
      h('button', { class: 'link-btn', onclick: async () => { await Cloud.signOut(); needLogin = true; location.hash = '#/'; render(); } }, 'Đổi bạn'));
  }
  return h('button', { class: 'link-btn', onclick: () => { Cloud.setGuest(false); needLogin = true; render(); } }, '🏫 Đăng nhập lớp');
}

// ---------------- Đăng nhập lớp (mã lớp → chọn tên → PIN) ----------------
function renderLogin(state = {}) {
  const msg = h('p', { class: 'warn', 'aria-live': 'polite', hidden: !state.error }, state.error || '');
  const fail = (e) => { msg.textContent = e.message || String(e); msg.hidden = false; };
  const guest = h('button', { class: 'link-btn', onclick: () => { Cloud.setGuest(true); needLogin = false; render(); } },
    'Học thử, không lưu kết quả cho lớp');
  const box = (title, ...content) => root.replaceChildren(h('div', { class: 'screen' },
    h('header', { class: 'topbar' }, state.step ? h('button', { class: 'back', 'aria-label': 'Quay lại', onclick: () => renderLogin(state.step === 'pin' ? { ...state, step: 'roster', error: '' } : { code: state.code, auto: false }) }, '‹') : null,
      h('div', { class: 'topbar-title' }, 'SpeakBoost')),
    h('main', {}, h('div', { class: 'card login' }, h('p', { class: 'big-emoji' }, '🎤'), h('h1', {}, title), ...content, msg),
      h('p', { class: 'center' }, guest))));

  if (!state.step) {
    const input = h('input', { class: 'code-input', value: state.code || new URLSearchParams(location.search).get('lop') || '', placeholder: 'VD: 6A-K7Q', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Mã lớp', maxlength: 12 });
    const go = h('button', { class: 'btn btn-main', type: 'submit' }, 'Tiếp ›');
    const form = h('form', { class: 'login-form', onsubmit: async (e) => {
      e.preventDefault();
      const code = input.value.trim().toUpperCase();
      if (!code) return fail(new Error('Bạn nhập mã lớp thầy cô cho nhé.'));
      go.disabled = true; go.textContent = 'Đang tìm lớp…';
      try {
        const list = await Cloud.roster(code);
        if (!list.length) throw new Error('Không tìm thấy lớp có mã này. Bạn kiểm tra lại mã lớp nhé.');
        renderLogin({ step: 'roster', code, list });
      } catch (err) { go.disabled = false; go.textContent = 'Tiếp ›'; fail(err.message === 'offline' ? new Error('Chưa kết nối được Internet.') : err); }
    } }, input, go);
    box('Vào lớp của bạn', h('p', { class: 'muted' }, 'Nhập mã lớp thầy cô cho, hoặc quét mã QR.'), form);
    if (input.value && state.auto !== false && !state.error) setTimeout(() => form.requestSubmit(), 0);
    else setTimeout(() => input.focus(), 0);
    return;
  }

  if (state.step === 'roster') {
    box(`Lớp ${state.list[0].class_name}`, h('p', { class: 'muted' }, 'Bạn là ai?'),
      h('div', { class: 'roster' }, ...state.list.map((s) =>
        h('button', { class: 'roster-btn', onclick: () => renderLogin({ ...state, step: 'pin', pick: s }) },
          h('span', { class: 'roster-no' }, s.roster_no), h('span', {}, s.nickname)))));
    return;
  }

  // Bước nhập PIN
  const pin = h('input', { class: 'code-input pin-input', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', maxlength: 6, autocomplete: 'off', 'aria-label': 'Mã PIN' });
  const go = h('button', { class: 'btn btn-main', type: 'submit' }, 'Vào học');
  box(`Chào ${state.pick.nickname}!`, h('p', { class: 'muted' }, `Số ${state.pick.roster_no} · nhập mã PIN của bạn`),
    h('form', { class: 'login-form', onsubmit: async (e) => {
      e.preventDefault();
      if (!/^\d{4,6}$/.test(pin.value)) return fail(new Error('PIN gồm 4 đến 6 chữ số.'));
      go.disabled = true; go.textContent = 'Đang vào…';
      try { await Cloud.join(state.code, state.pick.roster_no, pin.value); needLogin = false; location.hash = '#/'; render(); }
      catch (err) { go.disabled = false; go.textContent = 'Vào học'; pin.value = ''; fail(err); }
    } }, pin, go));
  setTimeout(() => pin.focus(), 0);
}

function supportNotice() {
  const env = S.environment();
  if (env === 'in-app' || env === 'embedded') return h('div', { class: 'notice' }, h('b', {}, 'Micro chưa dùng được ở đây. '), S.micHelp());
  if (S.support.recognition) return null;
  return h('div', { class: 'notice' },
    h('b', {}, 'Trình duyệt này chưa nhận diện được lời nói. '),
    'Bạn vẫn nghe mẫu, ghi âm và tự đánh giá được. Để máy nghe bạn nói, hãy mở bằng Chrome hoặc Edge.');
}

// ---------------- Từ vựng ----------------
function renderVocab(i) {
  const list = byLevel(items('vocabulary'));
  if (!list.length) return root.replaceChildren(shell('Từ vựng', emptyState('Chưa có từ vựng đã duyệt.')));
  const k = Math.min(Math.max(0, i), list.length - 1);
  const v = list[k];
  const lv = level();
  const wordBox = h('div', { class: 'word-box' });

  let target = v.word;
  let evaluate = (alts) => {
    const r = M.matchWord(v.word, v.accepted_variants, alts);
    return r.ok
      ? { stars: 3, title: `Máy nghe rõ từ “${v.word}”. Giỏi lắm!`, body: [heardLine(r.heard)], detail: 'khop_tu' }
      : { stars: alts.length ? 1 : 0, title: `Máy chưa nghe ra từ “${lv === 2 ? '…' : v.word}”. Bạn nghe mẫu rồi thử lại nhé.`, body: [heardLine(r.heard)], detail: 'chua_khop_tu' };
  };

  if (lv === 1) {
    wordBox.append(h('p', { class: 'word' }, v.word), h('p', { class: 'ipa' }, v.ipa), h('p', { class: 'meaning' }, v.meaning_vi));
  } else if (lv === 2) {
    const hidden = h('p', { class: 'word hidden-word' }, '? ? ?');
    wordBox.append(h('p', { class: 'meaning' }, v.meaning_vi), hidden,
      h('button', { class: 'link-btn', onclick: (e) => { hidden.textContent = v.word; hidden.classList.remove('hidden-word'); e.target.remove(); wordBox.append(h('p', { class: 'ipa' }, v.ipa)); } }, 'Xem từ'));
  } else {
    target = v.example;
    wordBox.append(h('p', { class: 'word' }, v.word), h('p', { class: 'ipa' }, v.ipa),
      h('p', { class: 'task' }, 'Nói cả câu ví dụ:'), h('p', { class: 'example' }, v.example));
    evaluate = (alts) => sentenceOutcome(M.bestSentenceMatch(v.example, alts));
  }

  root.replaceChildren(shell('Từ vựng',
    h('div', { class: 'card vocab-card' },
      draftBadge(v),
      v.image ? h('img', { class: 'pic', src: v.image, alt: v.word }) : h('div', { class: 'pic-emoji', role: 'img', 'aria-label': lv === 2 ? 'tranh minh họa' : v.word }, v.emoji || '🖼️'),
      wordBox,
      lv < 3 ? h('p', { class: 'example muted' }, '📖 ', v.example) : null,
      h('p', { class: 'item-stars' }, starsText(P.bestStars(U(), v.id))),
      speakPanel({ text: target, audio: lv === 3 ? null : v.audio, evaluate, meta: meta('vocabulary', v.id) }),
    ),
    pager(k, list.length, (n) => `#/vocab/${n}`, { href: '#/challenge', label: '🏆 Thử thách' }),
  ));
}

function renderChallenge() {
  Challenge.render({ root, shell, unitNo: U(), level: level(), preview, unit, words: byLevel(items('vocabulary')) });
}

function pager(k, n, href, end = { href: '#/', label: 'Xong ✓' }) {
  return h('nav', { class: 'pager' },
    k > 0 ? h('a', { class: 'btn btn-soft', href: href(k - 1) }, '‹ Trước') : h('span'),
    h('span', { class: 'muted' }, `${k + 1} / ${n}`),
    k < n - 1 ? h('a', { class: 'btn btn-soft', href: href(k + 1) }, 'Tiếp ›') : h('a', { class: 'btn btn-main', href: end.href }, end.label));
}

// ---------------- Mẫu câu ----------------
function renderPatterns(i) {
  const list = byLevel(items('patterns'));
  if (!list.length) return root.replaceChildren(shell('Mẫu câu', emptyState('Chưa có mẫu câu đã duyệt.')));
  const k = Math.min(Math.max(0, i), list.length - 1);
  const p = list[k];
  const lv = level();
  let body, text, evaluate;

  if (lv === 1) {
    text = p.text;
    body = [h('p', { class: 'task' }, 'Nghe rồi nói lại cả câu:'), h('p', { class: 'sentence' }, p.text), h('p', { class: 'meaning' }, p.meaning_vi)];
    evaluate = (alts) => sentenceOutcome(M.bestSentenceMatch(p.text, alts));
  } else if (lv === 2) {
    text = p.text;
    const candidates = p.slot_options.map((o) => p.frame.replace('___', o));
    body = [h('p', { class: 'task' }, 'Nói cả câu, điền vào chỗ trống một từ bạn chọn:'), h('p', { class: 'sentence' }, p.frame),
      h('div', { class: 'chips' }, ...p.slot_options.map((o) => h('span', { class: 'chip' }, o))), h('p', { class: 'meaning' }, p.meaning_vi)];
    evaluate = (alts) => sentenceOutcome(M.bestSentenceMatch(candidates, alts));
  } else {
    text = null;
    const ex = h('p', { class: 'example', hidden: true }, p.free_example, ' ', h('button', { class: 'link-btn', onclick: () => S.playModel(p.free_example) }, '🔊'));
    body = [h('p', { class: 'task' }, p.free_prompt_vi), h('p', { class: 'sentence muted' }, 'Khung câu: ', p.frame),
      h('button', { class: 'link-btn', onclick: (e) => { ex.hidden = false; e.target.remove(); } }, '💡 Xem câu gợi ý'), ex];
    evaluate = (alts) => {
      const r = M.checkRequired(p.free_required, alts);
      const n = p.free_required.length;
      const stars = r.score === n ? 3 : r.score >= n / 2 ? 2 : alts.length ? 1 : 0;
      const title = stars === 3 ? 'Câu của bạn có đủ các phần của khung câu. Rất tốt!'
        : 'Máy chưa nghe đủ các phần của khung câu. Xem câu gợi ý rồi thử lại nhé.';
      return { stars, title, body: [heardLine(r.heard)], detail: `du_y=${r.score}/${n}` };
    };
  }

  root.replaceChildren(shell('Mẫu câu',
    h('div', { class: 'card' }, draftBadge(p), ...body,
      h('p', { class: 'item-stars' }, starsText(P.bestStars(U(), p.id))),
      speakPanel({ text, audio: p.audio, evaluate, meta: meta('patterns', p.id) })),
    pager(k, list.length, (n) => `#/patterns/${n}`),
  ));
}

// ---------------- Danh sách chung ----------------
function renderList(section, title, route, describe) {
  const list = items(section);
  root.replaceChildren(shell(title,
    list.length ? h('div', { class: 'list' }, ...list.map((x) =>
      h('a', { class: 'card list-item', href: `#/${route}/${x.id}` },
        h('div', {}, h('b', {}, x.title), draftBadge(x), h('p', { class: 'muted' }, describe(x))),
        h('span', { class: 'item-stars' }, starsText(P.bestStars(U(), x.id))))))
      : emptyState('Chưa có nội dung đã duyệt.')));
}

// ---------------- Hội thoại ----------------
function hideWords(text) {
  return text.split(' ').map((w, i) => (i % 2 === 1 ? '＿'.repeat(Math.min(4, w.length)) : w)).join(' ');
}

function renderDialogue(id) {
  const d = items('dialogues').find((x) => x.id === id);
  if (!d) return renderList('dialogues', 'Hội thoại', 'dialogues', (x) => x.title_vi);
  const pick = h('div', { class: 'card center' },
    draftBadge(d), h('h2', {}, d.title), h('p', { class: 'muted' }, d.title_vi), h('p', {}, 'Bạn muốn đóng vai ai?'),
    h('div', { class: 'row center' }, ...d.roles.map((r) => h('button', { class: 'btn btn-main', onclick: () => play(r) }, r))),
    h('button', { class: 'btn btn-soft', onclick: () => S.playModel(d.turns.map((t) => t.text).join(' ')) }, '🔊 Nghe cả bài'));
  root.replaceChildren(shell('Hội thoại', pick));

  function play(role) {
    const log = h('div', { class: 'chat' });
    const stage = h('div', { class: 'stage' });
    const turnStars = [];
    let sources = new Set();
    root.replaceChildren(shell('Hội thoại', h('p', { class: 'muted' }, `${d.title} · Bạn là ${role}`), log, stage));

    const step = (k) => {
      disposeAll();
      if (k >= d.turns.length) {
        const avg = turnStars.length ? Math.max(1, Math.round(turnStars.reduce((a, b) => a + b, 0) / turnStars.length)) : 1;
        P.record({ ...meta('dialogues', d.id), source: sources.has('asr_match') ? 'asr_match' : 'self_check', stars: avg, detail: `vai=${role}` });
        stage.replaceChildren(h('div', { class: 'card center' }, h('p', { class: 'big-emoji' }, '🎉'), h('p', {}, 'Bạn đã hoàn thành hội thoại!'),
          h('p', { class: 'item-stars' }, starsText(avg)),
          h('div', { class: 'row center' }, h('button', { class: 'btn btn-soft', onclick: () => play(role) }, 'Làm lại'),
            h('button', { class: 'btn btn-soft', onclick: () => renderDialogue(d.id) }, 'Đổi vai'),
            h('a', { class: 'btn btn-main', href: '#/dialogues' }, 'Bài khác'))));
        return;
      }
      const t = d.turns[k];
      const mine = t.speaker === role;
      const shown = mine ? (level() === 1 ? t.text : level() === 2 ? hideWords(t.text) : '') : (level() === 3 ? '' : t.text);
      const bubble = h('div', { class: `bubble ${mine ? 'me' : 'them'}` }, h('b', {}, t.speaker), h('p', {}, shown || '🔊 …'), h('p', { class: 'hint' }, t.hint_vi));
      log.append(bubble);
      const next = h('button', { class: 'btn btn-main', onclick: () => { bubble.querySelector('p').textContent = t.text; step(k + 1); } }, 'Tiếp ›');
      if (mine) {
        stage.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'task' }, 'Đến lượt bạn nói:'),
          speakPanel({
            text: t.text, audio: t.audio, meta: meta('dialogues', `${d.id}#${k}`),
            evaluate: (alts) => sentenceOutcome(M.bestSentenceMatch(t.text, alts)),
            onResult: (o, src) => { turnStars.push(o.stars); sources.add(src); },
          }), h('div', { class: 'row end' }, next)));
      } else {
        stage.replaceChildren(h('div', { class: 'card' }, listenButtons(t.text, t.audio), h('div', { class: 'row end' }, next)));
        S.playModel(t.text, { audio: t.audio });
      }
      bubble.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    step(0);
  }
}

// ---------------- Đóng vai (kịch bản, chưa dùng AI) ----------------
function renderRoleplay(id) {
  const r = items('roleplays').find((x) => x.id === id);
  if (!r) return renderList('roleplays', 'Đóng vai', 'roleplays', (x) => x.situation_vi);
  const log = h('div', { class: 'chat' });
  const stage = h('div', { class: 'stage' });
  let okCount = 0;
  let selfUsed = false;
  root.replaceChildren(shell('Đóng vai',
    h('div', { class: 'card' }, draftBadge(r), h('h2', {}, r.title), h('p', {}, r.situation_vi),
      h('p', { class: 'note' }, 'Hội thoại theo kịch bản thầy cô duyệt · chưa dùng trí tuệ nhân tạo')),
    log, stage));

  const botSay = (text) => {
    log.append(h('div', { class: 'bubble them' }, h('b', {}, r.bot_name || 'Bạn trò chuyện'), h('p', {}, level() === 3 ? '🔊 …' : text)));
    S.playModel(text);
    return log.lastChild;
  };

  const step = (k) => {
    disposeAll();
    if (k >= r.turns.length) {
      botSay(r.closing);
      const stars = okCount === r.turns.length ? 3 : okCount >= r.turns.length / 2 ? 2 : 1;
      P.record({ ...meta('roleplays', r.id), source: selfUsed ? 'self_check' : 'asr_match', stars, detail: `tra_loi_phu_hop=${okCount}/${r.turns.length}` });
      stage.replaceChildren(h('div', { class: 'card center' }, h('p', { class: 'big-emoji' }, '🎉'),
        h('p', {}, `Máy nhận ra ${okCount}/${r.turns.length} câu trả lời đúng ý.`), h('p', { class: 'item-stars' }, starsText(stars)),
        h('div', { class: 'row center' }, h('button', { class: 'btn btn-soft', onclick: () => renderRoleplay(r.id) }, 'Chơi lại'),
          h('a', { class: 'btn btn-main', href: '#/roleplays' }, 'Tình huống khác'))));
      return;
    }
    const t = r.turns[k];
    const botBubble = botSay(t.bot);
    const hint = h('p', { class: 'example', hidden: level() === 3 }, '💡 ', t.hint, ' ', h('button', { class: 'link-btn', onclick: () => S.playModel(t.hint) }, '🔊'));
    let firstTry = true;
    const next = h('button', { class: 'btn btn-soft', onclick: () => step(k + 1) }, 'Bỏ qua ›');
    stage.replaceChildren(h('div', { class: 'card' },
      h('div', { class: 'row' }, h('button', { class: 'btn btn-soft', onclick: () => S.playModel(t.bot) }, '🔊 Nghe lại câu hỏi'),
        level() === 3 ? h('button', { class: 'btn btn-soft', onclick: () => { botBubble.querySelector('p').textContent = t.bot; } }, '👀 Xem chữ') : null,
        level() === 3 ? h('button', { class: 'btn btn-soft', onclick: () => { hint.hidden = false; } }, '💡 Gợi ý') : null),
      hint,
      speakPanel({
        text: null, meta: meta('roleplays', `${r.id}#${k}`),
        evaluate: (alts) => {
          const m = M.anyTerm(t.expect_any, alts);
          return m.ok
            ? { stars: 3, title: 'Câu trả lời đúng ý. Cùng nói tiếp nhé!', body: [heardLine(m.heard)], detail: 'dung_y' }
            : { stars: 1, title: 'Máy chưa nghe ra ý trả lời cho câu hỏi này. Bạn xem gợi ý rồi thử lại nhé.', body: [heardLine(m.heard)], detail: 'chua_dung_y' };
        },
        onResult: (o, src) => {
          if (src === 'self_check') selfUsed = true;
          if (o.stars >= 2) {
            if (firstTry || src === 'self_check') okCount++;
            log.append(h('div', { class: 'bubble me' }, h('b', {}, 'Bạn'), h('p', {}, src === 'self_check' ? '(bạn đã trả lời)' : o.body[0].querySelector('q').textContent)));
            next.textContent = 'Tiếp ›';
            next.className = 'btn btn-main';
          } else { firstTry = false; hint.hidden = false; }
        },
      }),
      h('div', { class: 'row end' }, next)));
  };
  step(0);
}

// ---------------- Nói qua tranh ----------------
function renderPicture(id) {
  const p = items('picture_tasks').find((x) => x.id === id);
  if (!p) return renderList('picture_tasks', 'Nói qua tranh', 'pictures', (x) => x.title_vi);
  const cfg = p.prompts[String(level())];
  const model = h('p', { class: 'example', hidden: true }, cfg.model_answer, ' ', h('button', { class: 'link-btn', onclick: () => S.playModel(cfg.model_answer) }, '🔊'));
  root.replaceChildren(shell('Nói qua tranh',
    h('div', { class: 'card' }, draftBadge(p),
      h('h2', {}, p.title), h('p', { class: 'muted' }, p.title_vi),
      p.image ? h('img', { class: 'pic', src: p.image, alt: p.title }) : h('div', { class: 'scene', role: 'img', 'aria-label': 'tranh minh họa' }, ...p.scene_emoji.map((e) => (e.includes('/') ? h('img', { src: e, alt: '' }) : h('span', {}, e)))),
      h('p', { class: 'task' }, cfg.prompt_vi),
      h('button', { class: 'link-btn', onclick: (e) => { model.hidden = false; e.target.remove(); } }, '💡 Xem câu mẫu'), model,
      h('p', { class: 'item-stars' }, starsText(P.bestStars(U(), p.id))),
      speakPanel({
        text: null, continuous: level() > 1, meta: meta('picture_tasks', p.id),
        evaluate: (alts) => {
          const r = M.findKeywords(p.keywords, alts);
          const kwOk = r.found.length >= cfg.min_keywords;
          const lenOk = r.wordCount >= cfg.min_words;
          const stars = kwOk && lenOk ? 3 : kwOk || lenOk ? 2 : alts.length ? 1 : 0;
          const title = stars === 3 ? 'Bạn đã nói đủ ý về bức tranh. Tuyệt!'
            : !kwOk ? 'Bạn thử nói thêm tên các đồ vật, hoạt động trong tranh nhé.'
            : 'Bạn thử nói dài hơn, thêm một câu nữa nhé.';
          return {
            stars, title, detail: `tu_khoa=${r.found.length};so_tu=${r.wordCount}`,
            body: [h('div', { class: 'chips' }, ...(r.found.length ? r.found.map((k) => h('span', { class: 'chip ok' }, '✓ ', k)) : [h('span', { class: 'muted' }, 'Chưa nghe thấy từ khóa nào')])),
              h('p', { class: 'muted' }, `Máy nghe được ${r.wordCount} từ.`), heardLine(r.heard)],
          };
        },
      }))));
}

// ---------------- Điều hướng ----------------
function render() {
  disposeAll();
  const [, route = '', arg] = location.hash.split('/');
  window.scrollTo(0, 0);
  if (needLogin) return renderLogin();
  switch (route) {
    case 'vocab': return renderVocab(Number(arg) || 0);
    case 'patterns': return renderPatterns(Number(arg) || 0);
    case 'challenge': return renderChallenge();
    case 'dialogues': return arg ? renderDialogue(decodeURIComponent(arg)) : renderList('dialogues', 'Hội thoại', 'dialogues', (x) => x.title_vi);
    case 'roleplays': return arg ? renderRoleplay(decodeURIComponent(arg)) : renderList('roleplays', 'Đóng vai', 'roleplays', (x) => x.situation_vi);
    case 'pictures': return arg ? renderPicture(decodeURIComponent(arg)) : renderList('picture_tasks', 'Nói qua tranh', 'pictures', (x) => x.title_vi);
    default: return renderHome();
  }
}

async function start() {
  try {
    index = await C.loadIndex();
    const entry = index.units.find((u) => u.file);
    const imported = preview ? C.getImported() : null;
    unit = C.applyOverlay(imported || await C.loadUnit(entry.file));
    fromExcel = Boolean(imported);
    const errors = C.validate(unit);
    if (errors.length) {
      root.replaceChildren(h('div', { class: 'card warn' }, h('h2', {}, 'Dữ liệu bài học có lỗi'), h('p', {}, 'Báo thầy cô kiểm tra trang giáo viên.'),
        h('ul', {}, ...errors.slice(0, 10).map((e) => h('li', {}, e)))));
      return;
    }
    if (!preview && Cloud.configured() && !Cloud.isGuest()) {
      root.replaceChildren(h('p', { class: 'loading' }, 'Đang vào lớp…'));
      try { needLogin = !(await Promise.race([Cloud.restore(), new Promise((r) => setTimeout(() => r(null), 12000))])); }
      catch (_) { needLogin = true; }
    }
    window.addEventListener('hashchange', render);
    window.addEventListener('sb-progress', () => { if (!needLogin && !location.hash.replace(/^#\/?/, '')) render(); });
    render();
  } catch (err) {
    root.replaceChildren(h('div', { class: 'card warn' }, h('h2', {}, 'Chưa mở được bài học'), h('p', {}, err.message),
      h('p', { class: 'muted' }, 'Nếu thầy cô mở tệp trực tiếp, hãy chạy start.bat để mở qua máy chủ nhỏ.')));
  }
}

start();
