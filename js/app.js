// Ứng dụng học sinh SpeakBoost – bản mẫu Unit 1.
import * as C from './content.js';
import * as S from './speech.js';
import * as M from './match.js';
import * as P from './progress.js';
import { h, speakPanel, listenButtons, sentenceOutcome, heardLine, starsText, disposeAll } from './ui.js';
import * as Challenge from './challenge.js';
import * as Cloud from './cloud.js';
import * as G from './grading.js';

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

// ---------------- Trang chính (giao diện "phép thuật") ----------------
// Mỗi mức là một vùng đất trên bản đồ. Tên vùng chỉ để tạo hứng thú; nội dung vẫn là Mức 1 – 2 – 3.
const WORLDS = {
  1: { name: 'Vương quốc Phù Thủy', sub: 'Làm quen · Giao tiếp cơ bản', img: 'assets/theme/island1.png' },
  2: { name: 'Rừng Ánh Sáng', sub: 'Mở rộng · Luyện phản xạ', img: 'assets/theme/island2.png' },
  3: { name: 'Thung Lũng Pha Lê', sub: 'Vận dụng · Tự tin hơn', img: 'assets/theme/island3.png' },
};
const ACT_ART = { vocabulary: 'assets/theme/icon-vocab.png', patterns: 'assets/theme/icon-patterns.png', dialogues: 'assets/theme/icon-dialogues.png', roleplays: 'assets/theme/icon-roleplays.png' };

// Tiến độ của một vùng: số từ vựng + mẫu câu ĐÚNG mức đó đã luyện, và thử thách của mức đó.
function levelProgress(lv) {
  const list = [...items('vocabulary'), ...items('patterns')].filter((x) => (x.level || 1) === lv);
  const done = list.filter((x) => P.bestStars(U(), x.id) > 0).length;
  return { done, total: list.length, pct: list.length ? Math.round((done / list.length) * 100) : 0, trophy: P.bestStars(U(), Challenge.challengeId(lv)) };
}

function logo() {
  return h('a', { class: 'mh-logo', href: '#/', 'aria-label': 'SpeakBoost – trang chính' },
    h('span', { class: 'mh-logo-icon', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'), h('i')),
    h('span', { class: 'mh-logo-text' }, 'Speak', h('b', {}, 'Boost')));
}

function unitPicker() {
  const sel = h('select', { class: 'mh-unit', 'aria-label': 'Chọn Unit', onchange: (e) => { if (Number(e.target.value) !== U()) e.target.value = U(); } },
    ...(index?.units || [{ unit: U(), file: true }]).map((u) => h('option', { value: u.unit, disabled: !u.file, selected: u.unit === U() }, `Unit ${u.unit}${u.file ? '' : ' · sắp có'}`)));
  return h('label', { class: 'mh-unit-wrap' }, h('span', { class: 'mh-bars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')), sel);
}

function avatar() {
  const st = Cloud.student();
  const menu = h('div', { class: 'mh-menu', hidden: true },
    st ? h('p', {}, h('b', {}, st.nickname), h('br'), `Số ${st.roster_no} · Lớp ${st.class_name}`) : h('p', {}, 'Bạn đang học thử (không lưu kết quả).'),
    st ? h('button', { class: 'btn btn-soft', onclick: switchStudent }, '🔄 Đổi bạn')
      : (Cloud.configured() && !preview ? h('button', { class: 'btn btn-main', onclick: () => { Cloud.setGuest(false); needLogin = true; render(); } }, '🏫 Đăng nhập lớp') : null));
  const btn = h('button', { class: 'mh-avatar', 'aria-label': 'Tài khoản', 'aria-expanded': 'false', onclick: () => {
    menu.hidden = !menu.hidden; btn.setAttribute('aria-expanded', String(!menu.hidden));
  } }, st ? st.nickname.trim().charAt(0).toUpperCase() : h('span', { class: 'mh-user', 'aria-hidden': 'true' }));
  return h('div', { class: 'mh-acc' }, btn, menu);
}

async function switchStudent() { await Cloud.signOut(); needLogin = true; location.hash = '#/'; render(); }

function worldMap() {
  const cur = level();
  const stations = unit.levels.map((l) => {
    const w = WORLDS[l.id] || { name: `Mức ${l.id}`, sub: l.name, img: '' };
    const pg = levelProgress(l.id);
    const on = l.id === cur;
    return h('button', {
      class: `mh-world w${l.id} ${on ? 'on' : ''}`, 'aria-pressed': String(on),
      'aria-label': `Mức ${l.id}: ${w.name}. Đã luyện ${pg.done}/${pg.total}${pg.trophy ? ', đã vượt thử thách' : ''}`,
      onclick: () => { P.setLevel(l.id); render(); },
    },
      h('span', { class: 'mh-island' }, w.img ? h('img', { src: w.img, alt: '' }) : null,
        on ? h('span', { class: 'mh-here' }, 'Bạn ở đây') : null,
        pg.trophy ? h('img', { class: 'mh-cup', src: 'assets/theme/shield.png', alt: 'Đã vượt thử thách', title: 'Đã vượt thử thách' }) : null),
      h('span', { class: 'mh-scroll' }, h('span', { class: 'mh-num' }, l.id), w.name),
      h('span', { class: 'mh-sub' }, w.sub),
      h('span', { class: 'mh-prog', 'aria-hidden': 'true' }, h('span', { style: `width:${pg.pct}%` })));
  });
  return h('section', { class: 'mh-map', 'aria-label': 'Bản đồ 3 mức' },
    h('img', { class: 'mh-cat', src: 'assets/theme/cat.png', alt: '' }),
    h('div', { class: 'mh-worlds' }, ...stations));
}

function renderHome() {
  const cards = ACTIVITIES.map((a) => {
    const list = a.key === 'vocabulary' || a.key === 'patterns' ? byLevel(items(a.key)) : items(a.key);
    const sum = P.summary(U(), list.map((x) => x.id));
    const disabled = list.length === 0;
    return h(disabled ? 'div' : 'a', { class: `mh-card ${disabled ? 'off' : ''}`, href: disabled ? null : `#/${a.route}` },
      h('span', { class: 'mh-card-art' }, h('img', { src: ACT_ART[a.key], alt: '' })),
      h('span', { class: 'mh-card-name' }, a.name),
      h('span', { class: 'mh-bar' }, h('span', { style: `width:${sum.total ? Math.round((sum.done / sum.total) * 100) : 0}%` })),
      h('span', { class: 'mh-count' }, disabled ? '—' : `${sum.done} / ${sum.total}`));
  });

  // Thử thách: mở khi đã luyện đủ số từ ở mức hiện tại.
  const words = byLevel(items('vocabulary'));
  let quest = null;
  if (words.length) {
    const st = Challenge.status({ unitNo: U(), words, preview, unit });
    const best = P.bestStars(U(), Challenge.challengeId(level()));
    quest = h('section', { class: `mh-quest ${st.unlocked ? '' : 'locked'}` },
      h('img', { class: 'mh-chest', src: 'assets/theme/chest.png', alt: '' }),
      h('div', { class: 'mh-quest-text' },
        h('h2', {}, 'Thử thách hôm nay'),
        h('p', {}, st.unlocked
          ? (best ? `Kỷ lục của bạn: ${starsText(best)} · Thử lại để thu thêm pha lê!` : 'Luyện nói nhanh · Thu thập pha lê · Mở khóa vùng đất tiếp theo!')
          : `Luyện thêm ${Math.max(0, st.need - st.done)} từ ở mức này để mở rương báu (${st.done}/${st.need}).`)),
      h('img', { class: 'mh-crystal', src: 'assets/theme/crystal.png', alt: '' }),
      st.unlocked ? h('a', { class: 'mh-go', href: '#/challenge' }, 'Vào ngay ', h('span', { 'aria-hidden': 'true' }, '»'))
        : h('span', { class: 'mh-go locked', 'aria-label': 'Chưa mở' }, '🔒'));
  }

  const anyVisible = ACTIVITIES.some((a) => items(a.key).length);
  const totalStars = P.summary(U(), ACTIVITIES.flatMap((a) => items(a.key).map((x) => x.id))).stars;
  const st = Cloud.student();
  root.replaceChildren(h('div', { class: 'mh' },
    preview ? h('div', { class: 'preview-banner' }, 'CHẾ ĐỘ XEM TRƯỚC CỦA GIÁO VIÊN · có cả nội dung chưa duyệt',
      fromExcel ? ' · nội dung nhập từ Excel trên máy này, chưa đưa lên web' : '') : null,
    h('header', { class: 'mh-top' }, logo(), h('div', { class: 'mh-top-right' }, unitPicker(), avatar())),
    h('section', { class: 'mh-hero' },
      h('img', { class: 'mh-castle', src: 'assets/theme/castle.jpg', alt: '' }),
      h('div', { class: 'mh-hero-text' },
        h('span', { class: 'mh-ribbon' }, `Unit ${U()}`),
        h('h1', {}, unit.meta.title),
        h('p', { class: 'mh-tagline' }, unit.meta.title_vi ? `Luyện nói tiếng Anh · ${unit.meta.title_vi}` : 'Luyện nói tiếng Anh'),
        h('div', { class: 'mh-pills' },
          h('span', { class: 'mh-pill' }, '🔥 ', h('b', {}, P.daysPractised()), ' ngày'),
          h('span', { class: 'mh-pill' }, '⭐ ', h('b', {}, totalStars))))),
    supportNotice(),
    anyVisible ? null : emptyState('Thầy cô chưa duyệt nội dung bài này. Bạn chờ thầy cô nhé!'),
    anyVisible ? taskCard() : null,
    worldMap(),
    h('div', { class: 'mh-cards-wrap' }, h('img', { class: 'mh-lantern', src: 'assets/theme/lantern.png', alt: '' }),
      h('nav', { class: 'mh-cards', 'aria-label': 'Hoạt động' }, ...cards)),
    quest,
    h('footer', { class: 'mh-foot' },
      st ? h('span', { class: 'mh-foot-item' }, '👥 ', `${st.nickname} · Lớp ${st.class_name}`)
        : (preview || !Cloud.configured() ? null : h('button', { class: 'mh-foot-item link', onclick: () => { Cloud.setGuest(false); needLogin = true; render(); } }, '🏫 Đăng nhập lớp')),
      st ? h('button', { class: 'mh-foot-item link', onclick: switchStudent }, '🔄 Đổi bạn') : null,
      h('span', { class: 'mh-foot-item' }, '🎙️ Không lưu giọng nói'),
      h('a', { class: 'mh-foot-item link', href: 'dashboard.html' }, '🎓 Giáo viên')),
  ));
}

const SECTION_ROUTE = { vocabulary: '#/vocab', patterns: '#/patterns', dialogues: '#/dialogues', roleplays: '#/roleplays', challenge: '#/challenge' };
function taskCard() {
  const st = Cloud.student();
  if (!st || preview || G.isFree(st.assignment)) return null;   // lớp tự luyện: không hiện nhiệm vụ
  const c = G.completion(unit, st.assignment, P.attempts());
  if (!c.total) return null;
  const a = c.assignment;
  const stars = '⭐'.repeat(a.pass_stars);
  const list = h('div', { hidden: true },
    h('p', { class: 'muted' }, `Mỗi bài cần đạt từ ${stars} khi luyện ở đúng mức. Bạn đổi mức ở lộ trình bên dưới.`),
    ...a.levels.map((L) => {
      const miss = c.missing.filter((m) => m.level === L);
      const groups = {};
      for (const m of miss) (groups[m.section] = groups[m.section] || []).push(m);
      return h('div', {}, h('b', {}, `Mức ${L}: `), miss.length ? `còn ${miss.length} bài` : h('span', { class: 'task-done' }, 'xong rồi ✓'),
        miss.length ? h('ul', { class: 'task-list' }, ...Object.entries(groups).map(([s, ms]) =>
          h('li', {}, h('a', { href: SECTION_ROUTE[s], onclick: () => { if (level() !== L) P.setLevel(L); } }, ms[0].section === 'challenge' ? ms[0].label : `${ms.length} bài ${({ vocabulary: 'Từ vựng', patterns: 'Mẫu câu', dialogues: 'Hội thoại', roleplays: 'Đóng vai' })[s]}`),
            s === 'vocabulary' || s === 'patterns' ? h('span', { class: 'muted' }, `: ${ms.slice(0, 6).map((m) => m.label).join(', ')}${ms.length > 6 ? '…' : ''}`) : null))) : null);
    }));
  const toggle = h('button', { class: 'link-btn', onclick: () => { list.hidden = !list.hidden; toggle.textContent = list.hidden ? 'Xem bài còn thiếu' : 'Ẩn'; } }, 'Xem bài còn thiếu');
  const done = c.done === c.total;
  return h('section', { class: 'card task-card' },
    h('div', { class: 'task-head' },
      h('b', {}, done ? '🎉 Bạn đã hoàn thành bài được giao!' : '📋 Bài thầy cô giao'),
      h('span', { class: 'muted' }, a.levels.map((l) => `Mức ${l}`).join(' + '), a.due ? ` · hạn ${new Date(`${a.due}T00:00:00`).toLocaleDateString('vi-VN')}` : '')),
    h('div', { class: 'task-bar', role: 'progressbar', 'aria-valuenow': c.done, 'aria-valuemax': c.total, 'aria-label': 'Tiến độ bài được giao' },
      h('span', { style: `width:${Math.round(c.pct * 100)}%` })),
    h('div', { class: 'task-head' }, h('span', {}, `${c.done}/${c.total} bài đạt ${stars}`), done ? null : toggle),
    list);
}

// ---------------- Đăng nhập lớp (mã lớp → chọn tên → PIN) ----------------
function renderLogin(state = {}) {
  const msg = h('p', { class: 'warn', 'aria-live': 'polite', hidden: !state.error }, state.error || '');
  const fail = (e) => { msg.textContent = e.message || String(e); msg.hidden = false; };
  const guest = h('button', { class: 'link-btn', onclick: () => { Cloud.setGuest(true); needLogin = false; render(); } },
    'Học thử (không lưu kết quả, không được tính điểm)');
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
    h('button', { class: 'btn btn-soft', onclick: () => S.playSequence(d.turns.map((t) => t.text)) }, '🔊 Nghe cả bài'));
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
    S.loadAudioManifest(unit.meta.unit);   // tệp âm thanh mẫu; thiếu thì dùng giọng máy
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
