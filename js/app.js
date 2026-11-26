// Ứng dụng học sinh SpeakBoost – bản mẫu Unit 1.
import * as C from './content.js';
import * as S from './speech.js';
import * as M from './match.js';
import * as P from './progress.js';
import { h, speakPanel, listenButtons, sentenceOutcome, heardLine, starsText, disposeAll } from './ui.js';
import * as Challenge from './challenge.js';

const root = document.getElementById('app');
let unit = null;
let index = null;
let fromExcel = false;
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
function renderHome() {
  const unitsMap = h('div', { class: 'unit-map' }, ...index.units.map((u) =>
    h('div', { class: `unit-dot ${u.unit === U() ? 'current' : ''} ${u.file ? '' : 'locked'}`, title: u.title },
      h('b', {}, String(u.unit)), h('span', {}, u.file ? u.title : `${u.title} · sắp có`))));

  const levelPicker = h('div', { class: 'levels' }, ...unit.levels.map((l) =>
    h('button', {
      class: `level ${l.id === level() ? 'on' : ''}`, 'aria-pressed': String(l.id === level()),
      onclick: () => { P.setLevel(l.id); render(); },
    }, h('b', {}, `Mức ${l.id} · ${l.name}`), h('small', {}, l.description))));

  const tiles = ACTIVITIES.map((a) => {
    const list = a.key === 'vocabulary' || a.key === 'patterns' ? byLevel(items(a.key)) : items(a.key);
    const sum = P.summary(U(), list.map((x) => x.id));
    const disabled = list.length === 0;
    return h(disabled ? 'div' : 'a', { class: `tile ${disabled ? 'disabled' : ''}`, href: disabled ? null : `#/${a.route}` },
      h('span', { class: 'tile-icon' }, a.icon),
      h('span', { class: 'tile-name' }, a.name),
      h('span', { class: 'tile-desc' }, disabled ? 'Chưa có nội dung đã duyệt' : a.desc),
      disabled ? null : h('span', { class: 'tile-progress' }, `${sum.done}/${sum.total} · ${sum.stars} ★`));
  });

  const words = byLevel(items('vocabulary'));
  if (words.length) {
    const st = Challenge.status({ unitNo: U(), words, preview, unit });
    const best = P.bestStars(U(), Challenge.challengeId(level()));
    tiles.push(h('a', { class: `tile challenge-tile ${st.unlocked ? '' : 'locked'}`, href: '#/challenge' },
      h('span', { class: 'tile-icon' }, st.unlocked ? '🏆' : '🔒'),
      h('span', { class: 'tile-name' }, `Thử thách Mức ${level()}`),
      h('span', { class: 'tile-desc' }, st.unlocked ? 'Nhìn hình, nói đúng từ tiếng Anh' : `Luyện ${st.need} từ vựng để mở khóa`),
      h('span', { class: 'tile-progress' }, st.unlocked ? (best ? `Tốt nhất ${starsText(best)}` : 'Đã mở khóa!') : `${st.done}/${st.need} từ`)));
  }

  const anyVisible = ACTIVITIES.some((a) => items(a.key).length);
  root.replaceChildren(shell(null,
    h('section', { class: 'hero' },
      h('p', { class: 'eyebrow' }, `${unit.meta.book} · Unit ${U()}`),
      h('h1', {}, unit.meta.title),
      h('p', { class: 'muted' }, unit.meta.title_vi),
      h('p', { class: 'stat' }, `Em đã luyện ${P.daysPractised()} ngày · Ghi âm và nghe lại có trong mọi hoạt động`)),
    supportNotice(),
    anyVisible ? null : emptyState('Thầy cô chưa duyệt nội dung bài này. Em chờ thầy cô nhé!'),
    h('h2', {}, 'Chọn mức độ'),
    levelPicker,
    h('h2', {}, 'Hoạt động'),
    h('div', { class: 'tiles' }, ...tiles),
    h('h2', {}, 'Các bài'),
    unitsMap,
    h('footer', { class: 'foot' },
      h('p', {}, '🔒 SpeakBoost không hỏi tên em. Giọng nói và bản ghi âm không được lưu lên mạng.'),
      h('p', {}, 'Ngôi sao cho biết máy nhận diện được bao nhiêu chữ em nói. Đó không phải điểm phát âm.'),
      h('a', { href: 'teacher.html', class: 'muted' }, 'Dành cho giáo viên')),
  ));
}

function supportNotice() {
  const env = S.environment();
  if (env === 'in-app' || env === 'embedded') return h('div', { class: 'notice' }, h('b', {}, 'Micro chưa dùng được ở đây. '), S.micHelp());
  if (S.support.recognition) return null;
  return h('div', { class: 'notice' },
    h('b', {}, 'Trình duyệt này chưa nhận diện được lời nói. '),
    'Em vẫn nghe mẫu, ghi âm và tự đánh giá được. Để máy nghe em nói, hãy mở bằng Chrome hoặc Edge.');
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
      : { stars: alts.length ? 1 : 0, title: `Máy chưa nghe ra từ “${lv === 2 ? '…' : v.word}”. Em nghe mẫu rồi thử lại nhé.`, body: [heardLine(r.heard)], detail: 'chua_khop_tu' };
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
    body = [h('p', { class: 'task' }, 'Nói cả câu, điền vào chỗ trống một từ em chọn:'), h('p', { class: 'sentence' }, p.frame),
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
      const title = stars === 3 ? 'Câu của em có đủ các phần của khung câu. Rất tốt!'
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
    draftBadge(d), h('h2', {}, d.title), h('p', { class: 'muted' }, d.title_vi), h('p', {}, 'Em muốn đóng vai ai?'),
    h('div', { class: 'row center' }, ...d.roles.map((r) => h('button', { class: 'btn btn-main', onclick: () => play(r) }, r))),
    h('button', { class: 'btn btn-soft', onclick: () => S.playModel(d.turns.map((t) => t.text).join(' ')) }, '🔊 Nghe cả bài'));
  root.replaceChildren(shell('Hội thoại', pick));

  function play(role) {
    const log = h('div', { class: 'chat' });
    const stage = h('div', { class: 'stage' });
    const turnStars = [];
    let sources = new Set();
    root.replaceChildren(shell('Hội thoại', h('p', { class: 'muted' }, `${d.title} · Em là ${role}`), log, stage));

    const step = (k) => {
      disposeAll();
      if (k >= d.turns.length) {
        const avg = turnStars.length ? Math.max(1, Math.round(turnStars.reduce((a, b) => a + b, 0) / turnStars.length)) : 1;
        P.record({ ...meta('dialogues', d.id), source: sources.has('asr_match') ? 'asr_match' : 'self_check', stars: avg, detail: `vai=${role}` });
        stage.replaceChildren(h('div', { class: 'card center' }, h('p', { class: 'big-emoji' }, '🎉'), h('p', {}, 'Em đã hoàn thành hội thoại!'),
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
        stage.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'task' }, 'Đến lượt em nói:'),
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
            : { stars: 1, title: 'Máy chưa nghe ra ý trả lời cho câu hỏi này. Em xem gợi ý rồi thử lại nhé.', body: [heardLine(m.heard)], detail: 'chua_dung_y' };
        },
        onResult: (o, src) => {
          if (src === 'self_check') selfUsed = true;
          if (o.stars >= 2) {
            if (firstTry || src === 'self_check') okCount++;
            log.append(h('div', { class: 'bubble me' }, h('b', {}, 'Em'), h('p', {}, src === 'self_check' ? '(em đã trả lời)' : o.body[0].querySelector('q').textContent)));
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
          const title = stars === 3 ? 'Em đã nói đủ ý về bức tranh. Tuyệt!'
            : !kwOk ? 'Em thử nói thêm tên các đồ vật, hoạt động trong tranh nhé.'
            : 'Em thử nói dài hơn, thêm một câu nữa nhé.';
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
    window.addEventListener('hashchange', render);
    render();
  } catch (err) {
    root.replaceChildren(h('div', { class: 'card warn' }, h('h2', {}, 'Chưa mở được bài học'), h('p', {}, err.message),
      h('p', { class: 'muted' }, 'Nếu thầy cô mở tệp trực tiếp, hãy chạy start.bat để mở qua máy chủ nhỏ.')));
  }
}

start();
