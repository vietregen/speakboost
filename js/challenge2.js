// Thử thách Chương 2 · Hội thoại nhanh: nghe câu hỏi rồi trả lời thật nhanh.
// Câu hỏi lấy từ các lượt nói của máy trong phần Đóng vai (đã được giáo viên duyệt),
// học sinh trả lời TỰ DO; câu được tính khi máy nghe được một câu trả lời rõ ý (từ 2 sao, xem freetalk.js).
// Máy chỉ nhận xét câu trả lời nghe được, không chấm phát âm.
import * as S from './speech.js';
import * as Free from './freetalk.js';
import * as P from './progress.js';
import { h, starsText, addCleanup } from './ui.js';
import * as Fx from './vanish.js';

export const TITLE = 'Chương 2 · Hội thoại nhanh';
const ROUNDS = 8;
const TRIES = 2;
const SECONDS = { 1: 20, 2: 15, 3: 12 };
export const challengeId = (lv) => `challenge-dialog-L${lv}`;
// Vượt chương khi ít nhất 90% số câu trong ván đạt từ 2 sao (làm tròn xuống, tối thiểu 1).
const passNeed = (n) => (n ? Math.max(1, Math.floor(n * 0.9 + 1e-9)) : 0);

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Mọi câu hỏi có thể dùng: lượt nói của máy trong các bài Đóng vai đã duyệt.
export function questions(roleplays) {
  const out = [];
  for (const r of roleplays || []) for (const t of r.turns || []) {
    if (t.bot) out.push({ q: t.bot, expect: t.expect_any, hint: t.hint || '', who: r.bot_name || 'Bạn trò chuyện', topic: r.title });
  }
  return out;
}

/** ctx: { root, shell, unitNo, level, roleplays } */
export function render(ctx) {
  const { root, shell, unitNo, level } = ctx;
  const pool = questions(ctx.roleplays);
  const best = P.bestStars(unitNo, challengeId(level));
  const seconds = SECONDS[level] || 15;
  const rounds = Math.min(ROUNDS, pool.length);

  if (!pool.length) {
    root.replaceChildren(shell(TITLE, h('div', { class: 'card center' }, h('p', { class: 'big-emoji' }, '⏳'), h('p', {}, 'Chưa có câu hỏi đã duyệt cho chương này.'))));
    return;
  }

  root.replaceChildren(shell(TITLE,
    h('div', { class: 'card center game-intro' },
      h('p', { class: 'big-emoji' }, '💬⚡'),
      h('h2', {}, `${TITLE} · Mức ${level}`),
      best ? h('p', { class: 'item-stars' }, `Kết quả tốt nhất: ${starsText(best)}`) : null,
      h('ul', { class: 'rules' },
        h('li', {}, `Có ${rounds} câu hỏi. Máy đọc câu hỏi, bạn bấm 🎤 và trả lời bằng tiếng Anh.`),
        h('li', {}, level === 1 ? 'Ở Mức 1 bạn được xem chữ của câu hỏi.' : level === 2 ? 'Ở Mức 2 câu hỏi ẩn chữ, bấm “👀 Xem chữ” nếu cần.' : 'Ở Mức 3 chỉ nghe, không xem chữ.'),
        h('li', {}, `Mỗi câu có ${seconds} giây và ${TRIES} lần trả lời.`),
        h('li', {}, 'Đúng ở lần 1: 3 điểm · lần 2: 2 điểm · có dùng gợi ý: 1 điểm.'),
        h('li', {}, `Vượt chương khi có ít nhất ${passNeed(rounds)}/${rounds} câu đạt từ ⭐⭐ (trả lời rõ ý ở lần 1 hoặc 2, không dùng gợi ý).`)),
      h('p', { class: 'note' }, 'Bạn trả lời theo ý của mình, không cần giống gợi ý. Máy nhận xét câu bạn nói, không chấm phát âm.'),
      h('button', { class: 'btn btn-main', onclick: () => play() }, '▶ Bắt đầu'))));

  function play() {
    const deck = shuffle(pool).slice(0, rounds);
    const results = [];
    let score = 0, combo = 0, usedSelfCheck = false;
    const max = deck.length * 3;
    const hud = h('div', { class: 'hud' });
    const stage = h('div', { class: 'card center game' });
    root.replaceChildren(shell(TITLE, hud, stage));
    const drawHud = (k) => hud.replaceChildren(
      h('span', {}, `Câu ${Math.min(k + 1, deck.length)}/${deck.length}`),
      h('span', {}, `⭐ ${score} điểm`),
      h('span', { class: combo >= 2 ? 'combo on' : 'combo' }, combo >= 2 ? `🔥 ${combo} liên tiếp` : ''));

    const round = (k) => {
      if (k >= deck.length) return finish();
      const item = deck[k];
      let attempt = 0, usedHint = false, timer = null, left = seconds * 10, busy = false;
      drawHud(k);

      const bar = h('span', { style: 'width:100%' });
      const meter = h('div', { class: 'meter timer', 'aria-hidden': 'true' }, bar);
      const qText = h('p', { class: 'sentence' }, level === 1 ? item.q : '🔊 …');
      const bubble = h('div', { class: 'bubble them q-bubble' }, h('b', {}, item.who), qText);
      const hintLine = h('p', { class: 'example', hidden: true }, '💡 Gợi ý: ', item.hint);
      const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
      const say = (...nodes) => feedback.replaceChildren(...nodes.filter(Boolean));   // bỏ phần tử rỗng (null)
      const sayBtn = h('button', { class: 'btn btn-main' }, S.support.recognition ? '🎤 Trả lời' : '🗣️ Bạn đã trả lời');
      const againBtn = h('button', { class: 'btn btn-soft', onclick: () => S.playModel(item.q) }, '🔊 Nghe lại');
      const showBtn = level === 2 ? h('button', { class: 'btn btn-soft', onclick: (e) => { qText.textContent = item.q; e.target.remove(); } }, '👀 Xem chữ') : null;
      const hintBtn = h('button', { class: 'btn btn-soft', disabled: !item.hint, onclick: () => { usedHint = true; hintLine.hidden = false; hintBtn.disabled = true; } }, '💡 Gợi ý');
      const skipBtn = h('button', { class: 'btn btn-soft' }, 'Bỏ qua');
      const controls = h('div', { class: 'row center' }, sayBtn, againBtn, showBtn, hintBtn, skipBtn);

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
      const next = () => h('button', { class: 'btn btn-main', onclick: () => round(k + 1) }, k + 1 >= deck.length ? 'Xem kết quả' : 'Tiếp ›');

      const win = (heard, f = null) => {
        stopTimer();
        const pts = usedHint ? 1 : attempt === 0 ? 3 : 2;
        score += pts; combo += 1;
        results.push({ item, ok: true, pts, heard });
        drawHud(k);
        qText.textContent = item.q;
        stage.classList.add('flash-ok');
        Fx.vanish(bubble);
        feedback.replaceChildren(...[h('p', { class: 'result-title ok-text' }, `✓ ${f ? f.title : 'Bạn đã trả lời.'} (+${pts})`),
          heard ? h('p', { class: 'heard' }, 'Máy nghe được: ', h('q', {}, heard)) : null,
          f && f.notes.length ? h('ul', { class: 'free-notes' }, ...f.notes.map((x) => h('li', {}, '✓ ', x))) : null].filter(Boolean));
        controls.replaceChildren(next());
      };
      function reveal(reason, heard) {
        stopTimer();
        combo = 0;
        results.push({ item, ok: false, pts: 0, heard: heard || '' });
        drawHud(k);
        qText.textContent = item.q;
        say(h('p', { class: 'result-title' }, reason),
          item.hint ? h('p', { class: 'example' }, 'Bạn có thể trả lời: ', h('b', {}, item.hint), ' ', h('button', { class: 'link-btn', onclick: () => S.playModel(item.hint) }, '🔊')) : null,
          heard ? h('p', { class: 'heard' }, 'Máy nghe được: ', h('q', {}, heard)) : null);
        controls.replaceChildren(next());
      }
      skipBtn.addEventListener('click', () => { if (!busy) reveal('Bạn bỏ qua câu này.'); });
      sayBtn.addEventListener('click', async () => {
        if (busy) { S.stopListening(); return; }
        if (!S.support.recognition) {
          usedSelfCheck = true; stopTimer();
          qText.textContent = item.q; hintLine.hidden = false;
          controls.replaceChildren(
            h('button', { class: 'btn btn-soft', onclick: () => win('') }, '😀 Bạn trả lời được'),
            h('button', { class: 'btn btn-soft', onclick: () => reveal('Không sao, lần sau nhé.') }, '🤔 Bạn chưa trả lời được'));
          return;
        }
        stopTimer();
        busy = true;
        sayBtn.classList.add('active'); sayBtn.textContent = '👂 Máy đang nghe… nói xong im lặng 2 giây';
        skipBtn.disabled = true;
        const res = await S.listen();
        busy = false;
        sayBtn.classList.remove('active'); sayBtn.textContent = '🎤 Trả lời lại';
        skipBtn.disabled = false;
        if (res.error) { feedback.replaceChildren(h('p', { class: 'warn' }, res.message || 'Máy chưa nghe được, bạn bấm 🎤 nói lại nhé.')); startTimer(); return; }
        const f = Free.evaluate({ bot: item.q, expect_any: item.expect, hint: item.hint }, res.alternatives, level);
        // Thử thách: câu trả lời phải đúng ý câu hỏi (từ 2 sao); lạc đề thì nói lại.
        if (f.stars >= 2 && f.related) return win(f.heard, f);
        attempt += 1;
        if (attempt >= TRIES) return reveal(f.title, f.heard);
        say(h('p', { class: 'warn' }, f.title), f.heard ? h('p', { class: 'heard' }, 'Máy nghe được: ', h('q', {}, f.heard)) : null,
          f.tip ? h('p', { class: 'muted' }, '💡 ', f.tip) : null, h('p', { class: 'muted' }, `Còn ${TRIES - attempt} lần.`));
        startTimer();
      });

      stage.classList.remove('flash-ok');
      stage.replaceChildren(meter, h('div', { class: 'chat' }, bubble), hintLine, controls, feedback);
      S.playModel(item.q);
      startTimer();
    };

    const finish = () => {
      const correct = results.filter((r) => r.ok);
      // Câu đạt từ 2 sao = trả lời đúng ý ở lần 1 (3 điểm) hoặc lần 2 (2 điểm), không dùng gợi ý.
      const good = results.filter((r) => r.ok && r.pts >= 2).length;
      const need = passNeed(results.length);
      const stars = good >= need ? (good === results.length ? 3 : 2) : correct.length ? 1 : 0;
      P.record({ unit: unitNo, activity: 'challenge', item: challengeId(level), level, source: usedSelfCheck ? 'self_check' : 'asr_match',
        stars, detail: `dat2sao=${good}/${results.length};can=${need};dung=${correct.length};diem=${score}/${max}` });
      const missed = results.filter((r) => !r.ok);
      root.replaceChildren(shell(TITLE,
        h('div', { class: 'card center' },
          h('h2', {}, stars === 3 ? 'Xuất sắc! 🎉' : stars === 2 ? 'Làm tốt lắm! 👏' : 'Cố gắng thêm nhé! 💪'),
          h('p', { class: 'result-stars s' + stars }, starsText(stars)),
          h('p', { class: 'score' }, `${score} / ${max} điểm · trả lời được ${correct.length}/${results.length} câu`),
          h('p', { class: good >= need ? 'ok-text' : 'warn' }, good >= need
            ? `✓ ${good}/${results.length} câu đạt từ ⭐⭐ — bạn đã vượt chương này!`
            : `${good}/${results.length} câu đạt từ ⭐⭐. Cần ${need} câu để vượt chương này, bạn chơi lại nhé!`),
          h('p', { class: 'note' }, 'Kết quả cho biết máy nghe được bao nhiêu câu trả lời rõ ý. Đây chưa phải điểm phát âm.')),
        missed.length ? h('div', { class: 'card' }, h('h2', {}, 'Câu cần luyện thêm'),
          h('div', { class: 'list' }, ...missed.map((r) => h('div', { class: 'list-item' },
            h('span', {}, h('b', {}, r.item.q), r.item.hint ? ` → ${r.item.hint}` : ''),
            h('button', { class: 'btn btn-soft', onclick: () => S.playModel(r.item.q) }, '🔊'))))) : null,
        h('div', { class: 'row center' },
          h('button', { class: 'btn btn-main', onclick: () => play() }, '🔁 Chơi lại'),
          h('a', { class: 'btn btn-soft', href: '#/roleplays' }, '🎭 Luyện đóng vai'),
          h('a', { class: 'btn btn-soft', href: '#/' }, 'Về trang chính'))));
    };

    round(0);
  }
}
