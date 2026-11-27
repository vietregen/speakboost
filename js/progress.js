// Tiến độ lưu trên thiết bị (localStorage), tách riêng cho từng học sinh đăng nhập trên cùng máy.
// Khi học sinh đăng nhập lớp, mỗi lượt luyện còn được gửi lên máy chủ (xem cloud.js).

const BASE_KEY = 'sb.progress.v1';
const MAX_ATTEMPTS = 1000;
let KEY = BASE_KEY;
const listeners = new Set();

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.attempts) return raw;
  } catch (_) { /* bộ nhớ trình duyệt bị chặn hoặc hỏng */ }
  return { level: 1, attempts: [], best: {} };
}

let state = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* bỏ qua */ } }

// Chuyển sang sổ tiến độ của một học sinh (null = khách / máy dùng riêng).
export function useStudent(studentId) {
  KEY = studentId ? `${BASE_KEY}.${studentId}` : BASE_KEY;
  state = load();
}

// Báo cho cloud.js mỗi khi có lượt luyện mới.
export function onRecord(fn) { listeners.add(fn); }

// Gộp các lượt luyện lấy từ máy chủ (khi học sinh đổi máy). Lượt đã có thì bỏ qua.
export function mergeServer(rows) {
  const seen = new Set(state.attempts.map((a) => `${a.t}|${a.item}`));
  for (const r of rows) {
    const key = `${r.unit}:${r.item}`;
    state.best[key] = Math.max(state.best[key] || 0, r.stars);
    if (!seen.has(`${r.t}|${r.item}`)) state.attempts.push(r);
  }
  state.attempts.sort((a, b) => (a.t < b.t ? -1 : 1));
  if (state.attempts.length > MAX_ATTEMPTS) state.attempts = state.attempts.slice(-MAX_ATTEMPTS);
  save();
}

export const getLevel = () => state.level || 1;
export function setLevel(level) { state.level = level; save(); }

// source: 'asr_match' (nhận diện lời nói) | 'self_check' (học sinh tự đánh giá)
export function record({ unit, activity, item, level, source, stars, detail }) {
  const a = { t: new Date().toISOString(), unit, activity, item, level, source, stars, detail: detail || '' };
  state.attempts.push(a);
  if (state.attempts.length > MAX_ATTEMPTS) state.attempts = state.attempts.slice(-MAX_ATTEMPTS);
  const key = `${unit}:${item}`;
  state.best[key] = Math.max(state.best[key] || 0, stars);
  save();
  for (const fn of listeners) { try { fn(a); } catch (_) { /* không để lỗi gửi làm hỏng bài học */ } }
}

export const bestStars = (unit, item) => state.best[`${unit}:${item}`] || 0;

export function summary(unit, ids) {
  const done = ids.filter((id) => bestStars(unit, id) > 0).length;
  const stars = ids.reduce((s, id) => s + bestStars(unit, id), 0);
  return { done, total: ids.length, stars };
}

export function daysPractised() {
  return new Set(state.attempts.map((a) => a.t.slice(0, 10))).size;
}

export const attempts = () => state.attempts.slice();

export function clearAll() { state = { level: state.level, attempts: [], best: {} }; save(); }

export function toCsv() {
  const head = ['thoi_gian', 'unit', 'hoat_dong', 'muc', 'muc_do', 'nguon_danh_gia', 'sao', 'chi_tiet', 'is_simulated'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = state.attempts.map((a) => [a.t, a.unit, a.activity, a.item, a.level, a.source, a.stars, a.detail, 'false'].map(esc).join(','));
  return '﻿' + [head.join(','), ...rows].join('\r\n');
}
