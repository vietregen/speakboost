// Tiến độ lưu trên chính thiết bị (localStorage). Không lưu tên, không gửi đi đâu.
// Giai đoạn 2 sẽ chuyển sang bảng practice_attempts trên Supabase.

const KEY = 'sb.progress.v1';
const MAX_ATTEMPTS = 1000;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.attempts) return raw;
  } catch (_) { /* bộ nhớ trình duyệt bị chặn hoặc hỏng */ }
  return { level: 1, attempts: [], best: {} };
}

let state = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* bỏ qua */ } }

export const getLevel = () => state.level || 1;
export function setLevel(level) { state.level = level; save(); }

// source: 'asr_match' (nhận diện lời nói) | 'self_check' (học sinh tự đánh giá)
export function record({ unit, activity, item, level, source, stars, detail }) {
  state.attempts.push({ t: new Date().toISOString(), unit, activity, item, level, source, stars, detail: detail || '' });
  if (state.attempts.length > MAX_ATTEMPTS) state.attempts = state.attempts.slice(-MAX_ATTEMPTS);
  const key = `${unit}:${item}`;
  state.best[key] = Math.max(state.best[key] || 0, stars);
  save();
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
