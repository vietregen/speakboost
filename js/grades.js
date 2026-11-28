// Cấu hình giao diện theo KHỐI LỚP (chỉ là lớp giao diện: ảnh, màu, tên chủ đề).
// Mọi khối dùng chung hệ thống luyện nói, chấm điểm, tiến độ và 3 cấp độ.
// Thêm khối mới (VD Lớp 7, 9): đặt ảnh vào assets/grades/g7/… rồi khai báo ở đây, không cần sửa phần học.
//
// Mã nội bộ của Unit (dùng để lưu tiến độ, tên tệp): Lớp 6 = số Unit; lớp khác = lớp × 100 + Unit (VD Lớp 8 Unit 4 = 804).
// Unit "có học liệu" khi data/units/index.json có dòng cùng mã và có tệp (file) — không đoán trước.

export const unitCode = (grade, n) => (grade === 6 ? n : grade * 100 + n);
export const gradeOf = (code) => (code < 100 ? 6 : Math.floor(code / 100));
export const unitNo = (code) => (code < 100 ? code : code % 100);

// 3 cấp độ học tập (trước đây gọi là Mức 1 – 2 – 3). Nội dung từng cấp giữ nguyên.
export const LEVELS = {
  1: { name: 'SpeakUp', desc: 'Nghe và nhắc lại' },
  2: { name: 'SpeakBoost', desc: 'Nói theo gợi ý' },
  3: { name: 'SpeakSmart', desc: 'Tự nói, máy nhận xét' },
};
export const levelName = (L) => (LEVELS[L] ? LEVELS[L].name : `Mức ${L}`);

const topics = (list) => list.map((topic, i) => ({ n: i + 1, topic }));

export const GRADES = {
  6: {
    grade: 6, theme: 'g6', world: 'Thế giới phù thủy', dir: 'assets/grades/g6',
    book: 'assets/grades/home/grade-6.png',
    units: topics(['My New School', 'My House', 'My Friends', 'My Neighbourhood', 'Natural Wonders of Viet Nam', 'Our Tet Holiday',
      'Television', 'Sports and Games', 'Cities of the World', 'Our Houses in the Future', 'Our Greener World', 'Robots']),
    unitIcon: (n) => `assets/grades/g6/units/unit-6-${String(n).padStart(2, '0')}.png`,
    comingSoon: 'assets/grades/g6/units/coming-soon.png',
    levelIcon: (L) => `assets/grades/g6/levels/level-${['speakup', 'speakboost', 'speaksmart'][L - 1]}.png`,
    back: 'assets/grades/g6/common/back-button.png',
    footer: 'assets/grades/g6/common/footer-landscape.png',
    banner: null,   // tiêu đề "Grade 6" viết bằng chữ trên dải ruy băng
  },
  7: { grade: 7, theme: 'g6', book: 'assets/grades/home/grade-7.png', soon: true },
  8: {
    grade: 8, theme: 'g8', world: 'Thung lũng ánh sáng', dir: 'assets/grades/g8',
    book: 'assets/grades/home/grade-8.png',
    units: topics(['Leisure Time', 'Life in the Countryside', 'Teenagers', 'Ethnic Groups of Viet Nam', 'Our Customs and Traditions', 'Lifestyles',
      'Environmental Protection', 'Shopping', 'Natural Disasters', 'Communication in the Future', 'Science and Technology', 'Life on Other Planets']),
    unitIcon: (n) => `assets/grades/g8/units/unit-8-${String(n).padStart(2, '0')}.png`,
    comingSoon: 'assets/grades/g8/units/coming-soon.png',
    levelIcon: (L) => `assets/grades/g8/levels/level-${['speakup', 'speakboost', 'speaksmart'][L - 1]}.png`,
    back: 'assets/grades/g8/common/back-button.png',
    footer: 'assets/grades/g8/common/footer-landscape.png',
    banner: 'assets/grades/g8/common/grade-8-banner.png',   // ảnh đã có chữ "Grade 8"
  },
  9: { grade: 9, theme: 'g6', book: 'assets/grades/home/grade-9.png', soon: true },
};
