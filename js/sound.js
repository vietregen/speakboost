// Âm thanh cho trang học sinh, tạo trực tiếp bằng Web Audio (không cần tệp nhạc, không có bản quyền).
//  - Nhạc nền nhẹ, du dương (hộp nhạc + nền êm): chỉ phát ở trang chính và màn đăng nhập.
//    Vào bài học / thử thách là tắt hẳn để không lẫn vào micro.
//  - Tiếng hiệu ứng khi đọc đúng, khớp với từng kiểu biến mất trong vanish.js.
//  - Một nút 🔊 / 🔇 trên trang chính tắt / bật toàn bộ âm thanh; lựa chọn lưu trên máy.
// Trình duyệt chỉ cho phát âm thanh sau lần chạm / bấm đầu tiên, nên nhạc bắt đầu từ lúc đó.

const AC = window.AudioContext || window.webkitAudioContext;
let ctx = null, master = null, musicBus = null, sfxBus = null, reverb = null;
let noiseBuf = null;

const KEY = 'sb.sound';
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (_) { /* bỏ qua */ }

export const supported = Boolean(AC);
export const isEnabled = () => enabled;

function ensure() {
  if (!AC) return null;
  if (ctx) return ctx;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
  // Vang nhẹ: tiếng vọng tạo từ nhiễu tắt dần.
  reverb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 2.6);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  reverb.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.35; reverb.connect(wet); wet.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master); musicBus.connect(reverb);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  const sfxWet = ctx.createGain(); sfxWet.gain.value = 0.25; sfxBus.connect(sfxWet); sfxWet.connect(reverb);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  return ctx;
}

// Lần chạm / bấm đầu tiên: mở khóa âm thanh rồi phát nhạc nếu đang ở trang được phép.
let unlocked = false;
function unlock() {
  if (unlocked || !AC) return;
  ensure();
  if (ctx.state === 'suspended') ctx.resume();
  unlocked = true;
  if (wantMusic && enabled) startMusic();
}
for (const ev of ['pointerdown', 'keydown', 'touchend']) window.addEventListener(ev, unlock, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else if (unlocked) ctx.resume();
});

// ---------------- Nhạc nền ----------------
// Vòng hòa âm êm (Fa trưởng): Fmaj7 – Dm7 – B♭maj7 – C, mỗi hợp âm 8 nốt rải, nhịp chậm.
const CHORDS = [[53, 57, 60, 64], [50, 53, 57, 60], [46, 50, 53, 57], [48, 52, 55, 62]];
const ARP = [0, 1, 2, 3, 4, 3, 2, 1];
const MELODY = [72, 74, 76, 77, 79, 81, 84];   // ngũ cung phía trên, thỉnh thoảng điểm một nốt
const STEP = 60 / 66 / 2;                       // nốt móc đơn ở 66 nhịp/phút
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

let wantMusic = false, playing = false, timer = null, nextTime = 0, step = 0;

function bell(t, freq, gain, dur = 1.8) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = freq;
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2.01;
  const g2 = ctx.createGain(); g2.gain.value = 0.18;
  o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(musicBus);
  o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function pad(t, notes, dur) {
  for (const m of notes) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.022, t + 1.4);
    g.gain.setValueAtTime(0.022, t + dur - 1.2);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.6);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = hz(m - 12);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    o.connect(lp); lp.connect(g); g.connect(musicBus);
    o.start(t); o.stop(t + dur + 0.7);
  }
}
function schedule() {
  while (nextTime < ctx.currentTime + 0.4) {
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const i = step % 8;
    if (i === 0) pad(nextTime, chord, STEP * 8);
    const k = ARP[i];
    const m = k < 4 ? chord[k] + 12 : chord[0] + 24;
    bell(nextTime, hz(m), i === 0 ? 0.075 : 0.05);
    if ((i === 0 || i === 4) && Math.random() < 0.35) bell(nextTime + STEP * 0.5, hz(MELODY[Math.floor(Math.random() * MELODY.length)]), 0.035, 2.4);
    nextTime += STEP;
    step++;
  }
}
function startMusic() {
  if (!ensure() || playing || !unlocked) return;
  playing = true;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(musicBus.gain.value, t);
  musicBus.gain.linearRampToValueAtTime(0.9, t + 2.5);   // vào nhạc từ từ
  nextTime = t + 0.1;
  schedule();
  timer = setInterval(schedule, 120);
}
function stopMusic(fast = false) {
  if (!ctx || !playing) return;
  playing = false;
  clearInterval(timer); timer = null;
  const t = ctx.currentTime;
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(musicBus.gain.value, t);
  musicBus.gain.linearRampToValueAtTime(0, t + (fast ? 0.15 : 0.8));
}

/** Trang hiện tại có muốn nhạc nền không (trang chính, đăng nhập: có; bài học, thử thách: không). */
export function music(want) {
  wantMusic = Boolean(want);
  if (wantMusic && enabled && unlocked) startMusic();
  else stopMusic(!wantMusic);
}

/** Tắt / bật toàn bộ âm thanh (nhạc + hiệu ứng). */
export function setEnabled(on) {
  enabled = Boolean(on);
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (_) { /* bỏ qua */ }
  if (enabled) { unlock(); if (wantMusic) startMusic(); } else stopMusic(true);
}

// ---------------- Tiếng hiệu ứng ----------------
function noise(t, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.3, attack = 0.005, freqTo = null } = {}) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function tone(t, dur, { type = 'sine', freq = 440, freqTo = null, gain = 0.25, attack = 0.005 } = {}) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (freqTo) o.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
const rnd = (a, b) => a + Math.random() * (b - a);

const EFFECTS = {
  // Vò giấy sột soạt rồi "phụt" thành khói
  crumple(t) {
    for (let i = 0; i < 22; i++) noise(t + rnd(0, 0.55), rnd(0.01, 0.04), { freq: rnd(1800, 5000), q: 2, gain: rnd(0.15, 0.4) });
    noise(t + 0.65, 0.6, { type: 'lowpass', freq: 1400, freqTo: 200, gain: 0.45, attack: 0.03 });
  },
  // Bùng lửa "phừng" và tiếng lách tách
  fire(t) {
    noise(t, 0.7, { freq: 250, freqTo: 1600, q: 0.8, gain: 0.4, attack: 0.08 });
    noise(t, 1.4, { type: 'lowpass', freq: 300, gain: 0.25, attack: 0.1 });
    for (let i = 0; i < 16; i++) noise(t + rnd(0.15, 1.4), rnd(0.008, 0.02), { type: 'highpass', freq: rnd(2500, 6000), gain: rnd(0.15, 0.35) });
  },
  // Con vật chạy lạch bạch rồi "vèo" mất
  run(t) {
    for (let i = 0; i < 8; i++) {
      const s = t + i * (0.11 - i * 0.006);
      tone(s, 0.06, { freq: i % 2 ? 210 : 170, freqTo: 90, gain: 0.3 });
      noise(s, 0.02, { freq: 3000, gain: 0.08 });
    }
    tone(t + 0.55, 0.45, { type: 'triangle', freq: 1200, freqTo: 260, gain: 0.12 });
  },
  // Đập cánh phành phạch rồi bay vút lên
  fly(t) {
    for (let i = 0; i < 7; i++) noise(t + 0.3 + i * 0.12, 0.09, { type: 'lowpass', freq: 900, gain: 0.35, attack: 0.02 });
    tone(t + 0.35, 1.1, { freq: 520, freqTo: 1500, gain: 0.08, attack: 0.15 });
  },
  // Bụi sao: chuông nhỏ leng keng lấp lánh
  sparkle(t) {
    const notes = [84, 88, 91, 93, 96, 100, 103, 98];
    notes.forEach((m, i) => { const at = t + i * 0.07 + rnd(0, 0.02); tone(at, 0.9, { freq: hz(m), gain: 0.09 }); tone(at, 0.6, { freq: hz(m) * 2.01, gain: 0.03 }); });
    noise(t, 1.0, { type: 'highpass', freq: 7000, gain: 0.05, attack: 0.2 });
  },
  // Bong bóng "bloop" bay lên rồi "bốp" vỡ
  bubble(t) {
    [0, 0.16, 0.3].forEach((d, i) => tone(t + d, 0.12, { freq: 260 + i * 80, freqTo: 900 + i * 200, gain: 0.22 }));
    for (let i = 0; i < 4; i++) {
      const at = t + 1.15 + i * rnd(0.04, 0.09);
      tone(at, 0.03, { freq: rnd(1400, 2200), freqTo: 3000, gain: 0.2, attack: 0.002 });
      noise(at, 0.015, { freq: 4000, gain: 0.15 });
    }
  },
  fade(t) { tone(t, 0.5, { freq: hz(84), gain: 0.08 }); tone(t + 0.08, 0.5, { freq: hz(91), gain: 0.06 }); },
};

/** Phát tiếng cho một kiểu hiệu ứng biến mất (crumple, fire, run, fly, sparkle, bubble). */
export function effect(kind) {
  if (!enabled || !AC) return;
  unlock();
  if (!ctx || ctx.state !== 'running') return;
  try { (EFFECTS[kind] || EFFECTS.sparkle)(ctx.currentTime + 0.02); } catch (_) { /* âm thanh chỉ để trang trí */ }
}

/** Trạng thái hiện tại (dùng khi kiểm tra). */
export const state = () => ({ enabled, unlocked, playing, wantMusic, ctx: ctx ? ctx.state : 'none' });
