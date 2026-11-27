// Trang giáo viên (bản mẫu): kiểm tra dữ liệu, duyệt từng mục, tải tệp JSON đã duyệt, xuất tiến độ trên máy.
import * as C from './content.js';
import * as S from './speech.js';
import * as P from './progress.js';
import { h } from './ui.js';
import * as X from './excel.js';

const root = document.getElementById('app');
let unit, original, file, webOriginal, webFile;
let fromExcel = false;
let importErrors = [];
let excelMsg = '';

const unitFile = (n) => `unit-${String(n).padStart(2, '0')}.json`;

async function onExcelChosen(e) {
  const f = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!f) return;
  excelMsg = `Đang đọc ${f.name}…`; render();
  try {
    const wb = await X.workbookFromFile(f);
    const { unit: u, errors } = await X.workbookToUnit(wb, webOriginal);
    if (!u.meta.unit) { importErrors = errors; excelMsg = 'Chưa nhập được: thiếu số Unit ở trang ThongTin.'; render(); return; }
    if (!C.setImported(u)) { excelMsg = 'Trình duyệt không cho lưu tạm nội dung. Thử tắt chế độ ẩn danh.'; render(); return; }
    C.setReviewOverlay(u.meta.unit, {});
    original = u; file = unitFile(u.meta.unit); fromExcel = true; importErrors = errors;
    const n = C.SECTIONS.reduce((s, k) => s + (u[k] || []).length, 0);
    excelMsg = `Đã đọc ${f.name}: ${n} mục. ${errors.length ? `Có ${errors.length} lỗi cần sửa trong Excel (xem bên dưới).` : 'Không có lỗi.'}`;
  } catch (err) {
    excelMsg = `Chưa đọc được tệp: ${err.message}`;
  }
  render();
}

function dropImported() {
  C.clearImported();
  original = webOriginal; file = webFile; fromExcel = false; importErrors = []; excelMsg = 'Đã bỏ nội dung nhập từ Excel, quay về bản trên web.';
  render();
}

function excelSection() {
  const input = h('input', { type: 'file', id: 'excel-file', accept: '.xlsx,.xls', class: 'sr-only', onchange: onExcelChosen });
  return h('section', { class: 'card' },
    h('h2', {}, 'Nhập nội dung từ Excel'),
    h('p', {}, '1. Tải tệp Excel mẫu (có sẵn nội dung đang xem để làm ví dụ). 2. Sửa hoặc điền thêm, mỗi trang tính là một phần của bài; đọc trang “HuongDan” trong tệp. 3. Tải tệp lên đây để kiểm tra và xem trước. 4. Không có lỗi thì tải tệp JSON và đưa lên web.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn btn-soft', onclick: async () => {
        try { await X.downloadTemplate(original, `speakboost-unit-${String(original.meta.unit).padStart(2, '0')}.xlsx`); }
        catch (err) { excelMsg = err.message; render(); }
      } }, '⬇ Tải Excel mẫu'),
      input,
      h('label', { for: 'excel-file', class: 'btn btn-main' }, '⬆ Tải lên tệp Excel đã điền'),
      fromExcel ? h('button', { class: 'btn btn-soft', onclick: dropImported }, 'Bỏ nội dung nhập') : null),
    excelMsg ? h('p', { class: 'muted', 'aria-live': 'polite' }, excelMsg) : null,
    fromExcel ? h('p', { class: 'proto' }, h('b', {}, 'Đang dùng nội dung nhập từ Excel trên máy này. '),
      `Học sinh chưa thấy nội dung này. Khi không còn lỗi, bấm “Tải tệp JSON đã duyệt” để có tệp ${file}, rồi tải tệp đó lên thư mục data/units trên GitHub.`,
      webFile && file !== webFile ? ` Đây là Unit mới: cần thêm tên tệp ${file} vào data/units/index.json.` : '') : null);
}

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

// Mọi câu học sinh có thể bấm nghe (khớp với tools/make-audio.ps1).
function allSpokenTexts(u) {
  const out = [];
  const add = (t) => { if (t && String(t).trim()) out.push(String(t).trim()); };
  for (const v of u.vocabulary || []) { add(v.word); add(v.example); }
  for (const p of u.patterns || []) { add(p.text); add(p.free_example); }
  for (const d of u.dialogues || []) for (const t of d.turns || []) add(t.text);
  for (const r of u.roleplays || []) { for (const t of r.turns || []) { add(t.bot); add(t.hint); } add(r.closing); }
  for (const p of u.picture_tasks || []) for (const k of ['1', '2', '3']) add(p.prompts && p.prompts[k] && p.prompts[k].model_answer);
  return [...new Set(out)];
}

function audioSection() {
  const texts = allSpokenTexts(unit);
  const missing = texts.filter((t) => !S.audioFor(t));
  const has = texts.length - missing.length;
  return h('section', { class: 'card' },
    h('h2', {}, '🔊 Âm thanh mẫu'),
    h('p', {}, `${has}/${texts.length} câu có tệp âm thanh (giọng đọc máy Microsoft Zira, Anh-Mỹ). Mọi máy, kể cả iPhone, nghe cùng một giọng. Bấm “🔊 Nghe thử” ở từng mục để duyệt giọng mẫu.`),
    missing.length
      ? h('div', {}, h('p', { class: 'warn' }, `${missing.length} câu chưa có tệp (thường do vừa sửa chữ trong Excel) – các câu này tạm dùng giọng máy của trình duyệt. Cần tạo lại tệp âm thanh rồi đưa lên GitHub:`),
        h('ul', { class: 'errors' }, ...missing.slice(0, 30).map((t) => h('li', {}, t))))
      : h('p', { class: 'muted' }, '✅ Câu nào cũng có tệp âm thanh.'));
}

function render() {
  unit = C.applyOverlay(JSON.parse(JSON.stringify(original)));
  const errors = [...importErrors, ...C.validate(unit)];
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
    excelSection(),
    audioSection(),
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
      h('button', { class: 'btn btn-main', onclick: exportJson, disabled: errors.length > 0, title: errors.length ? 'Sửa hết lỗi trước khi tải' : null }, '⬇ Tải tệp JSON đã duyệt'),
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
    webFile = index.units.find((u) => u.file).file;
    webOriginal = await C.loadUnit(webFile);
    const imported = C.getImported();
    if (imported && imported.meta && imported.meta.unit) {
      original = imported; file = unitFile(imported.meta.unit); fromExcel = true;
    } else {
      original = webOriginal; file = webFile;
    }
    await S.loadAudioManifest(original.meta.unit);
    render();
  } catch (err) {
    root.replaceChildren(h('div', { class: 'screen' }, h('div', { class: 'card warn' }, h('h2', {}, 'Không nạp được dữ liệu'), h('p', {}, err.message))));
  }
}
start();
