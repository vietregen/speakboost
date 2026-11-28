// Dashboard giáo viên: đăng nhập email, quản lý lớp/học sinh/PIN, xem tiến độ, xuất dữ liệu thực nghiệm.
// Mọi quyền do RLS ở máy chủ kiểm tra; trang này chỉ hiển thị những gì máy chủ cho phép.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import * as C from './content.js';
import * as G from './grading.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
const STUDENT_URL = new URL('./', location.href).href;   // trang học sinh cùng thư mục
const ROLE_VI = { super_admin: 'Super Admin', school_admin: 'Quản trị trường', teacher: 'Giáo viên' };
const GROUP_VI = { thuc_nghiem: 'Thực nghiệm', doi_chung: 'Đối chứng' };
const ACT_VI = { vocab: 'Từ vựng', pattern: 'Mẫu câu', dialogue: 'Hội thoại', roleplay: 'Đóng vai', challenge: 'Thử thách' };

const root = document.getElementById('app');
let sb = null;
let session = null;
let profile = null;
let unit = null;
let pendingSlips = null;   // phiếu PIN vừa tạo, chờ hiện sau khi vẽ lại trang

// ---------- Tiện ích ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString('vi-VN') : '—');
const fmtTime = (s) => (s ? new Date(s).toLocaleString('vi-VN', { hour12: false }) : '—');
const randInt = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const newPin = () => String(1000 + randInt(9000));
function newCode(name) {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'LOP';
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return `${base}-${Array.from({ length: 3 }, () => abc[randInt(abc.length)]).join('')}`;
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvEsc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const toCsv = (head, rows) => '﻿' + [head.map(csvEsc).join(','), ...rows.map((r) => r.map(csvEsc).join(','))].join('\r\n');
function errText(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/forbidden|permission|row-level/i.test(m)) return 'Bạn không có quyền làm việc này.';
  if (/duplicate|unique/i.test(m)) return 'Dữ liệu bị trùng (mã lớp hoặc số thứ tự đã có).';
  if (/rate limit|security purposes/i.test(m)) return 'Gửi quá nhiều lần. Chờ vài phút rồi thử lại.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Chưa kết nối được máy chủ. Kiểm tra Internet.';
  return m;
}
function loadScript(src) {
  return new Promise((ok, fail) => { const s = h('script', { src }); s.onload = ok; s.onerror = () => fail(new Error('Không tải được thư viện.')); document.head.append(s); });
}
async function allRows(query) {          // Supabase trả tối đa 1000 dòng/lần → lấy theo trang
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw error;
    out.push(...data);
    if (data.length < 1000) return out;
  }
}

function frame(title, ...content) {
  return h('div', { class: 'dash' },
    h('header', { class: 'dash-top' },
      h('a', { class: 'dash-brand', href: '#/' }, '📊 SpeakBoost'),
      profile ? h('nav', { class: 'dash-nav' },
        h('a', { href: '#/' }, 'Lớp học'),
        h('a', { href: 'teacher.html' }, 'Duyệt nội dung'),
        profile.role !== 'teacher' ? h('a', { href: '#/admin' }, 'Quản trị') : null) : null,
      session ? h('div', { class: 'dash-user' },
        h('span', {}, session.user.email, profile ? ` · ${ROLE_VI[profile.role]}` : ''),
        h('button', { class: 'link-btn', onclick: async () => { await sb.auth.signOut(); location.hash = '#/'; start(); } }, 'Đăng xuất')) : null),
    h('main', { class: 'dash-main' }, title ? h('h1', {}, title) : null, ...content));
}
const show = (title, ...content) => root.replaceChildren(frame(title, ...content));
const note = (cls, text) => h('p', { class: cls, 'aria-live': 'polite' }, text);

// ---------- Đăng nhập ----------
function renderSignIn(msg) {
  const email = h('input', { type: 'email', required: true, class: 'field', placeholder: 'email@truong.edu.vn', autocomplete: 'email', 'aria-label': 'Email' });
  const btn = h('button', { class: 'btn btn-main', type: 'submit' }, 'Gửi link đăng nhập');
  const out = note('muted', msg || '');
  show('Đăng nhập giáo viên',
    h('div', { class: 'card narrow' },
      h('p', {}, 'Nhập email đã được mời. SpeakBoost gửi một đường link vào email; bấm link đó là vào được, không cần mật khẩu.'),
      h('form', { class: 'stack', onsubmit: async (e) => {
        e.preventDefault(); btn.disabled = true; out.className = 'muted'; out.textContent = 'Đang gửi…';
        const { error } = await sb.auth.signInWithOtp({ email: email.value.trim(), options: { emailRedirectTo: location.origin + location.pathname } });
        btn.disabled = false;
        if (error) { out.className = 'warn'; out.textContent = errText(error); return; }
        out.className = 'ok-text'; out.textContent = `Đã gửi link tới ${email.value.trim()}. Mở email (xem cả mục Spam) và bấm “Log In”. Có thể đóng trang này.`;
      } }, email, btn), out),
    h('p', { class: 'muted small' }, 'Học sinh không dùng trang này. Học sinh vào trang chính và đăng nhập bằng mã lớp + PIN.'));
}

// ---------- Danh sách lớp ----------
async function renderClasses() {
  show('Lớp học', note('muted', 'Đang tải…'));
  const [{ data: classes, error }, { data: schools }] = await Promise.all([
    sb.from('classes').select('id, name, code, study_group, active, school_id, teacher_id, created_at').order('name'),
    sb.from('schools').select('id, name').order('name'),
  ]);
  if (error) return show('Lớp học', note('warn', errText(error)));
  const counts = {};
  if (classes.length) {
    const { data: st } = await sb.from('students').select('class_id');
    for (const s of st || []) counts[s.class_id] = (counts[s.class_id] || 0) + 1;
  }
  const schoolName = Object.fromEntries((schools || []).map((s) => [s.id, s.name]));

  const name = h('input', { class: 'field', required: true, maxlength: 20, placeholder: 'VD: 6A', 'aria-label': 'Tên lớp' });
  const group = h('select', { class: 'field', 'aria-label': 'Nhóm thực nghiệm' },
    h('option', { value: '' }, 'Chưa xếp nhóm'), h('option', { value: 'thuc_nghiem' }, 'Nhóm thực nghiệm'), h('option', { value: 'doi_chung' }, 'Nhóm đối chứng'));
  const school = h('select', { class: 'field', 'aria-label': 'Trường' }, ...(schools || []).map((s) => h('option', { value: s.id, selected: s.id === profile.school_id }, s.name)));
  const out = note('warn', '');
  const form = h('form', { class: 'row wrap', onsubmit: async (e) => {
    e.preventDefault(); out.textContent = '';
    const schoolId = profile.role === 'super_admin' ? school.value : profile.school_id;
    if (!schoolId) { out.textContent = 'Tài khoản chưa gắn với trường nào. Nhờ Super Admin gắn trường.'; return; }
    for (let i = 0; i < 5; i++) {        // thử lại nếu mã lớp ngẫu nhiên bị trùng
      const { data, error: err } = await sb.from('classes').insert({ name: name.value.trim(), code: newCode(name.value), study_group: group.value || null, school_id: schoolId, teacher_id: session.user.id }).select('id').single();
      if (!err) { location.hash = `#/class/${data.id}`; return; }
      if (!/duplicate|unique/i.test(err.message)) { out.textContent = errText(err); return; }
    }
    out.textContent = 'Chưa tạo được mã lớp, thử lại.';
  } }, name, group, profile.role === 'super_admin' && (schools || []).length > 1 ? school : null, h('button', { class: 'btn btn-main', type: 'submit' }, '+ Tạo lớp'));

  show('Lớp học',
    classes.length ? h('div', { class: 'class-grid' }, ...classes.map((c) =>
      h('a', { class: 'card class-card', href: `#/class/${c.id}` },
        h('b', { class: 'class-name' }, c.name),
        h('span', { class: 'code-tag' }, c.code),
        h('span', { class: 'muted' }, `${counts[c.id] || 0} học sinh`, c.study_group ? ` · ${GROUP_VI[c.study_group]}` : '', c.active ? '' : ' · đã khóa'),
        profile.role !== 'teacher' ? h('span', { class: 'muted small' }, schoolName[c.school_id] || '') : null)))
      : h('div', { class: 'card' }, h('p', {}, 'Chưa có lớp nào. Tạo lớp đầu tiên ở dưới.')),
    h('section', { class: 'card' }, h('h2', {}, 'Tạo lớp mới'), form, out,
      h('p', { class: 'muted small' }, 'Mã lớp được tạo tự động. Nhóm thực nghiệm / đối chứng dùng khi xuất dữ liệu.')));
}

// ---------- Một lớp ----------
async function renderClass(id) {
  show('Lớp', note('muted', 'Đang tải…'));
  const { data: cls, error } = await sb.from('classes').select('id, name, code, study_group, active, assignment').eq('id', id).maybeSingle();
  if (error || !cls) return show('Lớp', note('warn', error ? errText(error) : 'Không tìm thấy lớp, hoặc bạn không có quyền xem lớp này.'));
  const { data: students, error: e2 } = await sb.from('students').select('id, roster_no, nickname, failed_attempts, locked_until').eq('class_id', id).order('roster_no');
  if (e2) return show(cls.name, note('warn', errText(e2)));
  let attempts = [];
  try {
    attempts = await allRows(() => sb.from('attempts').select('student_id, unit, activity, item_id, level, source, stars, detail, is_simulated, created_at').eq('class_id', id).order('created_at'));
  } catch (e) { attempts = []; }

  const link = `${STUDENT_URL}?lop=${encodeURIComponent(cls.code)}`;
  const tabs = { progress: 'Tiến độ & điểm', students: 'Học sinh & PIN', export: 'Xuất dữ liệu', settings: 'Giao bài & cài đặt' };
  const current = (location.hash.split('/')[3]) || (students.length ? 'progress' : 'students');
  const body = { progress: () => progressView(cls, students, attempts), students: () => studentsView(cls, students), export: () => exportView(cls, students, attempts), settings: () => settingsView(cls, link) }[current] || (() => progressView(cls, students, attempts));

  show(null,
    h('div', { class: 'class-head' },
      h('div', {}, h('a', { href: '#/', class: 'muted' }, '‹ Lớp học'), h('h1', {}, `Lớp ${cls.name}`),
        h('p', { class: 'muted' }, 'Mã lớp ', h('b', { class: 'code-tag' }, cls.code), ` · ${students.length} học sinh`, cls.study_group ? ` · ${GROUP_VI[cls.study_group]}` : '')),
    ),
    h('nav', { class: 'tabs' }, ...Object.entries(tabs).map(([k, v]) => h('a', { href: `#/class/${id}/${k}`, class: k === current ? 'on' : '' }, v))),
    body());
}

// ---- Tiến độ & điểm ----
// Lượt luyện từ máy chủ → dạng dùng chung với trang học sinh.
const asAttempts = (list) => list.map((a) => ({ item: a.item_id, level: a.level, stars: a.stars, t: a.created_at }));

function progressView(cls, students, attempts) {
  if (!students.length) return h('div', { class: 'card' }, h('p', {}, 'Lớp chưa có học sinh. Vào thẻ “Học sinh & PIN” để thêm.'));
  if (!unit) return h('div', { class: 'card warn' }, h('p', {}, 'Chưa tải được nội dung bài học để tính mức hoàn thành.'));
  const asg = G.normAssignment(cls.assignment);
  const real = attempts.filter((a) => !a.is_simulated);
  const by = new Map(students.map((s) => [s.id, []]));
  for (const a of real) by.get(a.student_id)?.push(a);
  if (asg.mode === 'free') return practiceView(cls, students, real, by);

  const rows = students.map((s) => {
    const list = by.get(s.id) || [];
    const c = G.completion(unit, asg, asAttempts(list));
    return { s, c, n: list.length, days: new Set(list.map((a) => a.created_at.slice(0, 10))).size, last: list.length ? list[list.length - 1].created_at : null };
  });
  const total = rows[0]?.c.total || 0;
  const finished = rows.filter((r) => r.c.total && r.c.done === r.c.total).length;
  const avgPct = rows.length ? Math.round((rows.reduce((t, r) => t + r.c.pct, 0) / rows.length) * 100) : 0;
  const active7 = rows.filter((r) => r.last && Date.now() - new Date(r.last) < 7 * 864e5).length;

  const detail = h('div', {});
  const showDetail = (r) => {
    const groups = r.c.bySection.map((g) => h('li', {}, `${g.name}: ${g.done}/${g.total}`));
    const miss = r.c.missing;
    detail.replaceChildren(h('section', { class: 'card' },
      h('h2', {}, `${r.s.roster_no}. ${r.s.nickname} · ${r.c.done}/${r.c.total} nhiệm vụ · điểm gợi ý ${r.c.grade}`),
      h('ul', { class: 'inline-list' }, ...groups),
      miss.length ? h('div', {}, h('p', { class: 'muted' }, `Còn ${miss.length} nhiệm vụ chưa đạt ${asg.pass_stars}⭐ (sao cao nhất hiện có trong ngoặc):`),
        h('ul', { class: 'miss-list' }, ...miss.map((m) => h('li', {}, `Mức ${m.level} · ${G_SECTION[m.section] || m.section} · ${m.label} (${m.best}⭐)`))))
        : h('p', { class: 'ok-text' }, '🎉 Đã hoàn thành toàn bộ bài được giao.')));
    detail.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pctBar = (r) => h('span', { class: 'mini' }, h('span', { class: 'mini-bar wide' }, h('span', { style: `width:${Math.round(r.c.pct * 100)}%` })), `${r.c.done}/${r.c.total}`);
  return h('div', {},
    h('div', { class: 'card assign-note' },
      h('b', {}, 'Bài được giao: '), asg.levels.map((l) => `Mức ${l}`).join(' + '), asg.challenge ? ' (có Thử thách)' : '',
      ` · đạt khi ≥ ${asg.pass_stars}⭐`, asg.due ? ` · hạn ${fmtDate(asg.due)}` : ' · chưa đặt hạn',
      ` · ${total} nhiệm vụ/học sinh · thang ${asg.scale} `,
      h('a', { href: `#/class/${cls.id}/settings` }, 'Sửa')),
    h('div', { class: 'stats' },
      stat(`${avgPct}%`, 'hoàn thành trung bình'), stat(`${finished}/${students.length}`, 'học sinh đã xong'),
      stat(active7, 'luyện trong 7 ngày qua'), stat(real.length, 'lượt luyện')),
    h('div', { class: 'card table-wrap' },
      h('table', { class: 'grid clickable' },
        h('thead', {}, h('tr', {}, ...['Số', 'Tên gọi', 'Hoàn thành', 'Điểm gợi ý', ...asg.levels.map((l) => `Mức ${l}`), 'Ngày luyện', 'Lượt', 'Lần cuối'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...rows.map((r) => h('tr', { class: r.n ? '' : 'idle', tabindex: 0, title: 'Bấm để xem bài còn thiếu', onclick: () => showDetail(r), onkeydown: (e) => { if (e.key === 'Enter') showDetail(r); } },
          h('td', {}, r.s.roster_no), h('td', {}, r.s.nickname), h('td', {}, pctBar(r)), h('td', { class: 'grade' }, r.c.grade),
          ...r.c.byLevel.map((b) => h('td', {}, `${b.done}/${b.total}`)),
          h('td', {}, r.days), h('td', {}, r.n), h('td', {}, fmtDate(r.last))))))),
    h('p', { class: 'muted small' }, `Điểm gợi ý = tỉ lệ nhiệm vụ đạt ≥ ${asg.pass_stars}⭐ × ${asg.scale}, làm tròn 0,5${asg.due ? `, chỉ tính lượt luyện đến hết ngày ${fmtDate(asg.due)}` : ''}. “Sao” là mức máy nhận diện được lời nói, không phải điểm phát âm; thầy cô quyết định điểm cuối cùng. Bấm vào một học sinh để xem bài còn thiếu.`),
    detail,
    hardWords(real));
}

// Lớp tự luyện (không giao bài): chỉ số liệu luyện tập, không điểm.
function practiceView(cls, students, real, by) {
  const approved = (s) => (unit?.[s] || []).filter((x) => x.review === 'approved').map((x) => x.id);
  const SECT = [['vocab', 'vocabulary', 'Từ vựng'], ['pattern', 'patterns', 'Mẫu câu'], ['dialogue', 'dialogues', 'Hội thoại'], ['roleplay', 'roleplays', 'Đóng vai']];
  const totals = Object.fromEntries(SECT.map(([act, s]) => [act, new Set(approved(s))]));
  const rows = students.map((s) => {
    const list = by.get(s.id) || [];
    const done = (act) => new Set(list.filter((a) => a.activity === act && a.stars > 0 && totals[act].has(a.item_id.split('#')[0])).map((a) => a.item_id.split('#')[0])).size;
    const ch = list.filter((a) => a.activity === 'challenge');
    return { s, n: list.length, days: new Set(list.map((a) => a.created_at.slice(0, 10))).size,
      last: list.length ? list[list.length - 1].created_at : null, ch: ch.length ? Math.max(...ch.map((a) => a.stars)) : 0,
      done: Object.fromEntries(SECT.map(([act]) => [act, done(act)])) };
  });
  const active7 = rows.filter((r) => r.last && Date.now() - new Date(r.last) < 7 * 864e5).length;
  const bar = (v, t) => h('span', { class: 'mini' }, h('span', { class: 'mini-bar' }, h('span', { style: `width:${t ? Math.round((v / t) * 100) : 0}%` })), `${v}/${t}`);
  return h('div', {},
    h('div', { class: 'card assign-note' }, h('b', {}, 'Lớp tự luyện: '), 'không giao bài, không tính điểm. Học sinh luyện mọi nội dung đã duyệt, ở mức tùy chọn. ',
      h('a', { href: `#/class/${cls.id}/settings` }, 'Giao bài')),
    h('div', { class: 'stats' },
      stat(students.length, 'học sinh'), stat(rows.filter((r) => r.n).length, 'đã từng luyện'),
      stat(active7, 'luyện trong 7 ngày qua'), stat(real.length, 'lượt luyện')),
    h('div', { class: 'card table-wrap' },
      h('table', { class: 'grid' },
        h('thead', {}, h('tr', {}, ...['Số', 'Tên gọi', ...SECT.map(([, , n]) => n), 'Thử thách', 'Ngày luyện', 'Lượt', 'Lần cuối'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...rows.map((r) => h('tr', { class: r.n ? '' : 'idle' },
          h('td', {}, r.s.roster_no), h('td', {}, r.s.nickname),
          ...SECT.map(([act]) => h('td', {}, bar(r.done[act], totals[act].size))),
          h('td', {}, r.ch ? '★'.repeat(r.ch) : '—'), h('td', {}, r.days), h('td', {}, r.n), h('td', {}, fmtDate(r.last))))))),
    h('p', { class: 'muted small' }, 'Mỗi ô: số bài đã luyện (ở bất kỳ mức nào, có ít nhất 1 sao) / số bài đã duyệt. Chỉ gồm dữ liệu thật.'),
    hardWords(real));
}

const G_SECTION = { vocabulary: 'Từ vựng', patterns: 'Mẫu câu', dialogues: 'Hội thoại', roleplays: 'Đóng vai', challenge: 'Thử thách Ch.1', challenge2: 'Thử thách Ch.2' };

// Từ máy hay chưa nghe rõ: tỉ lệ lượt nhận diện < 3 sao trên từng từ.
function hardWords(real) {
  const vocab = new Map((unit?.vocabulary || []).map((v) => [v.id, v]));
  const stats = new Map();
  for (const a of real) if (a.activity === 'vocab' && a.source === 'asr_match') {
    const w = stats.get(a.item_id) || { n: 0, miss: 0 };
    w.n++; if (a.stars < 3) w.miss++;
    stats.set(a.item_id, w);
  }
  const hard = [...stats.entries()].filter(([, w]) => w.n >= 3).map(([id, w]) => ({ id, ...w, rate: w.miss / w.n }))
    .sort((a, b) => b.rate - a.rate).slice(0, 8).filter((w) => w.rate > 0);
  return h('section', { class: 'card' }, h('h2', {}, 'Từ máy hay chưa nghe rõ'),
    hard.length ? h('ol', { class: 'hard-list' }, ...hard.map((w) => h('li', {}, h('b', {}, vocab.get(w.id)?.word || w.id), ` ${vocab.get(w.id)?.ipa || ''} · ${Math.round(w.rate * 100)}% lượt chưa được 3 sao (${w.n} lượt)`)))
      : h('p', { class: 'muted' }, 'Chưa đủ dữ liệu (cần ít nhất 3 lượt nói cho mỗi từ).'));
}

const stat = (n, label) => h('div', { class: 'card stat' }, h('b', {}, n), h('span', {}, label));

// ---- Học sinh & PIN ----
function studentsView(cls, students) {
  const out = note('warn', '');
  const slips = h('div', {});
  const existing = new Set(students.map((s) => s.roster_no));

  const showSlips = (list, title) => {
    slips.replaceChildren(h('section', { class: 'card slips-card' },
      h('h2', {}, title),
      h('p', { class: 'warn' }, 'PIN chỉ hiện một lần. In hoặc chép lại ngay; sau này chỉ có thể đặt PIN mới.'),
      h('div', { class: 'row' }, h('button', { class: 'btn btn-main', onclick: () => window.print() }, '🖨 In phiếu PIN')),
      h('div', { class: 'slips' }, ...list.map((s) => h('div', { class: 'slip' },
        h('b', {}, 'SpeakBoost'), h('span', {}, `Lớp ${cls.name} · mã lớp `, h('b', {}, cls.code)),
        h('span', { class: 'slip-name' }, `${s.roster_no}. ${s.nickname}`), h('span', {}, 'PIN: ', h('b', { class: 'slip-pin' }, s.pin)))))));
    slips.scrollIntoView({ behavior: 'smooth' });
  };

  // Thêm học sinh: dán danh sách "số thứ tự, tên gọi" hoặc tải Excel 2 cột
  const area = h('textarea', { class: 'field', rows: 6, placeholder: '1, An\n2, Bình\n3, Chi', 'aria-label': 'Danh sách học sinh' });
  const parse = (text) => text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l, i) => {
    const m = l.match(/^(\d{1,2})\s*[,.;:\t\-–]?\s*(.+)$/);
    return m ? { roster_no: Number(m[1]), nickname: m[2].trim().slice(0, 40) } : { roster_no: null, nickname: l, line: i + 1 };
  });
  const save = async (rows) => {
    out.textContent = '';
    const bad = rows.filter((r) => !r.roster_no || r.roster_no > 99 || !r.nickname);
    if (bad.length) { out.textContent = `Dòng chưa đúng dạng “số, tên”: ${bad.map((b) => b.nickname).slice(0, 3).join(' | ')}`; return; }
    const fresh = rows.filter((r) => !existing.has(r.roster_no));
    const skipped = rows.length - fresh.length;
    if (!fresh.length) { out.textContent = 'Các số thứ tự này đã có trong lớp. Muốn đổi PIN thì dùng nút “PIN mới” ở từng bạn.'; return; }
    const withPin = fresh.map((r) => ({ ...r, pin: newPin() }));
    const { error } = await sb.rpc('upsert_students', { p_class: cls.id, p_rows: withPin });
    if (error) { out.textContent = errText(error); return; }
    // Giữ phiếu PIN lại để hiện sau khi trang vẽ lại (PIN chỉ có ở đây, máy chủ chỉ lưu bản băm).
    pendingSlips = { list: withPin, title: `Phiếu PIN · ${withPin.length} học sinh mới${skipped ? ` (bỏ qua ${skipped} số đã có)` : ''}` };
    const target = `#/class/${cls.id}/students`;
    if (location.hash !== target) location.hash = target; else renderClass(cls.id);
  };
  const fileIn = h('input', { type: 'file', accept: '.xlsx,.xls,.csv', class: 'sr-only', id: 'roster-file', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      if (!window.XLSX) await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
      const wb = window.XLSX.read(await f.arrayBuffer());
      const rows = window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
        .filter((r) => /^\d+$/.test(String(r[0]).trim()) && String(r[1]).trim())
        .map((r) => `${String(r[0]).trim()}, ${String(r[1]).trim()}`);
      area.value = rows.join('\n');
      out.textContent = rows.length ? '' : 'Không đọc được dòng nào. Cột A là số thứ tự, cột B là tên gọi.';
    } catch (err) { out.textContent = errText(err); }
    e.target.value = '';
  } });

  const table = students.length ? h('div', { class: 'card table-wrap' }, h('table', { class: 'grid' },
    h('thead', {}, h('tr', {}, ...['Số', 'Tên gọi', 'Trạng thái', ''].map((t) => h('th', {}, t)))),
    h('tbody', {}, ...students.map((s) => h('tr', {},
      h('td', {}, s.roster_no), h('td', {}, s.nickname),
      h('td', {}, s.locked_until && new Date(s.locked_until) > new Date() ? '🔒 tạm khóa (sai PIN)' : 'bình thường'),
      h('td', { class: 'actions' },
        h('button', { class: 'link-btn', onclick: async () => {
          if (!confirm(`Đặt PIN mới cho ${s.roster_no}. ${s.nickname}? Bạn này sẽ phải đăng nhập lại.`)) return;
          const pin = newPin();
          const { error } = await sb.rpc('reset_pin', { p_student: s.id, p_pin: pin });
          if (error) { out.textContent = errText(error); return; }
          showSlips([{ ...s, pin }], `PIN mới · ${s.nickname}`);
        } }, 'PIN mới'),
        h('button', { class: 'link-btn danger', onclick: async () => {
          if (!confirm(`Xóa ${s.roster_no}. ${s.nickname} khỏi lớp? Toàn bộ kết quả luyện tập của bạn này cũng bị xóa và không khôi phục được.`)) return;
          const { error } = await sb.from('students').delete().eq('id', s.id);
          if (error) { out.textContent = errText(error); return; }
          renderClass(cls.id);
        } }, 'Xóa'))))))) : null;

  const view = h('div', { class: 'students-view' },
    table,
    h('section', { class: 'card' }, h('h2', {}, 'Thêm học sinh'),
      h('p', { class: 'muted' }, 'Mỗi dòng: số thứ tự, tên gọi. Chỉ cần tên gọi ngắn (VD: “An”, “Bình B”), không cần họ tên đầy đủ. Hoặc tải tệp Excel: cột A số thứ tự, cột B tên gọi.'),
      area,
      h('div', { class: 'row wrap' }, fileIn, h('label', { for: 'roster-file', class: 'btn btn-soft' }, '⬆ Lấy từ Excel'),
        h('button', { class: 'btn btn-main', onclick: () => save(parse(area.value)) }, 'Thêm và tạo PIN')), out),
    slips);
  if (pendingSlips) { const p = pendingSlips; pendingSlips = null; setTimeout(() => showSlips(p.list, p.title), 0); }
  return view;
}

// ---- Xuất dữ liệu ----
function exportView(cls, students, attempts) {
  const byId = new Map(students.map((s) => [s.id, s]));
  const from = h('input', { type: 'date', class: 'field', 'aria-label': 'Từ ngày' });
  const to = h('input', { type: 'date', class: 'field', 'aria-label': 'Đến ngày' });
  const withName = h('input', { type: 'checkbox', id: 'with-name' });
  const pick = () => attempts.filter((a) => {
    const d = a.created_at.slice(0, 10);
    return (!from.value || d >= from.value) && (!to.value || d <= to.value);
  });
  const code = (s) => `${cls.name}-${String(s.roster_no).padStart(2, '0')}`;
  const stamp = () => new Date().toISOString().slice(0, 10);
  const group = cls.study_group || '';

  const rawCsv = () => {
    const list = pick();
    const head = ['ma_hoc_sinh', ...(withName.checked ? ['ten_goi'] : []), 'lop', 'nhom', 'thoi_gian', 'unit', 'hoat_dong', 'muc', 'muc_do', 'nguon_danh_gia', 'sao', 'chi_tiet', 'is_simulated'];
    const rows = list.map((a) => { const s = byId.get(a.student_id) || { roster_no: '?', nickname: '' };
      return [code(s), ...(withName.checked ? [s.nickname] : []), cls.name, group, a.created_at, a.unit, a.activity, a.item_id, a.level, a.source, a.stars, a.detail, a.is_simulated]; });
    download(`speakboost-${cls.name}-luot-luyen-${stamp()}.csv`, toCsv(head, rows), 'text/csv;charset=utf-8');
  };
  const sumCsv = () => {
    const list = pick().filter((a) => !a.is_simulated);
    const head = ['ma_hoc_sinh', ...(withName.checked ? ['ten_goi'] : []), 'lop', 'nhom', 'so_ngay_luyen', 'so_luot', 'so_luot_nhan_dien', 'sao_tb_nhan_dien', 'so_luot_tu_danh_gia',
      ...Object.keys(ACT_VI).map((k) => `muc_da_luyen_${k}`), 'thu_thach_sao_cao_nhat', 'lan_dau', 'lan_cuoi'];
    const rows = students.map((s) => {
      const mine = list.filter((a) => a.student_id === s.id);
      const asr = mine.filter((a) => a.source === 'asr_match');
      const ch = mine.filter((a) => a.activity === 'challenge');
      return [code(s), ...(withName.checked ? [s.nickname] : []), cls.name, group,
        new Set(mine.map((a) => a.created_at.slice(0, 10))).size, mine.length, asr.length,
        asr.length ? (asr.reduce((t, a) => t + a.stars, 0) / asr.length).toFixed(2) : '',
        mine.length - asr.length,
        ...Object.keys(ACT_VI).map((k) => new Set(mine.filter((a) => a.activity === k && a.stars > 0).map((a) => a.item_id.split('#')[0])).size),
        ch.length ? Math.max(...ch.map((a) => a.stars)) : '', mine[0]?.created_at || '', mine[mine.length - 1]?.created_at || ''];
    });
    download(`speakboost-${cls.name}-tong-hop-${stamp()}.csv`, toCsv(head, rows), 'text/csv;charset=utf-8');
  };
  // Bảng điểm: mức hoàn thành bài được giao (theo cài đặt của lớp, tính đến hạn chót).
  const free = G.isFree(cls.assignment);
  const gradeCsv = () => {
    if (!unit || free) return;
    const asg = G.normAssignment(cls.assignment);
    const real = attempts.filter((a) => !a.is_simulated);
    const head = ['so_thu_tu', 'ten_goi', 'lop', 'nhiem_vu_dat', 'tong_nhiem_vu', 'ti_le_hoan_thanh', `diem_goi_y_thang_${asg.scale}`,
      ...asg.levels.map((l) => `muc_${l}_dat`), 'lan_luyen_cuoi'];
    const rows = students.map((s) => {
      const mine = real.filter((a) => a.student_id === s.id);
      const c = G.completion(unit, asg, mine.map((a) => ({ item: a.item_id, level: a.level, stars: a.stars, t: a.created_at })));
      return [s.roster_no, s.nickname, cls.name, c.done, c.total, `${Math.round(c.pct * 100)}%`, String(c.grade).replace('.', ','),
        ...c.byLevel.map((b) => `${b.done}/${b.total}`), mine.length ? mine[mine.length - 1].created_at.slice(0, 10) : ''];
    });
    download(`speakboost-${cls.name}-bang-diem-${stamp()}.csv`, toCsv(head, rows), 'text/csv;charset=utf-8');
  };

  return h('div', {},
    h('section', { class: 'card' }, h('h2', {}, 'Bảng điểm'),
      h('p', {}, 'Mức hoàn thành bài được giao và điểm gợi ý của từng học sinh, theo cài đặt ở thẻ “Giao bài & cài đặt”. Tệp có tên gọi để nhập vào sổ điểm; không gửi tệp này ra ngoài nhà trường.'),
      free ? h('p', { class: 'muted' }, 'Lớp đang để “Không giao bài” nên không có bảng điểm. Dùng “Bảng tổng hợp theo học sinh” bên dưới để xem số liệu luyện tập.')
        : h('button', { class: 'btn btn-main', onclick: gradeCsv }, '⬇ Tải bảng điểm (CSV)')),
    h('section', { class: 'card' }, h('h2', {}, 'Xuất dữ liệu phục vụ thực nghiệm sư phạm'),
      h('p', {}, `Lớp ${cls.name}`, group ? ` · nhóm ${GROUP_VI[group]}` : ' · chưa xếp nhóm (xếp ở thẻ “Giao bài & cài đặt”)', ` · ${attempts.length} lượt luyện đã ghi.`),
      h('div', { class: 'row wrap' }, h('label', {}, 'Từ ngày ', from), h('label', {}, 'Đến ngày ', to)),
      h('p', {}, withName, h('label', { for: 'with-name' }, ' Kèm tên gọi (mặc định chỉ dùng mã ẩn danh dạng 6A-07)')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn btn-main', onclick: sumCsv }, '⬇ Bảng tổng hợp theo học sinh (CSV)'),
        h('button', { class: 'btn btn-soft', onclick: rawCsv }, '⬇ Toàn bộ lượt luyện (CSV)'))),
    h('section', { class: 'card' }, h('h2', {}, 'Lưu ý khi dùng số liệu'),
      h('ul', {},
        h('li', {}, 'Mọi dòng là dữ liệu thật phát sinh khi học sinh luyện tập; cột is_simulated cho biết dòng nào là dữ liệu thử (mặc định false). Ứng dụng không tự tạo số liệu.'),
        h('li', {}, '“Sao” ở nguồn asr_match là mức máy nhận diện được lời nói so với câu mẫu, KHÔNG phải điểm phát âm chi tiết. Nguồn self_check là học sinh tự đánh giá.'),
        h('li', {}, 'Tệp CSV mở được bằng Excel (mã hóa UTF-8). Chỉ gửi tệp có mã ẩn danh khi chia sẻ ra ngoài nhà trường.'))));
}

// ---- Mã lớp & cài đặt ----
function settingsView(cls, link) {
  const qrBox = h('div', { class: 'qr' }, note('muted', 'Đang tạo mã QR…'));
  loadScript(QR_LIB).then(() => {
    const qr = window.qrcode(0, 'M'); qr.addData(link); qr.make();
    const img = h('img', { src: qr.createDataURL(6, 2), alt: `Mã QR vào lớp ${cls.name}`, width: 220, height: 220 });
    qrBox.replaceChildren(img);
  }).catch(() => qrBox.replaceChildren(note('muted', 'Chưa tạo được mã QR; dùng đường link bên cạnh.')));
  const group = h('select', { class: 'field' }, ...[['', 'Chưa xếp nhóm'], ['thuc_nghiem', 'Nhóm thực nghiệm'], ['doi_chung', 'Nhóm đối chứng']]
    .map(([v, t]) => h('option', { value: v, selected: (cls.study_group || '') === v }, t)));
  const out = note('muted', '');
  const upd = async (patch, ok) => { const { error } = await sb.from('classes').update(patch).eq('id', cls.id); out.className = error ? 'warn' : 'ok-text'; out.textContent = error ? errText(error) : ok; };
  // --- Giao bài ---
  const asg = G.normAssignment(cls.assignment);
  const lvBox = [1, 2, 3].map((l) => h('input', { type: 'checkbox', id: `lv${l}`, checked: asg.levels.includes(l) }));
  const chBox = h('input', { type: 'checkbox', id: 'asg-ch', checked: asg.challenge });
  const pass = h('select', { class: 'field', 'aria-label': 'Ngưỡng sao' }, ...[1, 2, 3].map((n) => h('option', { value: n, selected: n === asg.pass_stars }, `${n} sao trở lên`)));
  const due = h('input', { type: 'date', class: 'field', value: asg.due || '', 'aria-label': 'Hạn chót' });
  const scale = h('select', { class: 'field', 'aria-label': 'Thang điểm' }, ...[10, 100].map((n) => h('option', { value: n, selected: n === asg.scale }, `Thang ${n}`)));
  const preview = h('p', { class: 'muted small' });
  const freeBox = h('input', { type: 'checkbox', id: 'asg-free', checked: asg.mode === 'free' });
  const gradedPart = h('fieldset', { class: 'plain' });
  const draft = () => G.normAssignment({ mode: freeBox.checked ? 'free' : 'graded', levels: [1, 2, 3].filter((l, i) => lvBox[i].checked), challenge: chBox.checked, pass_stars: Number(pass.value), due: due.value || null, scale: Number(scale.value) });
  const refresh = () => {
    const d = draft();
    gradedPart.disabled = freeBox.checked;
    preview.textContent = freeBox.checked ? 'Học sinh tự luyện mọi nội dung đã duyệt; trang học sinh không hiện nhiệm vụ, Dashboard không tính điểm.'
      : unit ? `Mỗi học sinh có ${G.tasksFor(unit, d).length} nhiệm vụ.` : '';
  };
  [freeBox, ...lvBox, chBox, pass, due, scale].forEach((el) => el.addEventListener('change', refresh));
  const assignCard = h('section', { class: 'card' }, h('h2', {}, '📋 Bài được giao & cách tính điểm'),
    h('p', {}, h('label', { class: 'check' }, freeBox, h('b', {}, ' Không giao bài – học sinh tự luyện'))),
    gradedPart,
    preview,
    h('button', { class: 'btn btn-main', onclick: () => {
      const d = draft();
      upd({ assignment: d }, `Đã lưu. Học sinh thấy thay đổi khi mở lại trang.`).then(() => { cls.assignment = d; });
    } }, 'Lưu'),
    h('p', { class: 'muted small' }, 'Giao bài không khóa nội dung: học sinh vẫn luyện mọi bài đã duyệt ở mọi mức, kể cả sau hạn chót. Lượt luyện sau hạn chót vẫn được ghi lại nhưng không tính vào điểm gợi ý.'));
  gradedPart.append(
    h('p', {}, 'Mức học sinh cần hoàn thành:'),
    h('div', { class: 'row wrap' }, ...[1, 2, 3].map((l, i) => h('label', { class: 'check' }, lvBox[i], ` Mức ${l} – ${(unit?.levels || []).find((x) => x.id === l)?.name || ''}`))),
    h('p', {}, h('label', { class: 'check' }, chBox, ' Tính cả Thử thách từ vựng của mỗi mức')),
    h('div', { class: 'row wrap' }, h('label', {}, 'Một bài đạt khi: ', pass), h('label', {}, 'Hạn chót: ', due), h('label', {}, scale)));
  refresh();

  return h('div', {},
    assignCard,
    h('section', { class: 'card join-card' }, qrBox,
      h('div', {}, h('h2', {}, 'Cho học sinh vào lớp'),
        h('p', {}, 'Mã lớp: ', h('b', { class: 'code-tag big' }, cls.code)),
        h('p', {}, 'Học sinh quét mã QR, hoặc mở ', h('b', {}, STUDENT_URL), ' rồi nhập mã lớp.'),
        h('p', { class: 'small' }, h('a', { href: link, target: '_blank', rel: 'noopener' }, link)),
        h('button', { class: 'btn btn-soft', onclick: () => navigator.clipboard?.writeText(link).then(() => { out.className = 'ok-text'; out.textContent = 'Đã chép đường link.'; }) }, '📋 Chép đường link'))),
    h('section', { class: 'card' }, h('h2', {}, 'Cài đặt'),
      h('div', { class: 'row wrap' }, h('label', {}, 'Nhóm: ', group), h('button', { class: 'btn btn-soft', onclick: () => upd({ study_group: group.value || null }, 'Đã lưu nhóm.') }, 'Lưu nhóm')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn btn-soft', onclick: () => upd({ active: !cls.active }, cls.active ? 'Đã khóa lớp: học sinh không đăng nhập mới được.' : 'Đã mở lại lớp.').then(() => renderClass(cls.id)) }, cls.active ? '🔒 Khóa lớp' : '🔓 Mở lại lớp'),
        h('button', { class: 'btn btn-soft danger', onclick: async () => {
          if (prompt(`Xóa hẳn lớp ${cls.name}, toàn bộ học sinh và kết quả luyện tập? Không khôi phục được. Gõ tên lớp để xác nhận:`) !== cls.name) return;
          const { error } = await sb.from('classes').delete().eq('id', cls.id);
          if (error) { out.className = 'warn'; out.textContent = errText(error); return; }
          location.hash = '#/';
        } }, 'Xóa lớp')), out));
}

// ---------- Quản trị (Super Admin / Quản trị trường) ----------
async function renderAdmin() {
  if (profile.role === 'teacher') return renderClasses();
  show('Quản trị', note('muted', 'Đang tải…'));
  const [{ data: schools }, { data: invites, error }, { data: people }] = await Promise.all([
    sb.from('schools').select('id, name, created_at').order('name'),
    sb.from('invites').select('email, role, school_id, created_at').order('created_at', { ascending: false }),
    sb.from('profiles').select('user_id, role, school_id, created_at'),
  ]);
  if (error) return show('Quản trị', note('warn', errText(error)));
  const schoolName = Object.fromEntries((schools || []).map((s) => [s.id, s.name]));
  const out = note('warn', '');

  const email = h('input', { type: 'email', class: 'field', required: true, placeholder: 'email giáo viên', 'aria-label': 'Email' });
  const role = h('select', { class: 'field', 'aria-label': 'Vai trò' }, h('option', { value: 'teacher' }, 'Giáo viên'),
    profile.role === 'super_admin' ? h('option', { value: 'school_admin' }, 'Quản trị trường') : null);
  const school = h('select', { class: 'field', 'aria-label': 'Trường' }, ...(schools || []).map((s) => h('option', { value: s.id, selected: s.id === profile.school_id }, s.name)));
  const invite = h('form', { class: 'row wrap', onsubmit: async (e) => {
    e.preventDefault(); out.textContent = '';
    const sid = profile.role === 'super_admin' ? school.value : profile.school_id;
    const { error: err } = await sb.from('invites').upsert({ email: email.value.trim().toLowerCase(), role: role.value, school_id: sid, invited_by: session.user.id });
    if (err) { out.textContent = errText(err); return; }
    renderAdmin();
  } }, email, role, profile.role === 'super_admin' ? school : null, h('button', { class: 'btn btn-main', type: 'submit' }, 'Mời'));

  const newSchool = h('input', { class: 'field', placeholder: 'Tên trường', 'aria-label': 'Tên trường' });
  show('Quản trị',
    h('section', { class: 'card' }, h('h2', {}, 'Mời giáo viên'),
      h('p', { class: 'muted' }, 'Người được mời vào trang này, nhập đúng email, bấm link trong email là có quyền. Email chưa được mời thì đăng nhập được nhưng không thấy dữ liệu nào.'),
      invite, out,
      h('div', { class: 'table-wrap' }, h('table', { class: 'grid' },
        h('thead', {}, h('tr', {}, ...['Email', 'Vai trò', 'Trường', 'Ngày mời'].map((t) => h('th', {}, t)))),
        h('tbody', {}, ...(invites || []).map((i) => h('tr', {}, h('td', {}, i.email), h('td', {}, ROLE_VI[i.role]), h('td', {}, schoolName[i.school_id] || '—'), h('td', {}, fmtDate(i.created_at)))))))),
    profile.role === 'super_admin' ? h('section', { class: 'card' }, h('h2', {}, 'Trường'),
      h('ul', {}, ...(schools || []).map((s) => h('li', {}, s.name, h('span', { class: 'muted' }, ` · ${(people || []).filter((p) => p.school_id === s.id).length} tài khoản`)))),
      h('div', { class: 'row wrap' }, newSchool, h('button', { class: 'btn btn-soft', onclick: async () => {
        if (!newSchool.value.trim()) return;
        const { error: err } = await sb.rpc('create_school', { p_name: newSchool.value });
        if (err) { out.textContent = errText(err); return; }
        renderAdmin();
      } }, '+ Thêm trường'))) : null);
}

// ---------- Khởi động ----------
function route() {
  const [, page, id] = location.hash.split('/');
  if (!session) return renderSignIn();
  if (!profile) {
    return show('Chưa được cấp quyền',
      h('div', { class: 'card narrow' }, h('p', {}, `Email ${session.user.email} chưa được mời vào SpeakBoost.`),
        h('p', { class: 'muted' }, 'Nhờ Super Admin hoặc quản trị trường mời đúng email này, rồi đăng nhập lại.')));
  }
  if (page === 'class' && id) return renderClass(id).catch((e) => show('Lớp', note('warn', errText(e))));
  if (page === 'admin') return renderAdmin().catch((e) => show('Quản trị', note('warn', errText(e))));
  return renderClasses().catch((e) => show('Lớp học', note('warn', errText(e))));
}

async function start() {
  try {
    if (!sb) {
      const { createClient } = await import(SDK);
      sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'sb-teacher', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
      sb.auth.onAuthStateChange((event, s) => { if (event === 'SIGNED_IN' && !session && s) { session = s; start(); } });
      window.addEventListener('hashchange', () => route());
    }
    const urlErr = new URLSearchParams(location.hash.replace(/^#/, '')).get('error_description');
    const { data } = await sb.auth.getSession();
    session = data.session;
    if (session && session.user.is_anonymous) { await sb.auth.signOut(); session = null; }
    profile = null;
    if (session) {
      const { data: p } = await sb.from('profiles').select('role, school_id').eq('user_id', session.user.id).maybeSingle();
      profile = p;
      if (location.hash.includes('access_token')) history.replaceState(null, '', location.pathname);
    }
    if (!unit) {
      try { const idx = await C.loadIndex(); const e = idx.units.find((u) => u.file); unit = await C.loadUnit(e.file); } catch (_) { unit = null; }
    }
    if (!session && urlErr) return renderSignIn(`Link đăng nhập không dùng được (${urlErr}). Gửi link mới nhé.`);
    route();
  } catch (e) {
    root.replaceChildren(h('div', { class: 'card warn' }, h('h2', {}, 'Chưa mở được trang giáo viên'), h('p', {}, errText(e))));
  }
}

start();
