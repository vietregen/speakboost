// So khớp kết quả NHẬN DIỆN LỜI NÓI với câu mục tiêu.
// Lưu ý: đây không phải chấm điểm phát âm. Hàm chỉ cho biết máy nghe ra những chữ nào.

const CONTRACTIONS = [
  [/\bi'm\b/g, 'i am'], [/\bim\b/g, 'i am'], [/\byou're\b/g, 'you are'], [/\bwe're\b/g, 'we are'],
  [/\bthey're\b/g, 'they are'], [/\bit's\b/g, 'it is'], [/\bthat's\b/g, 'that is'],
  [/\bwhat's\b/g, 'what is'], [/\blet's\b/g, 'let us'], [/\bdon't\b/g, 'do not'],
  [/\bdoesn't\b/g, 'does not'], [/\bcan't\b/g, 'cannot'], [/\bisn't\b/g, 'is not'],
  [/\baren't\b/g, 'are not'], [/\bhe's\b/g, 'he is'], [/\bshe's\b/g, 'she is'],
];

// Cách viết Anh – Mỹ mà bộ nhận diện có thể trả về.
const SPELLING = [
  [/\bmath\b/g, 'maths'], [/\bfavorite\b/g, 'favourite'], [/\bcolor\b/g, 'colour'],
  [/\bschoolbag\b/g, 'school bag'], [/\bbreaktime\b/g, 'break time'], [/\bok\b/g, 'okay'],
];

// Máy nhận diện hay viết số bằng chữ số ("7:00", "2", "7 a.m.") trong khi câu mẫu viết bằng chữ ("seven").
// Đổi chữ số thành chữ để so khớp đúng.
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
  'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
function numberWords(n) {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` ${numberWords(n % 100)}` : ''}`;
  return String(n);
}
function spellNumbers(s) {
  return s
    .replace(/\b(\d{1,2})[:.](\d{2})\b/g, (_, h, m) => `${numberWords(+h)}${+m ? ` ${+m < 10 ? `oh ${numberWords(+m)}` : numberWords(+m)}` : ''}`) // 7:00 → seven, 7:30 → seven thirty
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/g, (_, d) => ORDINALS[+d] || `${numberWords(+d)}th`)   // 1st → first
    .replace(/\b(\d{1,3})\b/g, (_, d) => numberWords(+d));
}

export function normalize(text) {
  let s = String(text || '').toLowerCase().replace(/[’`]/g, "'");
  s = s.replace(/\b([ap])\.\s?m\.?/g, '$1m');   // 7 a.m. → 7 am
  s = spellNumbers(s);
  s = s.replace(/[^a-z0-9'\s-]/g, ' ').replace(/-/g, ' ');
  for (const [re, rep] of CONTRACTIONS) s = s.replace(re, rep);
  for (const [re, rep] of SPELLING) s = s.replace(re, rep);
  return s.replace(/'/g, '').replace(/\s+/g, ' ').trim();
}

export const tokens = (text) => (normalize(text) ? normalize(text).split(' ') : []);

const hasPhrase = (hay, phrase) => {
  const p = normalize(phrase);
  return p.length > 0 && (' ' + hay + ' ').includes(' ' + p + ' ');
};

// Dóng hàng LCS giữa từ mục tiêu và từ nghe được.
export function compareSentence(target, heard) {
  const t = tokens(target);
  const h = tokens(heard);
  const dp = Array.from({ length: t.length + 1 }, () => new Array(h.length + 1).fill(0));
  for (let i = t.length - 1; i >= 0; i--) {
    for (let j = h.length - 1; j >= 0; j--) {
      dp[i][j] = t[i] === h[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const matched = new Array(t.length).fill(false);
  let i = 0, j = 0;
  while (i < t.length && j < h.length) {
    if (t[i] === h[j]) { matched[i] = true; i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  const hits = matched.filter(Boolean).length;
  return {
    words: t.map((w, k) => ({ word: w, heard: matched[k] })),
    missing: t.filter((_, k) => !matched[k]),
    ratio: t.length ? hits / t.length : 0,
  };
}

// Chọn phương án nhận diện khớp nhất trong các phương án máy trả về.
export function bestSentenceMatch(targets, alternatives) {
  const list = Array.isArray(targets) ? targets : [targets];
  let best = null;
  for (const alt of alternatives) {
    for (const target of list) {
      const r = compareSentence(target, alt);
      if (!best || r.ratio > best.ratio) best = { ...r, target, heard: alt };
    }
  }
  return best || { ...compareSentence(list[0], ''), target: list[0], heard: '' };
}

// Một từ / cụm từ: đúng nếu bất kỳ phương án nào chứa từ đó hoặc biến thể đã khai báo.
export function matchWord(word, variants, alternatives) {
  const forms = [word, ...(variants || [])];
  for (const alt of alternatives) {
    const hay = normalize(alt);
    if (forms.some((f) => hasPhrase(hay, f))) return { ok: true, heard: alt };
  }
  return { ok: false, heard: alternatives[0] || '' };
}

// Mỗi nhóm cần ít nhất một từ. "*ing" nghĩa là có một từ kết thúc bằng -ing.
export function checkRequired(groups, alternatives) {
  let best = null;
  for (const alt of alternatives) {
    const hay = normalize(alt);
    const words = hay.split(' ');
    const result = groups.map((group) =>
      group.some((term) =>
        term.startsWith('*')
          ? words.some((w) => w.length > term.length + 1 && w.endsWith(term.slice(1)))
          : hasPhrase(hay, term)));
    const score = result.filter(Boolean).length;
    if (!best || score > best.score) best = { score, groups: result, heard: alt };
  }
  return best || { score: 0, groups: groups.map(() => false), heard: '' };
}

export function findKeywords(keywords, alternatives) {
  let best = null;
  for (const alt of alternatives) {
    const hay = normalize(alt);
    const found = keywords.filter((k) => hasPhrase(hay, k));
    const wordCount = hay ? hay.split(' ').length : 0;
    if (!best || found.length > best.found.length) best = { found, wordCount, heard: alt };
  }
  return best || { found: [], wordCount: 0, heard: '' };
}

export function anyTerm(terms, alternatives) {
  for (const alt of alternatives) {
    const hay = normalize(alt);
    if (terms.some((t) => hasPhrase(hay, t))) return { ok: true, heard: alt };
  }
  return { ok: false, heard: alternatives[0] || '' };
}
