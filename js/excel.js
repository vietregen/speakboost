// Chuyển đổi giữa tệp Excel (giáo viên soạn) và dữ liệu bài học JSON.
// Dùng thư viện SheetJS, chỉ tải khi giáo viên bấm nút Excel.

const SHEETJS = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
let loading = null;
export function loadSheetJs() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SHEETJS;
      s.onload = () => resolve(window.XLSX);
      s.onerror = () => { loading = null; reject(new Error('Không tải được thư viện đọc Excel. Kiểm tra kết nối mạng rồi thử lại.')); };
      document.head.append(s);
    });
  }
  return loading;
}

const LIST = ';';      // tách các mục trong một ô
const GROUP = '|';     // tách các nhóm từ bắt buộc
const STATUSES = ['draft', 'approved', 'needs_fix'];

// Tên trang tính và cột. Khóa bên trái là tên cột hiển thị trong Excel.
export const SHEETS = {
  info: { name: 'ThongTin' },
  levels: { name: 'MucDo', cols: ['Mức', 'Tên mức', 'Mô tả'] },
  vocab: { name: 'TuVung', cols: ['id', 'Từ', 'Phiên âm IPA', 'Nghĩa', 'Câu ví dụ', 'Mức (1-3)', 'Cách nói khác (;)', 'Emoji', 'Ảnh', 'Âm thanh', 'Trạng thái'] },
  patterns: { name: 'MauCau', cols: ['id', 'Câu mẫu', 'Nghĩa', 'Mức (1-3)', 'Khung câu (có ___)', 'Từ điền vào khung (;)', 'Đề nói tự do (mức 3)', 'Từ bắt buộc (nhóm | , từ ;)', 'Câu gợi ý (mức 3)', 'Âm thanh', 'Trạng thái'] },
  dialogues: { name: 'HoiThoai', cols: ['id hội thoại', 'Tên (tiếng Anh)', 'Tên (tiếng Việt)', 'Mức (1-3)', 'Thứ tự', 'Người nói', 'Lời thoại', 'Nghĩa tiếng Việt', 'Âm thanh', 'Trạng thái'] },
  roleplays: { name: 'DongVai', cols: ['id tình huống', 'Tên', 'Tình huống (tiếng Việt)', 'Tên nhân vật của máy', 'Vai của máy', 'Mục tiêu', 'Mức (1-3)', 'Thứ tự', 'Câu của máy', 'Từ chấp nhận (;)', 'Câu gợi ý', 'Câu kết thúc', 'Trạng thái'] },
};

const INFO_ROWS = [['Bộ sách', 'book'], ['Khối', 'grade'], ['Unit', 'unit'], ['Tên bài (tiếng Anh)', 'title'], ['Tên bài (tiếng Việt)', 'title_vi'], ['Phiên bản', 'version'], ['Ghi chú', 'note']];

const GUIDE = [
  ['HƯỚNG DẪN NHẬP NỘI DUNG SPEAKBOOST'],
  [''],
  ['1. Mỗi trang tính là một phần của bài: ThongTin, MucDo, TuVung, MauCau, HoiThoai, DongVai.'],
  ['2. Giữ nguyên dòng tiêu đề (dòng 1) và tên trang tính. Mỗi dòng bên dưới là một mục.'],
  ['3. Cột id có thể để trống: ứng dụng tự tạo. Nếu điền, id không được trùng trong cả bài.'],
  ['4. Ô có nhiều mục thì cách nhau bằng dấu chấm phẩy ;  Ví dụ: uniforms; school uniform'],
  ['   Cột “Cách nói khác” chỉ ghi cách viết khác của CHÍNH từ đó (số nhiều, viết liền/tách, Anh–Mỹ như math). Không ghi từ đồng nghĩa (soccer, bike): nếu ghi, máy sẽ chấm đúng khi học sinh nói từ đồng nghĩa.'],
  ['5. Từ bắt buộc ở MauCau: các nhóm cách nhau bằng | , các từ trong một nhóm cách nhau bằng ;'],
  ['   Ví dụ: have | English; maths; music | Monday; Tuesday  (câu phải có "have", một môn học và một ngày).'],
  ['   Viết *ing nghĩa là câu phải có một từ đuôi -ing.'],
  ['6. HoiThoai và DongVai: mỗi dòng là một lượt nói. Các dòng cùng id thuộc cùng một bài; tên, mức, trạng thái lấy ở dòng đầu.'],
  ['7. Trạng thái: draft (chờ duyệt), approved (đã duyệt), needs_fix (cần sửa). Để trống = draft. Học sinh chỉ thấy approved.'],
  ['8. Ảnh và Âm thanh là đường dẫn tới tệp đặt trong thư mục assets của trang web, ví dụ assets/uniform.webp. Để trống thì dùng emoji và giọng máy.'],
  ['9. Không chép nguyên văn sách giáo khoa nếu chưa rõ quyền sử dụng.'],
];

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const list = (v) => str(v).split(LIST).map((x) => x.trim()).filter(Boolean);
const num = (v, d) => { const n = Number(str(v)); return Number.isFinite(n) && str(v) !== '' ? n : d; };
const slug = (s) => str(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'muc';

// ---------- JSON -> Excel (tệp mẫu, có sẵn nội dung hiện tại) ----------
export async function unitToWorkbook(unit) {
  const XLSX = await loadSheetJs();
  const wb = XLSX.utils.book_new();
  const add = (name, rows, widths) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = (widths || rows[0].map(() => 22)).map((w) => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  const m = unit.meta || {};
  add('HuongDan', GUIDE, [120]);
  add(SHEETS.info.name, [['Mục', 'Giá trị'], ...INFO_ROWS.map(([label, key]) => [label, m[key] ?? ''])], [24, 60]);
  add(SHEETS.levels.name, [SHEETS.levels.cols, ...(unit.levels || []).map((l) => [l.id, l.name, l.description])], [8, 16, 70]);
  add(SHEETS.vocab.name, [SHEETS.vocab.cols, ...(unit.vocabulary || []).map((v) => [v.id, v.word, v.ipa, v.meaning_vi, v.example, v.level, (v.accepted_variants || []).join('; '), v.emoji || '', v.image || '', v.audio || '', v.review])]);
  add(SHEETS.patterns.name, [SHEETS.patterns.cols, ...(unit.patterns || []).map((p) => [p.id, p.text, p.meaning_vi, p.level, p.frame, (p.slot_options || []).join('; '), p.free_prompt_vi || '', (p.free_required || []).map((g) => g.join('; ')).join(' | '), p.free_example || '', p.audio || '', p.review])]);
  const dRows = [];
  for (const d of unit.dialogues || []) d.turns.forEach((t, i) => dRows.push([d.id, i ? '' : d.title, i ? '' : d.title_vi, i ? '' : d.level, i + 1, t.speaker, t.text, t.hint_vi || '', t.audio || '', i ? '' : d.review]));
  add(SHEETS.dialogues.name, [SHEETS.dialogues.cols, ...dRows]);
  const rRows = [];
  for (const r of unit.roleplays || []) r.turns.forEach((t, i) => rRows.push([r.id, i ? '' : r.title, i ? '' : r.situation_vi, i ? '' : (r.bot_name || ''), i ? '' : (r.ai_role || ''), i ? '' : (r.goal || ''), i ? '' : r.level, i + 1, t.bot, (t.expect_any || []).join('; '), t.hint || '', i ? '' : r.closing, i ? '' : r.review]));
  add(SHEETS.roleplays.name, [SHEETS.roleplays.cols, ...rRows]);
  return wb;
}

export async function downloadTemplate(unit, filename) {
  const XLSX = await loadSheetJs();
  XLSX.writeFile(await unitToWorkbook(unit), filename);
}

// ---------- Excel -> JSON ----------
export async function workbookFromFile(file) {
  const XLSX = await loadSheetJs();
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array' });
}

export async function workbookToUnit(wb, fallback) {
  const XLSX = await loadSheetJs();
  const errors = [];
  const usedIds = new Set();
  const read = (key) => {
    const ws = wb.Sheets[SHEETS[key].name];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
  };
  const status = (v, where) => {
    const s = str(v).toLowerCase() || 'draft';
    if (!STATUSES.includes(s)) { errors.push(`${where}: trạng thái “${v}” không hợp lệ (dùng draft, approved hoặc needs_fix)`); return 'draft'; }
    return s;
  };
  const level = (v, where) => {
    const n = num(v, 1);
    if (![1, 2, 3].includes(n)) { errors.push(`${where}: mức phải là 1, 2 hoặc 3`); return 1; }
    return n;
  };

  // Thông tin bài
  const meta = { schema_version: 1, ...(fallback?.meta || {}), status: 'draft', reviewed_by: null, reviewed_at: null };
  const infoWs = wb.Sheets[SHEETS.info.name];
  if (infoWs) {
    for (const row of XLSX.utils.sheet_to_json(infoWs, { header: 1, defval: '', raw: false }).slice(1)) {
      const hit = INFO_ROWS.find(([label]) => label === str(row[0]));
      if (hit) meta[hit[1]] = ['grade', 'unit'].includes(hit[1]) ? num(row[1], meta[hit[1]]) : str(row[1]);
    }
  } else errors.push('Thiếu trang tính ThongTin');
  if (!meta.unit) errors.push('ThongTin: thiếu số Unit');
  const U = meta.unit || 0;
  const makeId = (given, kind, text, where) => {
    let id = str(given) || `u${U}-${kind}-${slug(text)}`;
    if (usedIds.has(id)) {
      if (str(given)) errors.push(`${where}: id “${id}” bị trùng`);
      let k = 2; while (usedIds.has(`${id}-${k}`)) k++; id = `${id}-${k}`;
    }
    usedIds.add(id);
    return id;
  };
  const need = (row, cols, where) => cols.every((c) => { if (!str(row[c])) { errors.push(`${where}: thiếu “${c}”`); return false; } return true; });
  const missingCols = (rows, key) => {
    if (!rows || !rows.length) return;
    const have = Object.keys(rows[0]);
    const lack = SHEETS[key].cols.filter((c) => !have.includes(c));
    if (lack.length) errors.push(`${SHEETS[key].name}: thiếu cột ${lack.map((c) => `“${c}”`).join(', ')} (đừng đổi tên dòng tiêu đề)`);
  };
  const isBlank = (row) => Object.values(row).every((v) => !str(v));

  // Mức độ
  const lvRows = read('levels');
  const levels = lvRows && lvRows.length
    ? lvRows.filter((r) => !isBlank(r)).map((r) => ({ id: num(r['Mức'], 1), name: str(r['Tên mức']), description: str(r['Mô tả']) }))
    : (fallback?.levels || []);

  // Từ vựng
  const vocabulary = [];
  const vRows = read('vocab') || [];
  missingCols(vRows, 'vocab');
  vRows.forEach((r, i) => {
    if (isBlank(r)) return;
    const w = `TuVung dòng ${i + 2}`;
    if (!need(r, ['Từ', 'Phiên âm IPA', 'Nghĩa', 'Câu ví dụ'], w)) return;
    vocabulary.push({ id: makeId(r.id, 'v', r['Từ'], w), review: status(r['Trạng thái'], w), word: str(r['Từ']), ipa: str(r['Phiên âm IPA']), meaning_vi: str(r['Nghĩa']),
      emoji: str(r.Emoji) || null, image: str(r['Ảnh']) || null, audio: str(r['Âm thanh']) || null, example: str(r['Câu ví dụ']),
      level: level(r['Mức (1-3)'], w), accepted_variants: list(r['Cách nói khác (;)']) });
  });

  // Mẫu câu
  const patterns = [];
  const pRows = read('patterns') || [];
  missingCols(pRows, 'patterns');
  pRows.forEach((r, i) => {
    if (isBlank(r)) return;
    const w = `MauCau dòng ${i + 2}`;
    if (!need(r, ['Câu mẫu', 'Nghĩa', 'Khung câu (có ___)', 'Từ điền vào khung (;)'], w)) return;
    const frame = str(r['Khung câu (có ___)']);
    if (!frame.includes('___')) errors.push(`${w}: khung câu phải có chỗ trống ___ (3 dấu gạch dưới)`);
    const groups = str(r['Từ bắt buộc (nhóm | , từ ;)']).split(GROUP).map((g) => list(g).map((t) => t.toLowerCase())).filter((g) => g.length);
    patterns.push({ id: makeId(r.id, 'p', r['Câu mẫu'], w), review: status(r['Trạng thái'], w), level: level(r['Mức (1-3)'], w),
      text: str(r['Câu mẫu']), meaning_vi: str(r['Nghĩa']), audio: str(r['Âm thanh']) || null, frame, slot_options: list(r['Từ điền vào khung (;)']),
      free_prompt_vi: str(r['Đề nói tự do (mức 3)']) || 'Nói một câu của bạn theo khung câu.',
      // Không khai báo từ bắt buộc: câu tự do chỉ cần chứa một trong các từ điền vào khung.
      free_required: groups.length ? groups : [list(r['Từ điền vào khung (;)']).map((t) => t.toLowerCase())],
      free_example: str(r['Câu gợi ý (mức 3)']) || str(r['Câu mẫu']) });
  });

  // Hội thoại (mỗi dòng một lượt)
  const dialogues = [];
  const dRows = read('dialogues') || [];
  missingCols(dRows, 'dialogues');
  const dById = new Map();
  dRows.forEach((r, i) => {
    if (isBlank(r)) return;
    const w = `HoiThoai dòng ${i + 2}`;
    const key = str(r['id hội thoại']) || `(không id) ${str(r['Tên (tiếng Anh)']) || i}`;
    if (!dById.has(key)) {
      if (!str(r['Tên (tiếng Anh)'])) errors.push(`${w}: dòng đầu của hội thoại cần “Tên (tiếng Anh)”`);
      dById.set(key, { id: makeId(r['id hội thoại'], 'd', r['Tên (tiếng Anh)'], w), review: status(r['Trạng thái'], w), level: level(r['Mức (1-3)'], w),
        title: str(r['Tên (tiếng Anh)']), title_vi: str(r['Tên (tiếng Việt)']), roles: [], turns: [] });
    }
    const d = dById.get(key);
    if (!need(r, ['Người nói', 'Lời thoại'], w)) return;
    const speaker = str(r['Người nói']);
    if (!d.roles.includes(speaker)) d.roles.push(speaker);
    d.turns.push({ order: num(r['Thứ tự'], d.turns.length + 1), speaker, text: str(r['Lời thoại']), hint_vi: str(r['Nghĩa tiếng Việt']), audio: str(r['Âm thanh']) || null });
  });
  for (const d of dById.values()) {
    d.turns.sort((a, b) => a.order - b.order).forEach((t) => delete t.order);
    if (d.roles.length < 2) errors.push(`HoiThoai “${d.title}”: cần ít nhất 2 người nói`);
    dialogues.push(d);
  }

  // Đóng vai (mỗi dòng một lượt)
  const roleplays = [];
  const rRows = read('roleplays') || [];
  missingCols(rRows, 'roleplays');
  const rById = new Map();
  rRows.forEach((r, i) => {
    if (isBlank(r)) return;
    const w = `DongVai dòng ${i + 2}`;
    const key = str(r['id tình huống']) || `(không id) ${str(r['Tên']) || i}`;
    if (!rById.has(key)) {
      need(r, ['Tên', 'Tình huống (tiếng Việt)', 'Câu kết thúc'], `${w} (dòng đầu của tình huống)`);
      rById.set(key, { id: makeId(r['id tình huống'], 'r', r['Tên'], w), review: status(r['Trạng thái'], w), level: level(r['Mức (1-3)'], w),
        title: str(r['Tên']), situation_vi: str(r['Tình huống (tiếng Việt)']), bot_name: str(r['Tên nhân vật của máy']) || 'Bạn trò chuyện',
        ai_role: str(r['Vai của máy']), goal: str(r['Mục tiêu']), mode: 'scripted', turns: [], closing: str(r['Câu kết thúc']) });
    }
    const rp = rById.get(key);
    if (!rp.closing && str(r['Câu kết thúc'])) rp.closing = str(r['Câu kết thúc']);
    if (!need(r, ['Câu của máy', 'Từ chấp nhận (;)', 'Câu gợi ý'], w)) return;
    rp.turns.push({ order: num(r['Thứ tự'], rp.turns.length + 1), bot: str(r['Câu của máy']), expect_any: list(r['Từ chấp nhận (;)']).map((t) => t.toLowerCase()), hint: str(r['Câu gợi ý']) });
  });
  for (const rp of rById.values()) { rp.turns.sort((a, b) => a.order - b.order).forEach((t) => delete t.order); roleplays.push(rp); }

  // Cấu hình thử thách chưa có trong Excel: giữ nguyên từ bản đang có.
  const unit = { meta, levels, ...(fallback?.challenges ? { challenges: fallback.challenges } : {}), vocabulary, patterns, dialogues, roleplays };
  return { unit, errors };
}
