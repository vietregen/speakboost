// Nạp, kiểm tra và lọc dữ liệu bài học. Mã nguồn không chứa nội dung bài: tất cả nằm trong data/units/*.json.

const REVIEW_KEY = (unit) => `sb.review.u${unit}`;
export const SECTIONS = ['vocabulary', 'patterns', 'dialogues', 'roleplays'];
export const SECTION_VI = {
  vocabulary: 'Từ vựng', patterns: 'Mẫu câu', dialogues: 'Hội thoại', roleplays: 'Đóng vai',
};

export async function loadIndex() {
  const res = await fetch('data/units/index.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('Không đọc được data/units/index.json');
  return res.json();
}

export async function loadUnit(file) {
  const res = await fetch(`data/units/${file}`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Không đọc được tệp ${file}`);
  try { return await res.json(); }
  catch (err) { throw new Error(`Tệp ${file} sai định dạng JSON: ${err.message}`); }
}

// Kiểm tra cấu trúc. Trả về danh sách lỗi bằng tiếng Việt (rỗng = hợp lệ).
export function validate(unit) {
  const errors = [];
  const need = (obj, fields, where) => fields.forEach((f) => {
    if (obj[f] === undefined || obj[f] === '' ) errors.push(`${where}: thiếu trường “${f}”`);
  });
  if (!unit || typeof unit !== 'object') return ['Tệp không phải đối tượng JSON.'];
  need(unit.meta || {}, ['unit', 'title', 'version', 'status'], 'meta');
  const ids = new Set();
  const checkId = (item, where) => {
    if (!item.id) errors.push(`${where}: thiếu “id”`);
    else if (ids.has(item.id)) errors.push(`${where}: id “${item.id}” bị trùng`);
    else ids.add(item.id);
    if (!['draft', 'approved', 'needs_fix'].includes(item.review)) errors.push(`${where} (${item.id}): “review” phải là draft, approved hoặc needs_fix`);
  };
  (unit.vocabulary || []).forEach((v, i) => { const w = `vocabulary[${i}]`; checkId(v, w); need(v, ['word', 'ipa', 'meaning_vi', 'example', 'level'], w); });
  (unit.patterns || []).forEach((p, i) => {
    const w = `patterns[${i}]`; checkId(p, w); need(p, ['text', 'meaning_vi', 'frame', 'slot_options', 'level'], w);
    if (p.frame && !p.frame.includes('___')) errors.push(`${w}: “frame” phải có chỗ trống ___`);
  });
  (unit.dialogues || []).forEach((d, i) => {
    const w = `dialogues[${i}]`; checkId(d, w); need(d, ['title', 'roles', 'turns', 'level'], w);
    (d.turns || []).forEach((t, k) => { if (!(d.roles || []).includes(t.speaker)) errors.push(`${w}.turns[${k}]: người nói “${t.speaker}” không có trong roles`); });
  });
  (unit.roleplays || []).forEach((r, i) => { const w = `roleplays[${i}]`; checkId(r, w); need(r, ['title', 'situation_vi', 'turns', 'closing', 'level'], w); });
  return errors;
}

// Trạng thái duyệt giáo viên vừa chọn trên máy này (bản mẫu). Giai đoạn 2 sẽ lưu trên máy chủ.
export function getReviewOverlay(unitNo) {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY(unitNo)) || '{}'); } catch (_) { return {}; }
}
export function setReviewOverlay(unitNo, overlay) {
  try { localStorage.setItem(REVIEW_KEY(unitNo), JSON.stringify(overlay)); } catch (_) { /* bỏ qua */ }
}

export function applyOverlay(unit) {
  const overlay = getReviewOverlay(unit.meta.unit);
  for (const s of SECTIONS) for (const item of unit[s] || []) if (overlay[item.id]) item.review = overlay[item.id];
  return unit;
}

// Học sinh chỉ thấy mục đã duyệt. Chế độ xem trước của giáo viên thấy cả bản nháp.
export function visibleItems(unit, section, { preview = false } = {}) {
  return (unit[section] || []).filter((item) => preview || item.review === 'approved');
}

// Nội dung giáo viên vừa nhập từ Excel trên máy này, chưa đưa lên web. Chỉ dùng ở chế độ xem trước.
const IMPORT_KEY = 'sb.importedUnit';
export function getImported() {
  try { return JSON.parse(localStorage.getItem(IMPORT_KEY) || 'null'); } catch (_) { return null; }
}
export function setImported(unit) {
  try { localStorage.setItem(IMPORT_KEY, JSON.stringify(unit)); return true; } catch (_) { return false; }
}
export function clearImported() { try { localStorage.removeItem(IMPORT_KEY); } catch (_) { /* bỏ qua */ } }

export function isPreview() {
  const q = new URLSearchParams(location.search);
  if (q.get('preview') === '1') { try { sessionStorage.setItem('sb.preview', '1'); } catch (_) {} return true; }
  if (q.get('preview') === '0') { try { sessionStorage.removeItem('sb.preview'); } catch (_) {} return false; }
  try { return sessionStorage.getItem('sb.preview') === '1'; } catch (_) { return false; }
}
