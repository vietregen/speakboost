// Module giọng nói: nghe mẫu, nhận diện lời nói, ghi âm.
// Mọi xử lý ở đây chạy trên trình duyệt; bản ghi âm KHÔNG được gửi đi đâu.

const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export const support = {
  recognition: Boolean(Recognition),
  synthesis: 'speechSynthesis' in window,
  recorder: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder),
};

let voiceCache = null;
function pickVoice() {
  if (!support.synthesis) return null;
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;
  if (voiceCache && voices.includes(voiceCache)) return voiceCache;
  voiceCache =
    voices.find((v) => v.lang === 'en-GB' && /female|libby|sonia|serena|kate/i.test(v.name)) ||
    voices.find((v) => v.lang === 'en-GB') ||
    voices.find((v) => v.lang && v.lang.startsWith('en')) || null;
  return voiceCache;
}
if (support.synthesis) speechSynthesis.onvoiceschanged = () => { voiceCache = null; pickVoice(); };

let currentAudio = null;
let playToken = 0;
let audioEl = null;
const player = () => (audioEl = audioEl || new Audio());

// Bảng tra câu → tệp âm thanh mẫu (data/audio/unit-NN.json). Không phân biệt hoa thường, khoảng trắng.
let audioMap = new Map();
const keyOf = (t) => String(t || '').trim().replace(/\s+/g, ' ').toLowerCase();
export function setAudioManifest(manifest) {
  audioMap = new Map(Object.entries((manifest && manifest.items) || {}).map(([t, f]) => [keyOf(t), f]));
}
export async function loadAudioManifest(unitNo) {
  try {
    const r = await fetch(`data/audio/unit-${String(unitNo).padStart(2, '0')}.json`, { cache: 'no-cache' });
    if (r.ok) setAudioManifest(await r.json());
  } catch (_) { /* không có tệp âm thanh: dùng giọng máy */ }
}
export const audioFor = (text) => audioMap.get(keyOf(text)) || null;
export const audioCount = () => audioMap.size;

// Phát lần lượt nhiều câu (VD: “Nghe cả bài” hội thoại).
export async function playSequence(texts, opts = {}) {
  stopModel();
  const my = ++playToken;
  for (const t of texts) {
    if (my !== playToken) return;
    await playModel(t, { ...opts, keepToken: true });
    await new Promise((r) => setTimeout(r, 250));
  }
}

// Phát mẫu: ưu tiên tệp âm thanh (của câu hoặc trong bảng tra), nếu chưa có thì dùng giọng máy.
export function playModel(text, { audio = null, rate = 1, keepToken = false } = {}) {
  if (!keepToken) { stopModel(); playToken++; }
  else if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  audio = audio || audioFor(text);
  if (audio) {
    setAudioMode('playback');
    return new Promise((resolve) => {
      // Dùng lại MỘT thẻ audio: iPhone chỉ cho phát tiếp (câu 2, 3… của “Nghe cả bài”) trên thẻ đã được bấm phát.
      const el = player();
      currentAudio = el;
      let settled = false;
      const done = (v) => { if (!settled) { settled = true; el.onended = el.onerror = el.onpause = null; resolve(v); } };
      el.onended = () => done('file');
      el.onpause = () => { if (!el.ended) done('stopped'); };
      el.onerror = () => done(speakTts(text, rate));
      el.src = audio;
      el.preservesPitch = true;
      el.playbackRate = rate;
      el.play().then(() => { el.playbackRate = rate; }).catch(() => done(speakTts(text, rate)));
    });
  }
  return speakTts(text, rate);
}

// iPhone/iPad: sau khi dùng micro, Safari giữ chế độ "gọi điện" nên tiếng phát ra loa nhỏ ở tai nghe.
// Safari 17+ cho chọn chế độ âm thanh: phát mẫu thì dùng "playback" (loa ngoài, to), nghe thì "play-and-record".
function setAudioMode(type) {
  try { if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type; } catch (_) { /* trình duyệt khác: bỏ qua */ }
}

const IS_IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1);

function speakTts(text, rate) {
  if (!support.synthesis) return Promise.resolve('none');
  setAudioMode('playback');
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'en-GB';
    u.rate = IS_IOS ? Math.max(0.5, rate * 0.9) : rate * 0.95;   // giọng iOS đọc nhanh hơn
    u.volume = 1;
    u.onend = () => resolve('tts');
    u.onerror = () => resolve('tts');
    // iOS bị ngắt quãng nếu vừa hủy câu trước đã đọc câu mới ngay: chờ một nhịp.
    const go = () => { if (IS_IOS && speechSynthesis.paused) speechSynthesis.resume(); speechSynthesis.speak(u); };
    if (IS_IOS) setTimeout(go, 120); else go();
  });
}

export function stopModel() {
  playToken++;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  // Chỉ hủy khi đang đọc: trên iOS, gọi cancel() liên tục làm câu sau bị cắt.
  if (support.synthesis && (speechSynthesis.speaking || speechSynthesis.pending)) speechSynthesis.cancel();
}

// Nơi đang mở trang, để chỉ đúng cách bật micro.
export function environment() {
  const ua = navigator.userAgent || '';
  if (/Zalo|FBAN|FBAV|FB_IAB|Instagram|Line\/|TikTok|Messenger/i.test(ua)) return 'in-app';
  if (/\bClaude\/|Electron/i.test(ua)) return 'embedded';
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function micHelp() {
  switch (environment()) {
    case 'in-app':
      return 'Bạn đang mở trang trong Zalo hoặc Facebook, nơi này không cho dùng micro. Bấm nút ⋯ ở góc màn hình, chọn “Mở bằng trình duyệt” (Chrome hoặc Safari) rồi thử lại.';
    case 'embedded':
      return 'Khung trình duyệt này không cho dùng micro. Hãy mở trang bằng Chrome hoặc Edge trên máy tính, hoặc bằng điện thoại.';
    case 'ios':
      return 'Trên iPhone, iPad: bấm nút “aA” ở thanh địa chỉ → Cài đặt trang web → Micrô → Cho phép, rồi tải lại trang. Nếu không thấy, vào ứng dụng Cài đặt → Safari → Micrô → Cho phép. Máy cũng cần bật Đọc chính tả: Cài đặt → Cài đặt chung → Bàn phím → Bật Đọc chính tả.';
    case 'android':
      return 'Trên điện thoại Android (Chrome): bấm biểu tượng nhỏ bên trái địa chỉ trang (hình hai thanh gạt hoặc ổ khóa) → Quyền → Micrô → Cho phép, rồi tải lại trang.';
    default:
      return 'Trên máy tính (Chrome, Edge): bấm biểu tượng nhỏ bên trái địa chỉ trang (hình hai thanh gạt hoặc ổ khóa) → bật Micrô, rồi tải lại trang. Kiểm tra máy đã cắm micro.';
  }
}

const ERROR_VI = {
  'not-allowed': 'MIC_HELP',
  'service-not-allowed': 'Trình duyệt chưa cho phép nhận diện lời nói. Hãy thử Chrome hoặc Edge.',
  'no-speech': 'Máy chưa nghe thấy tiếng. Bạn nói to và rõ hơn một chút nhé.',
  'audio-capture': 'Không tìm thấy micro. Bạn kiểm tra lại micro nhé.',
  network: 'Nhận diện lời nói cần mạng Internet. Bạn kiểm tra kết nối nhé.',
  aborted: 'Đã dừng nghe.',
};

const IOS_NO_SPEECH = 'Máy chưa nghe thấy tiếng. Trên iPhone/iPad cần bật Đọc chính tả: Cài đặt → Cài đặt chung → Bàn phím → bật “Bật Đọc chính tả”, và trong Cài đặt → Safari → Micrô chọn Cho phép. Sau đó tải lại trang, bấm 🎤 rồi nói to, gần máy.';

let activeRec = null;

// Nghe một lượt nói. Trả về { alternatives: [...], error }.
// continuous = true: nghe nhiều câu liền nhau cho tới khi học sinh bấm dừng (dùng cho nói tự do).
export function listen({ lang = 'en-GB', onStart, continuous = false } = {}) {
  if (!Recognition) return Promise.resolve({ alternatives: [], error: 'unsupported' });
  stopModel();
  setAudioMode('play-and-record');
  return new Promise((resolve) => {
    const rec = new Recognition();
    activeRec = rec;
    rec.lang = lang;
    // iPhone/iPad (Safari) hay không trả kết quả "cuối cùng" mà chỉ có kết quả tạm thời,
    // nên luôn nghe cả kết quả tạm và dùng nó khi máy dừng mà chưa có kết quả cuối.
    rec.interimResults = true;
    rec.continuous = continuous;
    rec.maxAlternatives = 5;
    let done = false;
    const pieces = [];       // các câu đã chốt (nói tự do)
    let interim = [];        // kết quả tạm mới nhất
    const finish = (res) => {
      if (done) return;
      done = true; activeRec = null; clearTimeout(silenceTimer);
      setAudioMode('playback');
      resolve(res);
    };
    let silenceTimer = null;
    // Safari đôi khi không tự dừng: im lặng 2,5 giây sau khi đã nghe được chữ thì tự chốt (trừ khi nói tự do).
    const armSilence = () => { if (continuous) return; clearTimeout(silenceTimer); silenceTimer = setTimeout(() => { try { rec.stop(); } catch (_) { /* bỏ qua */ } }, 2500); };
    rec.onstart = () => onStart && onStart();
    rec.onresult = (e) => {
      const cur = [];
      let sawFinal = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) {
          sawFinal = true;
          if (continuous) { if (r[0].transcript) pieces.push(r[0].transcript.trim()); continue; }
          const alternatives = [];
          for (let j = 0; j < r.length; j++) if (r[j].transcript) alternatives.push(r[j].transcript.trim());
          if (alternatives.length) return finish({ alternatives, error: null });
        } else if (r[0] && r[0].transcript) cur.push(r[0].transcript.trim());
      }
      if (cur.length) { interim = [cur.join(' ')]; armSilence(); } else if (sawFinal) interim = [];
    };
    rec.onerror = (e) => {
      if ((pieces.length || interim.length) && e.error !== 'not-allowed') return;   // vẫn có chữ: để onend chốt
      const msg = ERROR_VI[e.error] === 'MIC_HELP' ? micHelp() : ERROR_VI[e.error];
      finish({ alternatives: [], error: e.error, message: msg || 'Có lỗi khi nghe, bạn thử lại nhé.' });
    };
    rec.onend = () => {
      if (pieces.length) finish({ alternatives: [[...pieces, ...interim].join(' ')], error: null });
      else if (interim.length) finish({ alternatives: interim, error: null });
      else finish({ alternatives: [], error: 'no-speech', message: environment() === 'ios' ? IOS_NO_SPEECH : ERROR_VI['no-speech'] });
    };
    try { rec.start(); } catch (err) { finish({ alternatives: [], error: 'start-failed', message: 'Chưa bắt đầu nghe được, bạn bấm lại nhé.' }); }
  });
}

export function stopListening() { if (activeRec) activeRec.stop(); }

// Ghi âm để học sinh tự nghe lại. Bản ghi chỉ nằm trong bộ nhớ trang và mất khi đóng trang.
export class Recorder {
  constructor(maxSeconds = 15) { this.max = maxSeconds; this.url = null; this.rec = null; this.timer = null; }
  get recording() { return Boolean(this.rec && this.rec.state === 'recording'); }

  async start() {
    if (!support.recorder) throw new Error('Trình duyệt này chưa hỗ trợ ghi âm.');
    stopModel();
    setAudioMode('play-and-record');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = [];
    this.rec = new MediaRecorder(stream);
    this.rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    this.stopped = new Promise((resolve) => {
      this.rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        clearTimeout(this.timer);
        if (this.url) URL.revokeObjectURL(this.url);
        this.url = URL.createObjectURL(new Blob(chunks, { type: this.rec.mimeType || 'audio/webm' }));
        resolve(this.url);
      };
    });
    this.rec.start();
    this.timer = setTimeout(() => this.stop(), this.max * 1000);
  }

  stop() { if (this.recording) this.rec.stop(); return this.stopped; }

  play() { if (this.url) { stopModel(); setAudioMode('playback'); currentAudio = new Audio(this.url); return currentAudio.play(); } }

  dispose() { if (this.recording) this.rec.stop(); if (this.url) URL.revokeObjectURL(this.url); this.url = null; }
}
