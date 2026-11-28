// Thử thách từ vựng: nhìn hình, nói từ tiếng Anh.
// Kiểm tra: học sinh có nhớ ra từ không, và máy có NHẬN DIỆN được đúng từ đó không.
// Đây không phải chấm phát âm chi tiết (trọng âm, từng âm) — phần đó cần dịch vụ đánh giá phát âm ở giai đoạn 4.
import * as S from './speech.js';
import * as M from './match.js';
import * as P from './progress.js';
import { h, starsText, addCleanup } from './ui.js';
import * as Fx from './vanish.js';

const DEFAULTS = { title: 'Thử thách từ vựng', rounds: 10, tries_per_word: 2, seconds_by_level: { 1: 20, 2: 15, 3: 10 }, show_meaning_levels: [1], unlock: 'practised_at_least_rounds' };

export function config(unit) {
  return { ...DEFAULTS, ...((unit.challenges && unit.challenges.vocabulary) || {}) };
}

// Từ "đã luyện" = từ có ít nhất 1 sao trong phần Từ vựng, tính trên dữ liệu bài hiện tại
// (nhập Excel mới thì danh sách tự đổi; từ đã bị xóa khỏi bài không còn được tính).
export const practisedWords = (unitNo, words) => words.filter((v) => P.bestStars(unitNo, v.id) > 0);

// Luật mở khóa đặt trong dữ liệu bài (challenges.vocabulary.unlock):
//  - "practised_at_least_rounds": đã luyện đủ số từ của một ván (mặc định)
//  - "practised_all_words_in_level": đã luyện hết từ của mức
export function status({ unitNo, words, preview, unit }) {
  const cfg = config(unit);
  const done = practisedWords(unitNo, words).length;
  const need = cfg.unlock === 'practised_all_words_in_level' ? words.length : Math.min(cfg.rounds, words.length);
  return { done, need, total: words.length, unlocked: words.length > 0 && (preview || done >= need) };
}

export const challengeId = (lv) => `challenge-vocab-L${lv}`;
// Vượt chương khi ít nhất 90% số từ trong ván đạt từ 2 sao (làm tròn xuống, tối thiểu 1).
export const passNeed = (n) => (n ? Math.max(1, Math.floor(n * 0.9 + 1e-9)) : 0);

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const picture = (v, cls) => (v.image
  ? h('img', { class: `pic ${cls || ''}`, src: v.image, alt: 'tranh của từ cần nói' })
  : h('div', { class: `pic-emoji ${cls || ''}`, role: 'img', 'aria-label': 'tranh của từ cần nói' }, v.emoji || '🖼️'));

const thumb = (v) => (v.image ? h('img', { class: 'thumb', src: v.image, alt: '' }) : `${v.emoji || ''} `);

const maskWord = (w) => w.split(' ').map((part) => part[0] + ' _'.repeat(Math.max(0, part.length - 1))).join('   ');

/**
 * ctx: { root, shell(title, ...nodes), unitNo, level, preview, words, unit }
 */
export function render(ctx) {
  const { root, shell, unitNo, level, words, preview, unit } = ctx;
  const cfg = { ...config(unit), title: 'Chương 1 · Thử thách từ vựng' };
  const st = status({ unitNo, words, preview, unit });
  const best = P.bestStars(unitNo, challengeId(level));

  if (!st.unlocked) {
    root.replaceChildren(shell(cfg.title,
      h('div', { class: 'card center' },
        h('p', { class: 'big-emoji' }, '🔒'),
        h('h2', {}, `Thử thách Mức ${level} đang khóa`),
        h('p', {}, `Bạn luyện nói ít nhất ${st.need} từ của Mức ${level} để mở khóa nhé.`),
        h('div', { class: 'meter', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(st.need), 'aria-valuenow': String(st.done) },
          h('span', { style: `width:${st.need ? Math.min(100, Math.round((st.done / st.need) * 100)) : 0}%` })),
        h('p', { class: 'muted' }, `Đã luyện ${st.done}/${st.need} từ`),
        h('a', { class: 'btn btn-main', href: '#/vocab' }, '🔤 Luyện từ vựng'))));
    return;
  }

  const seconds = Number(cfg.seconds_by_level[String(level)] || 15);
  const showMeaning = (cfg.show_meaning_levels || []).includes(level);
  // Chỉ lấy từ bạn đã luyện. Ở chế độ xem trước của giáo viên, nếu chưa luyện từ nào thì dùng tất cả.
  let pool = practisedWords(unitNo, words);
  const previewAll = preview && pool.length === 0;
  if (previewAll) pool = words;
  const rounds = Math.min(cfg.rounds, pool.length);
  const tries = Math.max(1, cfg.tries_per_word);

  root.replaceChildren(shell(cfg.title,
    h('div', { class: 'card center game-intro' },
      h('p', { class: 'big-emoji' }, '🏆'),
      h('h2', {}, `${cfg.title} · Mức ${level}`),
      best ? h('p', { class: 'item-stars' }, `Kết quả tốt nhất: ${starsText(best)}`) : null,
      h('ul', { class: 'rules' },
        h('li', {}, previewAll
          ? `Có ${rounds} hình, chọn ngẫu nhiên trong ${pool.length} từ (xem trước: chưa luyện từ nào nên dùng tất cả).`
          : `Có ${rounds} hình, chọn ngẫu nhiên trong ${pool.length} từ bạn đã luyện.`),
        h('li', {}, 'Nhìn hình rồi bấm 🎤 và nói từ tiếng Anh.'),
        h('li', {}, `Mỗi từ được nói ${tries} lần. Có ${seconds} giây để nghĩ trước khi bấm 🎤.`),
        h('li', {}, 'Đúng ở lần 1: 3 điểm · lần 2: 2 điểm · có dùng gợi ý: 1 điểm.'),
        h('li', {}, `Vượt chương khi có ít nhất ${passNeed(rounds)}/${rounds} từ đạt từ ⭐⭐ (nói đúng ở lần 1 hoặc 2, không dùng gợi ý).`),
        showMeaning ? h('li', {}, 'Ở Mức 1 có nghĩa tiếng Việt đi kèm hình.') : null),
      h('p', { class: 'note' }, 'Máy kiểm tra bạn có nói ra đúng từ không. Đây chưa phải chấm phát âm chi tiết.'),
      h('button', { class: 'btn btn-main', onclick: () => play() }, '▶ Bắt đầu'))));

  function play() {
    const deck = shuffle(pool).slice(0, rounds);
    const results = [];
    let score = 0;
    let combo = 0;
    let usedSelfCheck = false;
    const max = deck.length * 3;

    const hud = h('div', { class: 'hud' });
    const stage = h('div', { class: 'card center game' });
    root.replaceChildren(shell(cfg.title, hud, stage));
    const drawHud = (k) => hud.replaceChildren(
      h('span', {}, `Hình ${Math.min(k + 1, deck.length)}/${deck.length}`),
      h('span', {}, `⭐ ${score} điểm`),
      h('span', { class: combo >= 2 ? 'combo on' : 'combo' }, combo >= 2 ? `🔥 ${combo} liên tiếp` : ''));

    const round = (k) => {
      if (k >= deck.length) return finish();
      const v = deck[k];
      let attempt = 0;
      let hintLevel = 0;
      let timer = null;
      let left = seconds * 10;
      let busy = false;
      drawHud(k);

      const bar = h('span', { style: 'width:100%' });
      const meter = h('div', { class: 'meter timer', 'aria-hidden': 'true' }, bar);
      const meaning = h('p', { class: 'meaning', hidden: !showMeaning }, v.meaning_vi);
      const hintLine = h('p', { class: 'hint-line', hidden: true });
      const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
      const setFeedback = (...nodes) => feedback.replaceChildren(...nodes.filter(Boolean));
      const sayBtn = h('button', { class: 'btn btn-main' }, S.support.recognition ? '🎤 Nói' : '🗣️ Bạn đã nói xong');
      const hintBtn = h('button', { class: 'btn btn-soft' }, '💡 Gợi ý');
      const skipBtn = h('button', { class: 'btn btn-soft' }, 'Bỏ qua');
      const controls = h('div', { class: 'row center' }, sayBtn, hintBtn, skipBtn);

      const stopTimer = () => { if (timer) { clearInterval(timer); timer = null; } };
      addCleanup(stopTimer);
      const startTimer = () => {
        stopTimer();
        const deadline = Date.now() + left * 100;
        timer = setInterval(() => {
          left = Math.max(0, Math.round((deadline - Date.now()) / 100));
          bar.style.width = `${(left / (seconds * 10)) * 100}%`;
          if (left <= 0) { stopTimer(); reveal('Hết giờ rồi!'); }
        }, 100);
      };

      const next = (label = 'Tiếp ›') => h('button', { class: 'btn btn-main', onclick: () => round(k + 1) }, k + 1 >= deck.length ? 'Xem kết quả' : label);

      const win = (heard) => {
        const pts = hintLevel > 0 ? 1 : attempt === 0 ? 3 : 2;
        score += pts; combo += 1;
        results.push({ v, ok: true, pts, heard });
        drawHud(k);
        stage.classList.add('flash-ok');
        Fx.vanish(stage.querySelector('.game-pic'));
        setFeedback(
          h('p', { class: 'result-title ok-text' }, `✓ Đúng rồi: ${v.word}  (+${pts})`),
          h('p', { class: 'ipa' }, v.ipa),
          heard ? h('p', { class: 'heard' }, 'Máy nghe được: ', h('q', {}, heard)) : null);
        controls.replaceChildren(next());
        S.playModel(v.word, { audio: v.audio });
      };

      function reveal(reason, heard) {
        stopTimer();
        combo = 0;
        results.push({ v, ok: false, pts: 0, heard: heard || '' });
        drawHud(k);
        setFeedback(
          h('p', { class: 'result-title' }, `${reason} Từ đúng là:`),
          h('p', { class: 'word' }, v.word), h('p', { class: 'ipa' }, v.ipa),
          showMeaning ? null : h('p', { class: 'meaning' }, v.meaning_vi),
          heard ? h('p', { class: 'heard' }, 'Máy nghe được: ', h('q', {}, heard)) : null);
        controls.replaceChildren(h('button', { class: 'btn btn-soft', onclick: () => S.playModel(v.word, { audio: v.audio }) }, '🔊 Nghe từ'), next());
        S.playModel(v.word, { audio: v.audio });
      }

      hintBtn.addEventListener('click', () => {
        hintLevel += 1;
        if (!showMeaning && hintLevel === 1) { meaning.hidden = false; }
        else { hintLine.hidden = false; hintLine.textContent = maskWord(v.word); hintBtn.disabled = true; }
        if (showMeaning) hintBtn.disabled = true;
      });
      skipBtn.addEventListener('click', () => { if (!busy) reveal('Bạn bỏ qua từ này.'); });

      sayBtn.addEventListener('click', async () => {
        if (busy) { S.stopListening(); return; }
        stopTimer();
        if (!S.support.recognition) {
          // Trình duyệt không nhận diện được: hiện đáp án để học sinh tự đối chiếu.
          usedSelfCheck = true;
          feedback.replaceChildren(h('p', {}, 'Từ đúng là:'), h('p', { class: 'word' }, v.word), h('p', { class: 'ipa' }, v.ipa));
          S.playModel(v.word, { audio: v.audio });
          controls.replaceChildren(
            h('button', { class: 'btn btn-soft', onclick: () => win('') }, '😀 Bạn nói đúng'),
            h('button', { class: 'btn btn-soft', onclick: () => reveal('Không sao, lần sau nhé.') }, '🤔 Bạn nói chưa đúng'));
          return;
        }
        busy = true;
        sayBtn.classList.add('active');
        sayBtn.textContent = '👂 Máy đang nghe…';
        hintBtn.disabled = true; skipBtn.disabled = true;
        const res = await S.listen();
        busy = false;
        sayBtn.classList.remove('active');
        sayBtn.textContent = '🎤 Nói lại';
        hintBtn.disabled = hintLevel >= 2 || (showMeaning && hintLevel >= 1); skipBtn.disabled = false;
        if (res.error) { feedback.replaceChildren(h('p', { class: 'warn' }, res.message || 'Máy chưa nghe được, bạn bấm 🎤 nói lại nhé.')); return; }
        const m = M.matchWord(v.word, v.accepted_variants, res.alternatives);
        if (m.ok) return win(m.heard);
        attempt += 1;
        if (attempt >= tries) return reveal('Máy chưa nghe ra từ cần nói.', m.heard);
        feedback.replaceChildren(
          h('p', { class: 'warn' }, `Máy nghe thành “${m.heard || '…'}”. Bạn thử lần nữa nhé!`),
          h('p', { class: 'muted' }, `Còn ${tries - attempt} lần.`));
      });

      stage.classList.remove('flash-ok');
      stage.replaceChildren(meter, picture(v, 'game-pic'), meaning, hintLine, controls, feedback);
      startTimer();
    };

    const finish = () => {
      const correct = results.filter((r) => r.ok);
      // Từ đạt từ 2 sao = nói đúng ở lần 1 (3 điểm) hoặc lần 2 (2 điểm), không dùng gợi ý.
      const good = results.filter((r) => r.ok && r.pts >= 2).length;
      const need = passNeed(results.length);
      const stars = good >= need ? (good === results.length ? 3 : 2) : correct.length ? 1 : 0;
      P.record({ unit: unitNo, activity: 'challenge', item: challengeId(level), level, source: usedSelfCheck ? 'self_check' : 'asr_match',
        stars, detail: `dat2sao=${good}/${results.length};can=${need};dung=${correct.length};diem=${score}/${max}` });
      const missed = results.filter((r) => !r.ok);
      const title = stars === 3 ? 'Xuất sắc! 🎉' : stars === 2 ? 'Làm tốt lắm! 👏' : 'Cố gắng thêm nhé! 💪';
      root.replaceChildren(shell(cfg.title,
        h('div', { class: 'card center' },
          h('h2', {}, title),
          h('p', { class: 'result-stars s' + stars }, starsText(stars)),
          h('p', { class: 'score' }, `${score} / ${max} điểm · đúng ${correct.length}/${results.length} từ`),
          h('p', { class: good >= need ? 'ok-text' : 'warn' }, good >= need
            ? `✓ ${good}/${results.length} từ đạt từ ⭐⭐ — bạn đã vượt chương này!`
            : `${good}/${results.length} từ đạt từ ⭐⭐. Cần ${need} từ để vượt chương này, bạn chơi lại nhé!`),
          h('p', { class: 'note' }, 'Kết quả cho biết máy nhận ra đúng bao nhiêu từ bạn nói. Đây chưa phải điểm phát âm.')),
        correct.length ? h('div', { class: 'card' }, h('h2', {}, 'Từ bạn nói đúng'),
          h('div', { class: 'chips' }, ...correct.map((r) => h('span', { class: 'chip ok' }, thumb(r.v), r.v.word)))) : null,
        missed.length ? h('div', { class: 'card' }, h('h2', {}, 'Từ cần luyện thêm'),
          h('div', { class: 'list' }, ...missed.map((r) => h('div', { class: 'list-item' },
            h('span', {}, thumb(r.v), h('b', {}, r.v.word), ` ${r.v.ipa} · ${r.v.meaning_vi}`),
            h('button', { class: 'btn btn-soft', onclick: () => S.playModel(r.v.word, { audio: r.v.audio }) }, '🔊'))))) : null,
        h('div', { class: 'row center' },
          h('button', { class: 'btn btn-main', onclick: () => play() }, '🔁 Chơi lại'),
          h('a', { class: 'btn btn-soft', href: '#/vocab' }, '🔤 Luyện từ vựng'),
          h('a', { class: 'btn btn-soft', href: '#/' }, 'Về trang chính'))));
    };

    round(0);
  }
}
