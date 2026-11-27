// Tính mức hoàn thành bài được giao. Dùng chung cho trang học sinh và Dashboard giáo viên,
// để học sinh và thầy cô thấy cùng một con số.
//
// Một "nhiệm vụ" = một mục bài học luyện ở một mức. Ở mức L, học sinh cần làm:
//   - Từ vựng và Mẫu câu có mức ≤ L (giống những gì trang học sinh hiện ở mức L)
//   - Mọi bài Hội thoại, Đóng vai, Nói qua tranh (đề bài tự khó dần theo mức)
//   - Thử thách từ vựng của mức L (nếu thầy cô bật)
// Nhiệm vụ "hoàn thành" khi có ít nhất một lượt LUYỆN Ở ĐÚNG MỨC ĐÓ đạt từ pass_stars sao trở lên,
// trước hoặc trong ngày hạn chót (nếu có).

// mode: 'graded' = giao bài, tính hoàn thành và điểm gợi ý; 'free' = không giao bài, học sinh tự luyện.
export const DEFAULT_ASSIGNMENT = { mode: 'graded', levels: [1], challenge: true, pass_stars: 2, due: null, scale: 10 };

export const isFree = (a) => Boolean(a && a.mode === 'free');

export function normAssignment(a) {
  const x = { ...DEFAULT_ASSIGNMENT, ...(a || {}) };
  x.mode = x.mode === 'free' ? 'free' : 'graded';
  x.levels = [...new Set((x.levels || []).map(Number).filter((n) => n >= 1 && n <= 3))].sort();
  if (!x.levels.length) x.levels = [1];
  x.pass_stars = Math.min(3, Math.max(1, Number(x.pass_stars) || 2));
  x.scale = Number(x.scale) || 10;
  return x;
}

const SECTION_ACT = { vocabulary: 'Từ vựng', patterns: 'Mẫu câu', dialogues: 'Hội thoại', roleplays: 'Đóng vai', picture_tasks: 'Nói qua tranh' };
export const challengeId = (lv) => `challenge-vocab-L${lv}`;

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
    for (const s of ['dialogues', 'roleplays', 'picture_tasks']) {
      for (const x of (unit[s] || []).filter(ok)) tasks.push({ key: `${x.id}@${L}`, item: x.id, level: L, section: s, label: x.title });
    }
    if (a.challenge && (unit.vocabulary || []).some((v) => ok(v) && (v.level || 1) <= L)) {
      tasks.push({ key: `${challengeId(L)}@${L}`, item: challengeId(L), level: L, section: 'challenge', label: `Thử thách từ vựng Mức ${L}` });
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
  for (const x of attempts) {
    if (!x || !x.item) continue;
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
  const bySection = Object.keys({ ...SECTION_ACT, challenge: 1 }).map((s) => {
    const r = rows.filter((x) => x.section === s);
    return { section: s, name: SECTION_ACT[s] || 'Thử thách', done: r.filter((x) => x.done).length, total: r.length };
  }).filter((x) => x.total);
  // Điểm gợi ý = tỉ lệ hoàn thành × thang điểm, làm tròn 0,5. Giáo viên quyết định điểm cuối cùng.
  const grade = Math.round(pct * a.scale * 2) / 2;
  return { assignment: a, rows, done, total, pct, grade, byLevel, bySection, missing: rows.filter((r) => !r.done) };
}
