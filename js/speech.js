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

// Phát mẫu: ưu tiên tệp âm thanh giáo viên đã duyệt, nếu chưa có thì dùng giọng máy.
export function playModel(text, { audio = null, rate = 1 } = {}) {
  stopModel();
  if (audio) {
    return new Promise((resolve) => {
      currentAudio = new Audio(audio);
      currentAudio.playbackRate = rate;
      currentAudio.onended = () => resolve('file');
      currentAudio.onerror = () => resolve(speakTts(text, rate));
      currentAudio.play().catch(() => resolve(speakTts(text, rate)));
    });
  }
  return speakTts(text, rate);
}

function speakTts(text, rate) {
  if (!support.synthesis) return Promise.resolve('none');
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v ? v.lang : 'en-GB';
    u.rate = rate * 0.95;
    u.onend = () => resolve('tts');
    u.onerror = () => resolve('tts');
    speechSynthesis.speak(u);
  });
}

export function stopModel() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if (support.synthesis) speechSynthesis.cancel();
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
      return 'Trên iPhone, iPad: bấm nút “aA” ở thanh địa chỉ → Cài đặt trang web → Micrô → Cho phép, rồi tải lại trang. Nếu không thấy, vào ứng dụng Cài đặt → Safari → Micrô → Cho phép.';
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

let activeRec = null;

// Nghe một lượt nói. Trả về { alternatives: [...], error }.
// continuous = true: nghe nhiều câu liền nhau cho tới khi học sinh bấm dừng (dùng cho nói tự do).
export function listen({ lang = 'en-GB', onStart, continuous = false } = {}) {
  if (!Recognition) return Promise.resolve({ alternatives: [], error: 'unsupported' });
  stopModel();
  return new Promise((resolve) => {
    const rec = new Recognition();
    activeRec = rec;
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = continuous;
    rec.maxAlternatives = 5;
    let done = false;
    const pieces = [];
    const finish = (res) => { if (!done) { done = true; activeRec = null; resolve(res); } };
    rec.onstart = () => onStart && onStart();
    rec.onresult = (e) => {
      if (continuous) {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal && e.results[i][0].transcript) pieces.push(e.results[i][0].transcript.trim());
        }
        return;
      }
      const r = e.results[0];
      const alternatives = [];
      for (let i = 0; i < r.length; i++) if (r[i].transcript) alternatives.push(r[i].transcript.trim());
      finish({ alternatives, error: null });
    };
    rec.onerror = (e) => {
      if (continuous && pieces.length && e.error !== 'not-allowed') return;
      const msg = ERROR_VI[e.error] === 'MIC_HELP' ? micHelp() : ERROR_VI[e.error];
      finish({ alternatives: [], error: e.error, message: msg || 'Có lỗi khi nghe, bạn thử lại nhé.' });
    };
    rec.onend = () => {
      if (pieces.length) finish({ alternatives: [pieces.join(' ')], error: null });
      else finish({ alternatives: [], error: 'no-speech', message: ERROR_VI['no-speech'] });
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

  play() { if (this.url) { stopModel(); currentAudio = new Audio(this.url); return currentAudio.play(); } }

  dispose() { if (this.recording) this.rec.stop(); if (this.url) URL.revokeObjectURL(this.url); this.url = null; }
}
