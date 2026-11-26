// Trang giáo viên (bản mẫu): kiểm tra dữ liệu, duyệt từng mục, tải tệp JSON đã duyệt, xuất tiến độ trên máy.
import * as C from './content.js';
import * as S from './speech.js';
import * as P from './progress.js';
import { h } from './ui.js';

const root = document.getElementById('app');
let unit, original, file;

const STATUS = { draft: 'Chờ duyệt', approved: 'Đã duyệt', needs_fix: 'Cần sửa' };

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fieldsOf(section, x) {
  switch (section) {
    case 'vocabulary': return [['Từ', x.word], ['IPA', x.ipa], ['Nghĩa', x.meaning_vi], ['Ví dụ', x.example], ['Biến thể chấp nhận', (x.accepted_variants || []).join(', ') || '—'], ['Mức', x.level], ['Hình', x.image || `${x.emoji} (emoji tạm)`], ['Âm thanh', x.audio || 'giọng máy (chưa có tệp)']];
    case 'patterns': return [['Câu', x.text], ['Nghĩa', x.meaning_vi], ['Khung (mức 2)', `${x.frame} ← ${x.slot_options.join(' / ')}`], ['Đề nói tự do (mức 3)', x.free_prompt_vi], ['Câu gợi ý', x.free_example], ['Mức', x.level]];
    case 'dialogues': return [['Tên', `${x.title} (${x.title_vi})`], ['Vai', x.roles.join(', ')], ...x.turns.map((t, i) => [`${i + 1}. ${t.speaker}`, `${t.text} — ${t.hint_vi}`])];
    case 'roleplays': return [['Tình huống', x.situation_vi], ['Vai của máy', x.ai_role], ...x.turns.map((t, i) => [`Lượt ${i + 1}`, `${t.bot} → gợi ý: ${t.hint} · từ chấp nhận: ${t.expect_any.join(', ')}`]), ['Kết thúc', x.closing]];
    case 'picture_tasks': return [['Tên', `${x.title} (${x.title_vi})`], ['Tranh', x.image || `${x.scene_emoji.join(' ')} (emoji tạm)`], ['Từ khóa', x.keywords.join(', ')], ...['1', '2', '3'].map((l) => [`Mức ${l}`, `${x.prompts[l].prompt_vi} · mẫu: ${x.prompts[l].model_answer}`])];
    default: return [];
  }
}

function spokenText(section, x) {
  if (section === 'vocabulary') return `${x.word}. ${x.example}`;
  if (section === 'patterns') return x.text;
  if (section === 'dialogues') return x.turns.map((t) => t.text).join(' ');
  if (section === 'roleplays') return x.turns.map((t) => t.bot).join(' ');
  return x.prompts['2'].model_answer;
}

function setStatus(id, status) {
  const overlay = C.getReviewOverlay(unit.meta.unit);
  overlay[id] = status;
  C.setReviewOverlay(unit.meta.unit, overlay);
  render();
}

function exportJson() {
  const out = JSON.parse(JSON.stringify(original));
  const overlay = C.getReviewOverlay(unit.meta.unit);
  let all = true;
  for (const s of C.SECTIONS) for (const item of out[s] || []) {
    if (overlay[item.id]) item.review = overlay[item.id];
    if (item.review !== 'approved') all = false;
  }
  out.meta.status = all ? 'approved' : 'in_review';
  out.meta.reviewed_at = new Date().toISOString().slice(0, 10);
  out.meta.reviewed_by = out.meta.reviewed_by || 'Giáo viên (điền tên khi lưu trữ)';
  download(file, JSON.stringify(out, null, 2) + '\n', 'application/json');
}

function render() {
  unit = C.applyOverlay(JSON.parse(JSON.stringify(original)));
  const errors = C.validate(unit);
  const counts = { draft: 0, approved: 0, needs_fix: 0 };
  for (const s of C.SECTIONS) for (const x of unit[s] || []) counts[x.review]++;
  const total = counts.draft + counts.approved + counts.needs_fix;
  const nAttempts = P.attempts().length;

  const sections = C.SECTIONS.map((s) => h('section', {},
    h('div', { class: 'section-head' },
      h('h2', {}, `${C.SECTION_VI[s]} (${(unit[s] || []).length})`),
      h('button', { class: 'btn btn-soft', onclick: () => { const o = C.getReviewOverlay(unit.meta.unit); (unit[s] || []).forEach((x) => { o[x.id] = 'approved'; }); C.setReviewOverlay(unit.meta.unit, o); render(); } }, 'Duyệt cả phần này')),
    ...(unit[s] || []).map((x) => h('div', { class: `card review-item status-${x.review}` },
      h('div', {},
        h('h3', {}, x.word || x.text || x.title),
        h('dl', {}, ...fieldsOf(s, x).flatMap(([k, v]) => [h('dt', {}, k), h('dd', {}, String(v))])),
        h('button', { class: 'link-btn', onclick: () => S.playModel(spokenText(s, x)) }, '🔊 Nghe thử'),
        h('span', { class: 'muted' }, ` · id: ${x.id}`)),
      h('label', {}, h('span', { class: 'muted' }, 'Trạng thái '),
        (() => {
          const sel = h('select', { onchange: (e) => setStatus(x.id, e.target.value) },
            ...Object.entries(STATUS).map(([v, label]) => h('option', { value: v }, label)));
          sel.value = x.review;
          return sel;
        })())))));

  root.replaceChildren(h('div', { class: 'screen wide' },
    h('header', { class: 'topbar' }, h('a', { class: 'back', href: 'index.html?preview=0', 'aria-label': 'Về trang học sinh' }, '‹'),
      h('div', { class: 'topbar-title' }, `Duyệt nội dung · Unit ${unit.meta.unit}: ${unit.meta.title}`)),
    h('p', { class: 'proto' }, h('b', {}, 'Bản mẫu giai đoạn 1: '),
      'trang này chưa có đăng nhập và trạng thái duyệt chỉ lưu trên máy này. Để học sinh ở mọi máy thấy nội dung, thầy cô bấm “Tải tệp JSON đã duyệt” rồi thay tệp ',
      h('code', {}, `data/units/${file}`), '. Phân quyền thật làm ở giai đoạn 2.'),
    h('p', { class: 'muted' }, unit.meta.note || ''),
    errors.length
      ? h('div', { class: 'card warn' }, h('h2', {}, `Dữ liệu có ${errors.length} lỗi`), h('ul', { class: 'errors' }, ...errors.map((e) => h('li', {}, e))))
      : h('p', {}, '✅ Cấu trúc dữ liệu hợp lệ.'),
    h('div', { class: 'summary' },
      h('div', { class: 'card' }, h('b', {}, `${counts.approved}/${total}`), 'mục đã duyệt'),
      h('div', { class: 'card' }, h('b', {}, String(counts.draft)), 'mục chờ duyệt'),
      h('div', { class: 'card' }, h('b', {}, String(counts.needs_fix)), 'mục cần sửa')),
    h('div', { class: 'row' },
      h('a', { class: 'btn btn-soft', href: 'index.html?preview=1', target: '_blank' }, '👀 Xem trước (có bản nháp)'),
      h('a', { class: 'btn btn-soft', href: 'index.html?preview=0', target: '_blank' }, '🧒 Xem như học sinh'),
      h('button', { class: 'btn btn-main', onclick: exportJson }, '⬇ Tải tệp JSON đã duyệt'),
      h('button', { class: 'btn btn-soft', onclick: () => { if (confirm('Xóa mọi trạng thái duyệt đã chọn trên máy này?')) { C.setReviewOverlay(unit.meta.unit, {}); render(); } } }, 'Đặt lại trạng thái duyệt')),
    ...sections,
    h('section', {},
      h('h2', {}, 'Tiến độ luyện tập trên máy này'),
      h('p', {}, `${nAttempts} lượt luyện được ghi trên trình duyệt này (không có tên học sinh). Đây là dữ liệu thật phát sinh khi dùng; ứng dụng không tạo số liệu mẫu.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn btn-soft', disabled: !nAttempts, onclick: () => download(`speakboost-tien-do-${new Date().toISOString().slice(0, 10)}.csv`, P.toCsv(), 'text/csv;charset=utf-8') }, '⬇ Tải CSV'),
        h('button', { class: 'btn btn-soft', disabled: !nAttempts, onclick: () => { if (confirm('Xóa toàn bộ tiến độ luyện tập trên máy này? Không thể hoàn tác.')) { P.clearAll(); render(); } } }, 'Xóa tiến độ trên máy này'))),
  ));
}

async function start() {
  try {
    const index = await C.loadIndex();
    file = index.units.find((u) => u.file).file;
    original = await C.loadUnit(file);
    render();
  } catch (err) {
    root.replaceChildren(h('div', { class: 'screen' }, h('div', { class: 'card warn' }, h('h2', {}, 'Không nạp được dữ liệu'), h('p', {}, err.message))));
  }
}
start();
