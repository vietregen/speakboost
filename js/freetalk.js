// Chấm câu trả lời TỰ DO trong phần Đóng vai và Thử thách Chương 2.
// Học sinh được trả lời theo ý mình, không cần giống câu gợi ý. Máy ghi nhận câu nói được
// và nhận xét theo đúng câu đó: đủ câu chưa, có nói thêm ý không, có trả lời đúng câu hỏi không.
// Không dùng AI: máy nhận ra LOẠI câu hỏi (Where → nơi chốn, When → thời gian, How many → số lượng…)
// rồi xem câu trả lời có đúng loại đó không, và có dùng từ liên quan (câu hỏi, gợi ý, từ vựng của Unit) không.
// "Sao" vẫn là mức máy nhận diện được câu trả lời, KHÔNG phải điểm phát âm hay điểm ngữ pháp.
// Chạy hoàn toàn trên máy, không gửi lời nói đi đâu.
import { normalize } from './match.js';

const set = (s) => new Set(s.split(' '));
const STOP = set('a an the is am are was were be to of in on at for and or but so do does did you your i me my we our it its this that these those '
  + 'what whats where when who why how which can could will would have has had there here with about please yes no not some any very '
  + 'every day days time times thing things usually often sometimes always never also too really just well much many lot lots one');
const VERBS = set('am is are was were be been have has had do does did can could will would should shall like likes love loves enjoy enjoys want wants go goes went '
  + 'play plays played study studies studied learn learns read reads live lives get gets got make makes made take takes took need needs think '
  + 'know see sit sits walk walks ride rides come comes came eat eats drink help helps use uses wear wears borrow lend give call called name '
  + 'prefer prefers visit visits buy bought hope feel feels look looks find watch watches speak speaks talk say draw paint swim dance sing cook '
  + 'connect connects meet meets recommend show shows ask asks listen listens turn keep keeps cannot let');
const LINKERS = ['because', 'and', 'but', 'so', 'also', 'when', 'after', 'before', 'then', 'or'];
const PLAIN = set('yes no hi hello okay ok yeah sure');
const POLITE = ['thank', 'thanks', 'please', 'nice to meet', 'sorry', 'excuse me', 'you are welcome', 'see you', 'goodbye', 'bye'];
const YESNO_Q = /^(do|does|did|are|is|was|were|can|could|will|would|have|has|shall|may|should)\b/;

// Từ chung hay gặp ở THCS (ngoài từ vựng của Unit), giúp nhận ra câu trả lời có liên quan.
const COMMON = set('art maths math literature geography biology chemistry physics informatics technology vietnamese english history music science pe '
  + 'football badminton volleyball basketball chess games game books book drawing painting singing dancing swimming reading cycling homework '
  + 'friend friends family teacher classmate classmates school class lesson lessons subject subjects');

// Từ cho từng loại câu hỏi.
const NUM = set('one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty '
  + 'thirty forty fifty sixty seventy eighty ninety hundred thousand half lot lots few several dozen first second third');
const TIME = set('monday tuesday wednesday thursday friday saturday sunday morning afternoon evening night noon midnight today tomorrow yesterday '
  + 'weekend weekends week day days month year oclock clock am pm time early late after before every always usually often sometimes never '
  + 'january february march april may june july august september october november december spring summer autumn winter tet holiday holidays now');
const FREQ = set('always usually often sometimes rarely seldom never every once twice times daily weekly monthly day week month');
const PLACE = set('in at on near next opposite behind between under above from to there here inside outside around beside '
  + 'school home house flat park market street road city town village country countryside suburbs room class classroom library playground garden '
  + 'canteen gym lab hall museum temple pagoda church cinema hospital station bank shop shops store supermarket restaurant cafe zoo beach mountain '
  + 'mountains river lake square centre center office building floor area neighbourhood communal stadium theatre bakery pharmacy post');
const PEOPLE = set('mother mom mum father dad parents brother sister grandparents grandmother grandma grandfather grandpa family friend friends '
  + 'teacher teachers classmate classmates elders elder people students student he she they mr mrs ms miss uncle aunt cousin everyone doctor members guide');
const DIRECTION = set('go turn left right straight take walk bus bike cross along past corner map follow first second street road');
// Động từ KHÔNG chỉ hoạt động (dùng cho câu hỏi "What do you do…?").
const BE_DO = set('am is are was were be been have has had can could will would should shall cannot let like likes love loves want wants need needs hope think know feel feels');
const LIKE = set('like likes love loves favourite enjoy prefer best is are');

// Loại câu hỏi: nhận ra từ câu hỏi, và câu trả lời thế nào thì "đúng loại".
const any = (S) => (w) => w.some((x) => S.has(x) || /^\d/.test(x));
const QTYPES = [
  { id: 'name', re: /\byour name\b|\bwho are you\b/, vi: 'hỏi tên', fit: (w, hay) => /\b(name|i am|call me|it is)\b/.test(hay) || w.length <= 2,
    tip: 'Câu hỏi về tên: thử “My name is …” hoặc “I am …”.' },
  { id: 'often', re: /\bhow often\b/, vi: 'hỏi mức độ thường xuyên', fit: any(FREQ), tip: 'Câu hỏi How often: dùng always / usually / often / sometimes / every day…' },
  { id: 'number', re: /\bhow (many|much|old)\b/, vi: 'hỏi số lượng', fit: any(NUM), tip: 'Câu hỏi How many / How much / How old: nhớ nói một con số (two, ten, a lot…).' },
  { id: 'time', re: /^when\b|\bwhat time\b/, vi: 'hỏi thời gian', fit: any(TIME), tip: 'Câu hỏi When / What time: nói thời gian (on Monday, at seven, in the morning…).' },
  { id: 'direction', re: /\bhow (can|do|should) (i|we) (get|go)\b/, vi: 'hỏi đường', fit: any(DIRECTION), tip: 'Câu hỏi đường đi: dùng Go straight / Turn left / Take the bus…' },
  { id: 'where', re: /\bwhere\b/, vi: 'hỏi nơi chốn', fit: any(PLACE), tip: 'Câu hỏi Where: nói một nơi chốn (in the city, near the park, at school…).' },
  { id: 'who', re: /^who\b/, vi: 'hỏi về người', fit: any(PEOPLE), tip: 'Câu hỏi Who: nói về một người (my friend, my teacher, my family…).' },
  { id: 'activity', re: /\bwhat (do|does|did) (you|they|he|she|people) (usually |often |sometimes )?(do|like to do)\b/, vi: 'hỏi về hoạt động',
    fit: (w) => w.some((x) => VERBS.has(x) && !BE_DO.has(x)), tip: 'Câu hỏi What do you do…: nói một hoạt động (I play…, I read…, I go to…).' },
  { id: 'describe', re: /^what (is|are|was|were) [a-z ]+ like$/, vi: 'hỏi miêu tả', fit: (w, hay) => /^(yes |no )?(it|they) (is|are|was|were)\b/.test(hay),
    tip: 'Câu hỏi What is … like?: miêu tả bằng It is + tính từ (It is quiet, It is big…).' },
  { id: 'like', re: /\bfavourite\b|\blike best\b|\bprefer\b/, vi: 'hỏi điều bạn thích', fit: any(LIKE), tip: 'Câu hỏi về sở thích: thử “I like … best” hoặc “My favourite … is …”.' },
];

const words = (s) => (s ? s.split(' ') : []);
const has = (hay, phrase) => { const p = normalize(phrase); return p && (` ${hay} `).includes(` ${p} `); };
const contentWords = (text) => words(normalize(text)).filter((w) => w.length > 2 && !STOP.has(w));
const stem = (w) => (w.length > 4 ? w.replace(/ies$/, 'y').replace(/(ing|ed|es|s)$/, '') : w);

// Từ vựng của Unit đang học (app.js đặt khi mở bài).
let unitWords = new Set();
export function setTopicWords(list) {
  unitWords = new Set((list || []).flatMap((x) => words(normalize(x))).filter((w) => w.length > 2 && !STOP.has(w)).map(stem));
}

function overlap(a, b) {
  const A = words(normalize(a)); const B = new Set(words(normalize(b)));
  return A.length ? A.filter((w) => B.has(w)).length / A.length : 0;
}

// Câu cuối cùng của lượt nói của máy (VD "Hi! I'm Alex. What's your name?" → "What's your name?").
function lastSentence(text) {
  const parts = String(text || '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

/** Phân tích một phương án nhận diện. turn: { bot, expect_any, hint } */
export function analyse(turn, heard) {
  const hay = normalize(heard);
  const w = words(hay);
  const n = w.length;
  const qRaw = lastSentence(turn.bot);
  const q = normalize(qRaw);
  const isQuestion = /\?\s*$/.test(qRaw);
  const choiceQ = isQuestion && /\bor\b/.test(q);
  const yesNoQ = isQuestion && !choiceQ && YESNO_Q.test(q);
  const qtype = isQuestion && !yesNoQ ? QTYPES.find((t) => t.re.test(q)) || null : null;

  const topic = [...(turn.expect_any || []), ...contentWords(turn.bot), ...contentWords(turn.hint)];
  const usedTopic = [...new Set(topic.filter((t) => !PLAIN.has(normalize(t)) && !VERBS.has(normalize(t)) && has(hay, t)))];
  const topicStems = new Set(topic.flatMap((t) => words(normalize(t))).filter((x) => !PLAIN.has(x)).map(stem));
  // Chỉ tính danh từ / tính từ: động từ chung (like, go, have…) không cho biết câu trả lời đúng chủ đề.
  const linked = w.filter((x) => x.length > 2 && !STOP.has(x) && !VERBS.has(x) && (topicStems.has(stem(x)) || unitWords.has(stem(x))));
  const linkedCommon = w.filter((x) => COMMON.has(x));   // chỉ dùng cho câu hỏi sở thích (môn học, trò chơi…)
  // Câu đầy đủ: từ 3 từ trở lên và có động từ (câu có chủ ngữ "The park is…", hoặc câu mệnh lệnh "Go straight…").
  const sentence = n >= 3 && w.some((x) => VERBS.has(x) || (/ed$/.test(x) && x.length > 3));
  const linkers = LINKERS.filter((l) => w.includes(l) && !(l === 'and' && n < 5));
  const polite = POLITE.filter((p) => has(hay, p));
  const startsYesNo = /^(yes|no|yeah|sure|of course|not really|ok|okay)\b/.test(hay);
  const qWords = new Set(words(q));
  const echo = n >= 3 && overlap(q, hay) >= 0.75 && !w.some((x) => !qWords.has(x) && !STOP.has(x));   // nhắc lại câu hỏi, không thêm ý mới
  const copied = Boolean(turn.hint) && n >= 3 && overlap(turn.hint, hay) >= 0.9;  // đọc đúng câu gợi ý
  const fits = qtype ? qtype.fit(w, hay) : true;
  const related = linked.length > 0 || usedTopic.length > 0 || (yesNoQ && startsYesNo) || polite.length > 0
    || topic.some((t) => PLAIN.has(normalize(t)) && has(hay, t));
  return { heard, n, sentence, linkers, polite, usedTopic, linked, linkedCommon, yesNoQ, choiceQ, isQuestion, qtype, fits, startsYesNo, echo, copied, related };
}

// "Trả lời đúng câu hỏi" (on-topic):
// - Câu hỏi có loại rõ (Where, When, How many, Who…): câu trả lời phải đúng loại đó.
// - Câu hỏi Yes/No, câu hỏi lựa chọn (… or …) và câu hỏi What/How chung: phải có Yes/No hoặc từ liên quan
//   (từ trong câu hỏi, câu gợi ý, từ chấp nhận, từ vựng của Unit).
// - Câu máy nói không phải câu hỏi (VD "Have a nice day!"): đáp lại lịch sự là đủ.
function onTopic(a) {
  if (!a.isQuestion) return a.related;   // máy chào / chúc: đáp lại lịch sự hoặc đúng chủ đề
  if (a.qtype && a.qtype.id === 'like') return a.fits && (a.related || a.linkedCommon.length > 0);   // sở thích: phải nói thích CÁI GÌ
  if (a.qtype && a.qtype.id === 'describe') return a.fits || a.related;   // "It is…" hoặc nhắc đúng thứ được hỏi
  if (a.qtype) return a.fits;
  return a.related;
}

function score(a) {
  if (!a.n) return 0;
  if (a.echo) return 1;
  const ok = onTopic(a);
  if (a.sentence || (a.polite.length && !a.isQuestion)) return ok ? 3 : 2;
  // Cụm từ / câu ngắn: được ghi nhận (2 sao) nếu đúng ý; lạc đề thì 1 sao.
  return ok ? 2 : 1;
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const quote = (list) => list.slice(0, 3).map((x) => `“${x}”`).join(', ');

/**
 * Chấm câu trả lời tự do. Trả về { stars, title, notes[], tip, heard, sentence, related, detail }.
 * level: 1–3 (mức càng cao, lời khuyên càng hướng tới nói dài và có lý do).
 */
export function evaluate(turn, alternatives, level = 1) {
  let best = null;
  for (const alt of alternatives || []) {
    const a = analyse(turn, alt);
    const s = score(a);
    const rank = s * 100 + a.linkers.length * 10 + a.usedTopic.length + Math.min(a.n, 9) / 10;
    if (!best || rank > best.rank) best = { a, s, rank };
  }
  if (!best || !best.a.n) {
    return { stars: 0, heard: '', title: 'Máy chưa nghe được bạn nói gì. Bạn bấm 🎤 rồi nói to, rõ hơn nhé.', notes: [], tip: '', detail: 'tu_do;so_tu=0' };
  }
  const { a, s } = best;
  const ok = onTopic(a);
  const notes = [];
  let title;
  let tip = '';
  const offTip = () => (a.qtype ? a.qtype.tip
    : a.yesNoQ ? 'Đây là câu hỏi Yes/No: bắt đầu bằng “Yes, …” hoặc “No, …” rồi nói thêm một câu nhé.'
    : a.choiceQ ? 'Đây là câu hỏi lựa chọn: hãy chọn một trong các ý bạn ấy nêu ra.'
    : 'Bạn nghe lại câu hỏi rồi trả lời đúng điều bạn ấy hỏi nhé.');

  if (a.echo) {
    title = 'Có vẻ bạn đang nhắc lại câu hỏi. Hãy trả lời theo ý của bạn nhé!';
    tip = turn.hint ? `Bạn có thể bắt đầu như: “${turn.hint}”` : '';
  } else if (!ok) {
    title = a.qtype ? `Máy nghe rõ câu của bạn, nhưng câu hỏi này ${a.qtype.vi}. Câu của bạn chưa trả lời điều đó.`
      : 'Máy nghe rõ câu của bạn, nhưng chưa thấy câu này trả lời câu hỏi.';
    tip = offTip();
  } else if (s === 3) {
    title = pick(a.linkers.length ? ['Câu trả lời đầy đủ và có thêm ý. Rất tự nhiên!', 'Tuyệt! Bạn trả lời đúng ý và còn nói thêm ý.']
      : ['Bạn trả lời đúng ý, thành câu đầy đủ. Rất tốt!', 'Câu trả lời rõ ràng, đúng ý. Giỏi lắm!', 'Hay lắm! Câu trả lời đúng ý câu hỏi.']);
  } else {
    title = pick(['Trả lời ngắn mà đúng ý!', 'Đúng ý rồi!']);
  }

  // Nhận xét theo chính câu trả lời.
  if (!a.echo && ok) {
    if (a.qtype) notes.push(`Bạn trả lời đúng kiểu câu hỏi (${a.qtype.vi}).`);
    if (a.yesNoQ && a.startsYesNo && a.n >= 3) notes.push('Bạn trả lời Yes/No rồi nói tiếp cả câu: đúng cách người bản xứ trả lời.');
    if (a.linkers.length) notes.push(`Bạn dùng từ nối ${quote(a.linkers)} để nói thêm ý.`);
    const shown = a.usedTopic.length ? a.usedTopic : [...new Set([...a.linked, ...(a.qtype && a.qtype.id === 'like' ? a.linkedCommon : [])])];
    if (shown.length) notes.push(`Bạn dùng từ đúng chủ đề: ${quote(shown)}.`);
    if (a.polite.length) notes.push('Bạn nói lịch sự, thân thiện.');
    if (a.copied) notes.push('Bạn dùng câu gợi ý. Lần sau thử nói theo ý riêng của bạn nhé!');
    else if (s === 3 && a.n >= 6) notes.push(`Câu trả lời dài ${a.n} từ, theo ý của riêng bạn.`);
  }

  // Một lời khuyên để nói hay hơn (chỉ khi chưa có lời khuyên khác).
  if (!tip && !a.echo) {
    if (s < 3) tip = turn.hint ? `Thử nói thành câu đầy đủ, ví dụ: “${turn.hint}”` : 'Thử nói thành câu đầy đủ nhé.';
    else if (!a.linkers.length && level >= 2) tip = 'Muốn hay hơn? Nói thêm lý do với “because…” hoặc thêm ý với “and…”.';
  }

  return { stars: s, heard: a.heard, title, notes, tip, sentence: a.sentence, related: ok,
    detail: `tu_do;so_tu=${a.n};cau=${a.sentence ? 1 : 0};dung_y=${ok ? 1 : 0};loai=${a.qtype ? a.qtype.id : a.yesNoQ ? 'yesno' : a.choiceQ ? 'chon' : a.isQuestion ? 'chung' : 'dap'};noi_y=${a.linkers.length}${a.echo ? ';nhac_lai' : ''}${a.copied ? ';dung_goi_y' : ''}` };
}
