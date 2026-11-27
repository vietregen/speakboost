// Kết nối máy chủ cho HỌC SINH: đăng nhập bằng mã lớp + PIN (không email), gửi lượt luyện lên lớp.
// Không gửi giọng nói. Chỉ gửi: hoạt động, mục, mức, số sao, nguồn đánh giá, chi tiết ngắn.
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import * as P from './progress.js';

const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
const OUTBOX = 'sb.outbox.v1';
const GUEST = 'sb.guest';

// Tên hoạt động trong ứng dụng → tên lưu ở máy chủ.
const ACTIVITY = { vocabulary: 'vocab', patterns: 'pattern', dialogues: 'dialogue', roleplays: 'roleplay', picture_tasks: 'picture', challenge: 'challenge' };
const ACTIVITY_BACK = Object.fromEntries(Object.entries(ACTIVITY).map(([k, v]) => [v, k]));

let client = null;
let me = null;

export const configured = () => Boolean(SUPABASE_URL && SUPABASE_KEY);
export const student = () => me;

function withTimeout(promise, ms, msg) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

async function sb() {
  if (client) return client;
  const { createClient } = await withTimeout(import(SDK), 15000, 'offline');
  // Kho phiên riêng cho học sinh, để không lẫn với phiên giáo viên trên cùng trình duyệt.
  client = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { storageKey: 'sb-student', persistSession: true, autoRefreshToken: true } });
  return client;
}

export function isGuest() { try { return localStorage.getItem(GUEST) === '1'; } catch (_) { return false; } }
export function setGuest(on) { try { on ? localStorage.setItem(GUEST, '1') : localStorage.removeItem(GUEST); } catch (_) { /* bỏ qua */ } }

async function ensureSession() {
  const c = await sb();
  const { data } = await c.auth.getSession();
  if (data.session) return data.session;
  const { data: d, error } = await c.auth.signInAnonymously();
  if (error) throw error;
  return d.session;
}

// Học sinh đã đăng nhập lớp trên máy này chưa? Trả về hồ sơ hoặc null.
export async function restore() {
  const c = await sb();
  const { data } = await c.auth.getSession();
  if (!data.session) return null;
  const { data: info, error } = await c.rpc('student_me');
  if (error || !info) return null;
  return activate(info);
}

async function activate(info) {
  me = info;
  P.useStudent(`${info.class_id}.${info.roster_no}`);   // sổ tiến độ riêng của học sinh này trên máy
  flush();
  pull();
  return me;
}

export async function roster(code) {
  await ensureSession();
  const { data, error } = await (await sb()).rpc('class_roster', { p_code: code });
  if (error) throw error;
  return data || [];
}

const JOIN_ERR = {
  wrong_code: 'Không tìm thấy lớp có mã này. Bạn kiểm tra lại mã lớp nhé.',
  wrong_student: 'Không tìm thấy bạn trong lớp này.',
  locked: 'Bạn nhập sai PIN nhiều lần. Chờ 10 phút hoặc nhờ thầy cô đặt lại PIN nhé.',
  wrong_pin: 'PIN chưa đúng. Bạn thử lại nhé.',
};

export async function join(code, rosterNo, pin) {
  await ensureSession();
  const { data, error } = await (await sb()).rpc('student_join', { p_code: code, p_roster: rosterNo, p_pin: pin });
  if (error) {
    const key = Object.keys(JOIN_ERR).find((k) => (error.message || '').includes(k));
    throw new Error(key ? JOIN_ERR[key] : 'Chưa kết nối được máy chủ. Bạn thử lại nhé.');
  }
  if (!data.ok) throw new Error(JOIN_ERR[data.error] || 'PIN chưa đúng.');
  setGuest(false);
  const info = await (await sb()).rpc('student_me');
  return activate(info.data);
}

// "Đổi bạn": gửi nốt kết quả còn chờ, gỡ học sinh khỏi máy nhưng GIỮ phiên của máy.
// Bạn tiếp theo đăng nhập trên cùng phiên → không tạo phiên mới, không tốn giới hạn đăng nhập theo giờ.
export async function signOut() {
  await flush();
  me = null;
  P.useStudent(null);
  try {
    const { error } = await (await sb()).rpc('student_leave');
    if (error) await (await sb()).auth.signOut();   // máy chủ chưa có hàm mới: đăng xuất hẳn cho an toàn
  } catch (_) {
    try { await (await sb()).auth.signOut({ scope: 'local' }); } catch (__) { /* bỏ qua */ }
  }
}

// ---------- Gửi lượt luyện (có hàng chờ khi mất mạng) ----------
function readBox() { try { return JSON.parse(localStorage.getItem(OUTBOX) || '[]'); } catch (_) { return []; } }
function writeBox(list) { try { localStorage.setItem(OUTBOX, JSON.stringify(list.slice(-500))); } catch (_) { /* bỏ qua */ } }

P.onRecord((a) => {
  if (!me) return;
  writeBox([...readBox(), { ...a, owner: `${me.class_id}.${me.roster_no}` }]);
  flush();
});

let flushing = false;
export async function flush() {
  if (!me || flushing) return;
  flushing = true;
  try {
    const owner = `${me.class_id}.${me.roster_no}`;
    const c = await sb();
    let box = readBox();
    for (const a of box.filter((x) => x.owner === owner)) {
      const { error } = await c.rpc('record_attempt', {
        p_unit: a.unit, p_activity: ACTIVITY[a.activity] || a.activity, p_item: a.item, p_level: a.level,
        p_source: a.source, p_stars: a.stars, p_detail: a.detail || '',
      });
      if (error) break;                       // mất mạng: để lần sau gửi tiếp
      box = readBox().filter((x) => !(x.owner === owner && x.t === a.t && x.item === a.item));
      writeBox(box);
    }
  } catch (_) { /* thử lại lần sau */ } finally { flushing = false; }
}
window.addEventListener('online', () => flush());

// Lấy tiến độ đã lưu ở máy chủ (khi học sinh đổi máy).
async function pull() {
  try {
    const { data, error } = await (await sb()).from('attempts')
      .select('unit, activity, item_id, level, source, stars, detail, created_at')
      .order('created_at', { ascending: true }).limit(2000);
    if (error || !data) return;
    P.mergeServer(data.map((r) => ({ t: r.created_at, unit: r.unit, activity: ACTIVITY_BACK[r.activity] || r.activity, item: r.item_id, level: r.level, source: r.source, stars: r.stars, detail: r.detail || '' })));
    window.dispatchEvent(new Event('sb-progress'));
  } catch (_) { /* bỏ qua */ }
}
