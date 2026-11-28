// Tính mức hoàn thành bài được giao. Dùng chung cho trang học sinh và Dashboard giáo viên,
// để học sinh và thầy cô thấy cùng một con số.
//
// Một "nhiệm vụ" = một mục bài học luyện ở một mức. Ở mức L, học sinh cần làm:
//   - Từ vựng và Mẫu câu có mức ≤ L (giống những gì trang học sinh hiện ở mức L)
//   - Mọi bài Hội thoại, Đóng vai (đề bài tự khó dần theo mức)
//   - Thử thách của mức L (nếu thầy cô bật): Chương 1 Từ vựng, Chương 2 Hội thoại nhanh
// Nhiệm vụ "hoàn thành" khi có ít nhất một lượt LUYỆN Ở ĐÚNG MỨC ĐÓ đạt từ pass_stars sao trở lên,
// trước hoặc trong ngày hạn chót (nếu có).

// mode: 'graded' = giao bài, tính hoàn thành và điểm gợi ý; 'free' = không giao bài, học sinh tự luyện.
export const DEFAULT_ASSIGNMENT = { mode: 'graded', unit: 1, levels: [1], challenge: true, pass_stars: 2, due: null, scale: 10 };

export const isFree = (a) => Boolean(a && a.mode === 'free');

export function normAssignment(a) {
  const x = { ...DEFAULT_ASSIGNMENT, ...(a || {}) };
  x.mode = x.mode === 'free' ? 'free' : 'graded';
  x.levels = [...new Set((x.levels || []).map(Number).filter((n) => n >= 1 && n <= 3))].sort();
  if (!x.levels.length) x.levels = [1];
  x.pass_stars = Math.min(3, Math.max(1, Number(x.pass_stars) || 2));
  x.scale = Number(x.scale) || 10;
  x.unit = Number(x.unit) || 1;
  return x;
}

const SECTION_ACT = { vocabulary: 'Từ vựng', patterns: 'Mẫu câu', dialogues: 'Hội thoại', roleplays: 'Đóng vai' };
export const challengeId = (lv) => `challenge-vocab-L${lv}`;
export const challengeDialogId = (lv) => `challenge-dialog-L${lv}`;
const hasQuestions = (unit) => (unit.roleplays || []).some((r) => r.review === 'approved' && (r.turns || []).some((t) => t.bot && (t.expect_any || []).length));

// Danh sách nhiệm vụ của bài được giao. Chỉ tính nội dung đã được giáo viên duyệt.
export function tasksFor(unit, assignment) {
  const a = normAssignment(assignment);
  const ok = (x) => x.review === 'approved';
  const tasks = [];
  for (const L of a.levels) {
    for (const s of ['vocabulary', 'patterns']) {
      for (const x of (unit[s] || []).filter(ok).filter((x) => (x.level || 1) <= L)) {
        tasks.push({ key: `${x.id}@${L}`, item: x.id, level: L, section: s, label: x.word || x.text || x.title });
      }
    }
    for (const s of ['dialogues', 'roleplays']) {
      for (const x of (unit[s] || []).filter(ok)) tasks.push({ key: `${x.id}@${L}`, item: x.id, level: L, section: s, label: x.title });
    }
    if (a.challenge && (unit.vocabulary || []).some((v) => ok(v) && (v.level || 1) <= L)) {
      tasks.push({ key: `${challengeId(L)}@${L}`, item: challengeId(L), level: L, section: 'challenge', label: `Thử thách Chương 1 · Từ vựng · Mức ${L}` });
    }
    if (a.challenge && hasQuestions(unit)) {
      tasks.push({ key: `${challengeDialogId(L)}@${L}`, item: challengeDialogId(L), level: L, section: 'challenge2', label: `Thử thách Chương 2 · Hội thoại nhanh · Mức ${L}` });
    }
  }
  return tasks;
}

// attempts: [{ item, level, stars, t }]  (t = thời điểm ISO)
export function completion(unit, assignment, attempts) {
  const a = normAssignment(assignment);
  const tasks = tasksFor(unit, a);
  const dueEnd = a.due ? `${a.due}T23:59:59.999+07:00` : null;
  const best = new Map();
  const unitNo = Number(unit.meta && unit.meta.unit);
  for (const x of attempts) {
    if (!x || !x.item) continue;
    if (x.unit != null && Number(x.unit) !== unitNo) continue;
    if (dueEnd && new Date(x.t) > new Date(dueEnd)) continue;
    const k = `${x.item}@${x.level}`;
    best.set(k, Math.max(best.get(k) || 0, x.stars || 0));
  }
  const rows = tasks.map((t) => ({ ...t, best: best.get(t.key) || 0, done: (best.get(t.key) || 0) >= a.pass_stars }));
  const done = rows.filter((r) => r.done).length;
  const total = rows.length;
  const pct = total ? done / total : 0;
  const byLevel = a.levels.map((L) => {
    const r = rows.filter((x) => x.level === L);
    return { level: L, done: r.filter((x) => x.done).length, total: r.length };
  });
  const bySection = Object.keys({ ...SECTION_ACT, challenge: 1, challenge2: 1 }).map((s) => {
    const r = rows.filter((x) => x.section === s);
    return { section: s, name: SECTION_ACT[s] || (s === 'challenge2' ? 'Thử thách Ch.2' : 'Thử thách Ch.1'), done: r.filter((x) => x.done).length, total: r.length };
  }).filter((x) => x.total);
  // Điểm gợi ý = tỉ lệ hoàn thành × thang điểm, làm tròn 0,5. Giáo viên quyết định điểm cuối cùng.
  const grade = Math.round(pct * a.scale * 2) / 2;
  return { assignment: a, rows, done, total, pct, grade, byLevel, bySection, missing: rows.filter((r) => !r.done) };
}

// ---------- Mở khóa theo thứ tự (trang học sinh) ----------
// Trong một mức: Từ vựng → Mẫu câu → Hội thoại → Đóng vai → Thử thách Ch.1 → Thử thách Ch.2.
// Phần sau chỉ mở khi phần trước đã xong (mọi mục đạt từ `pass` sao, luyện ở đúng mức đó).
// Mức sau chỉ mở khi mức trước đã xong hết các phần.
export const PARTS = ['vocabulary', 'patterns', 'dialogues', 'roleplays', 'challenge', 'challenge2'];
// Phần nào cần xong trước phần nào (ở cùng một mức).
// Thử thách Chương 1 (từ vựng) mở ngay khi xong Từ vựng; Chương 2 (hội thoại nhanh) cần xong Đóng vai và Chương 1.
export const REQUIRES = {
  vocabulary: [],
  patterns: ['vocabulary'],
  dialogues: ['vocabulary', 'patterns'],
  roleplays: ['vocabulary', 'patterns', 'dialogues'],
  challenge: ['vocabulary'],
  challenge2: ['vocabulary', 'patterns', 'dialogues', 'roleplays', 'challenge'],
};
export const PART_VI = { vocabulary: 'Từ vựng', patterns: 'Mẫu câu', dialogues: 'Hội thoại', roleplays: 'Đóng vai', challenge: 'Thử thách Chương 1', challenge2: 'Thử thách Chương 2' };

export function gate(unit, attempts, pass = 2) {
  const best = new Map();
  const unitNo = Number(unit.meta && unit.meta.unit);
  for (const x of attempts || []) {
    if (!x || !x.item) continue;
    if (x.unit != null && Number(x.unit) !== unitNo) continue;
    const k = `${x.item}@${x.level}`;
    best.set(k, Math.max(best.get(k) || 0, x.stars || 0));
  }
  const levels = (unit.levels || [{ id: 1 }, { id: 2 }, { id: 3 }]).map((l) => l.id);
  const cache = new Map();
  const status = (L, part) => {
    const key = `${L}:${part}`;
    if (cache.has(key)) return cache.get(key);
    const tasks = tasksFor(unit, { levels: [L], challenge: true }).filter((t) => t.section === part);
    const done = tasks.filter((t) => (best.get(t.key) || 0) >= pass).length;
    const s = { done, total: tasks.length, complete: done >= tasks.length };
    cache.set(key, s);
    return s;
  };
  const levelDone = (L) => PARTS.every((p) => status(L, p).complete);
  const levelUnlocked = (L) => { const i = levels.indexOf(L); return i <= 0 || (levelUnlocked(levels[i - 1]) && levelDone(levels[i - 1])); };
  const partUnlocked = (L, part) => levelUnlocked(L) && (REQUIRES[part] || []).every((p) => status(L, p).complete);
  // Phần còn dở gần nhất đang chặn (để nhắc học sinh)
  const blocker = (L, part) => {
    if (!levelUnlocked(L)) return { level: levels[levels.indexOf(L) - 1], part: null };
    const p = (REQUIRES[part] || []).find((x) => !status(L, x).complete);
    return p ? { level: L, part: p } : null;
  };
  return { status, levelDone, levelUnlocked, partUnlocked, blocker, levels, pass };
}