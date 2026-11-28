# Sổ tay dự án SpeakBoost

Ứng dụng luyện nói tiếng Anh THCS (Global Success) cho sáng kiến kinh nghiệm của thầy Hồ Quỳnh Đức.
Tệp này giúp bắt đầu một phiên làm việc mới mà không cần đọc lại lịch sử. **Khi mở phiên mới, hãy yêu cầu Claude đọc tệp này trước.**

Cập nhật lần cuối: 28/11/2026 (giao diện mới: trang chủ chọn khối, bản đồ Unit, 3 cấp độ SpeakUp – SpeakBoost – SpeakSmart).

---

## 1. Địa chỉ

| Thứ | Địa chỉ |
|---|---|
| Trang học sinh | https://vietregen.github.io/speakboost/ |
| Dashboard giáo viên | https://vietregen.github.io/speakboost/dashboard.html |
| Duyệt nội dung | https://vietregen.github.io/speakboost/teacher.html (thêm `?unit=4` để chọn bài) |
| Xem trước (không khóa, có bản nháp) | `…/speakboost/?preview=1&unit=804` |
| Chẩn đoán nhận diện giọng nói | `…/speakboost/?debug=1` |
| Mã nguồn | GitHub `vietregen/speakboost`, nhánh `main` (GitHub Pages, thư mục gốc) |
| Máy chủ dữ liệu | Supabase, dự án `ypubympnwddmlrulylto` (Singapore, gói Free) |

---

## 2. Nguyên tắc đã chốt (không tự ý đổi)

- **Không tạo số liệu giả.** Dữ liệu thử phải ghi rõ là mô phỏng và xóa sau khi thử. Cột `is_simulated` trong bảng `attempts`.
- **Mọi nội dung dạy phải được giáo viên duyệt** (`review: "approved"`) thì học sinh mới thấy.
- **"Sao" là mức máy nhận diện được lời nói, không phải điểm phát âm.** Luôn ghi rõ điều này khi hiển thị.
- **Xưng "bạn"** với học sinh trên mọi trang, không dùng "em".
- Học sinh **không cần email hay tài khoản Claude**: đăng nhập bằng mã lớp + chọn tên + PIN.
- **Không lưu giọng nói** lên máy chủ. Bản ghi âm chỉ nằm trong bộ nhớ trang.
- Không gửi thông tin định danh cho dịch vụ AI. Xuất dữ liệu mặc định dùng mã ẩn danh (VD `6A-07`).
- Trang giáo viên giữ **giao diện tối giản**; chỉ trang học sinh dùng giao diện "phép thuật".
- Tính năng là **mã dùng chung cho mọi Unit**. Không viết riêng theo Unit trừ khi thật cần.

---

## 3. Cấu trúc thư mục

```
index.html            Trang học sinh (nạp css/app.css + css/magic.css, body.magic)
dashboard.html        Dashboard giáo viên (đăng nhập email)
teacher.html          Duyệt nội dung, nhập Excel (chưa có đăng nhập; trạng thái duyệt lưu trên máy)
js/
  app.js              Trang học sinh: điều hướng theo tầng (trang chủ chọn khối → bản đồ Unit → 3 cấp độ → trang bài học), các hoạt động, khóa/mở, đăng nhập lớp
  grades.js           Cấu hình giao diện từng khối (ảnh, màu, 12 chủ đề Unit, tên 3 cấp độ SpeakUp/SpeakBoost/SpeakSmart)
  ui.js               Thành phần dùng chung, speakPanel (nghe mẫu / nói / ghi âm) + gọi hiệu ứng biến mất
  speech.js           Nghe mẫu (ưu tiên tệp âm thanh), nhận diện lời nói (Web Speech API), ghi âm
  match.js            So khớp lời nói với từ/câu mẫu
  freetalk.js         Chấm câu trả lời TỰ DO (Đóng vai + Thử thách Chương 2): nhận xét theo từng câu, chạy trên máy
  progress.js         Tiến độ trên máy (localStorage), tách theo học sinh
  cloud.js            Học sinh ↔ Supabase: đăng nhập ẩn danh + student_join, gửi lượt luyện (có hàng chờ)
  grading.js          Nhiệm vụ, hoàn thành, điểm gợi ý, luật khóa/mở (dùng chung học sinh + Dashboard)
  challenge.js        Thử thách Chương 1 · Từ vựng (nhìn hình nói từ)
  challenge2.js       Thử thách Chương 2 · Hội thoại nhanh (nghe câu hỏi, trả lời)
  vanish.js           Hiệu ứng phép thuật khi đọc đúng (6 kiểu), mỗi kiểu có tiếng riêng
  sound.js            Âm thanh tạo bằng Web Audio (không có tệp nhạc): nhạc nền + tiếng hiệu ứng, nút 🔊/🔇
  content.js          Nạp/kiểm tra dữ liệu bài, lọc nội dung đã duyệt
  excel.js            Excel ↔ JSON (SheetJS từ CDN)
  teacher.js          Trang duyệt nội dung
  dashboard.js        Dashboard giáo viên
  config.js           Địa chỉ + khóa CÔNG KHAI Supabase (không bao giờ đặt khóa secret ở đây)
css/  app.css (nền), magic.css (giao diện học sinh + hiệu ứng), worlds.css (trang chủ / bản đồ / cấp độ, màu theo khối), dashboard.css, teacher.css
data/units/index.json        Danh sách bài
data/units/unit-NN.json      Nội dung từng bài
data/audio/unit-NN.json      Bảng tra câu → tệp âm thanh
assets/                      Ảnh từ vựng (*.webp)
assets/theme/                Hình giao diện phép thuật (PNG nền trong suốt + castle.jpg)
assets/grades/home/          Hình trang chủ (sách Grade 6–9, mũ, sách phép, quả cầu)
assets/grades/g6, g8/        Hình theo khối: units/ (12 biểu tượng + coming-soon), levels/ (3 cấp độ), common/ (nút quay lại, cảnh chân trang, khung)
assets/audio/uNN/            Tệp âm thanh mẫu (.wav)
supabase/01…05-*.sql         Cấu trúc cơ sở dữ liệu (đã chạy hết trên Supabase)
tools/make-audio.ps1         Tạo âm thanh mẫu bằng giọng Windows
serve.ps1, start.bat         Máy chủ nhỏ chạy trên máy (không cần Node/Python)
```

Không có bước build. Máy của thầy **không có Node, Python, Git**.

---

## 4. Các bài đang có

| Mã nội bộ | Tên hiển thị | Tệp | Nội dung | Âm thanh |
|---|---|---|---|---|
| 1 | Lớp 6 · Unit 1 · My New School | unit-01.json | 60 mục (38 từ, 14 mẫu câu, 4 hội thoại, 4 đóng vai), 5 ảnh | 148 câu |
| 4 | Lớp 6 · Unit 4 · My Neighbourhood | unit-04.json | 95 mục (57/30/4/4), 8 ảnh | 223 câu |
| 804 | Lớp 8 · Unit 4 · Ethnic Groups of Viet Nam | unit-804.json | 93 mục (43/42/4/4), chưa có ảnh | 223 câu |

- **Mã nội bộ** dùng để lưu tiến độ, thư mục âm thanh (`assets/audio/u804`), tên tệp. Lớp khác lớp 6 dùng mã `lớp×100 + unit` (VD lớp 8 Unit 4 = 804) để không trùng.
- `index.json` có thêm `grade` và `label`; tệp bài có `meta.display_label` để hiện "Lớp 8 · Unit 4".
- Mã mục (id) có tiền tố riêng: `u1-…`, `u4-…`, `g8-…`.
- Mục "Nói qua tranh" **đã bỏ hẳn** khỏi ứng dụng.

---

## 5. Luật học tập (trang học sinh)

**3 cấp độ** (từ 28/11/2026, thay cho 3 vùng đất cũ): ① **SpeakUp** – nghe và nhắc lại, ② **SpeakBoost** – nói theo gợi ý, ③ **SpeakSmart** – tự nói, máy nhận xét. Trong mã vẫn là mức 1–2–3 (`level`); Dashboard giáo viên vẫn ghi "Mức".

**Điều hướng** (giao diện mới theo thiết kế ChatGPT, 28/11/2026): Trang chủ (câu bùa, 4 sách Grade 6–9, Peekaboo!, Alohomora!) → `#/grade/6` bản đồ 12 Unit của khối → `#/levels` 3 cấp độ của Unit → `#/hub` trang bài học (4 hoạt động + thử thách + bài thầy cô giao) → các hoạt động. Mỗi khối một "thế giới": Lớp 6 phù thủy tím–vàng, Lớp 8 Thung lũng ánh sáng xanh ngọc (màu trong `worlds.css`, ảnh trong `grades.js`). Lớp 7, 9 hiện "Sắp có" cho tới khi có ảnh và học liệu. Unit có học liệu khi `index.json` có dòng cùng mã và có tệp; chấm tròn trên bản đồ = cấp độ đã hoàn thành thật. Học thử: chỉ Lớp 6 · Unit 1.
Ở mức L học sinh làm Từ vựng và Mẫu câu có `level ≤ L`, cùng mọi Hội thoại và Đóng vai (đề tự khó dần theo mức).

**Mở khóa** (`grading.js` → `REQUIRES`, `UNLOCK_RATIO = 0.9`):
- Từ vựng → mở Mẫu câu **và** Thử thách Chương 1.
- Mẫu câu → Hội thoại → Đóng vai.
- Chương 2 cần xong Đóng vai **và** Chương 1.
- Mức sau mở khi xong hết các phần của mức trước.
- Một phần "xong" khi **≥ 90% số bài đạt ⭐⭐** (làm tròn xuống, tối thiểu 1), luyện **ở đúng mức đó**. Nếu lớp đặt ngưỡng sao khác thì dùng ngưỡng của lớp.
- Chế độ xem trước của giáo viên không khóa gì.

**Thử thách** (một lượt chơi = một ván):
- Chương 1: 10 từ (nhìn hình/emoji, nói từ). Chương 2: 8 câu hỏi lấy từ phần Đóng vai đã duyệt, học sinh trả lời tự do (xem dưới). Câu được tính khi đạt từ 2 sao **và đúng ý** câu hỏi; lạc đề thì nói lại.
- Mỗi từ/câu 2 lần nói; đúng lần 1 = 3 điểm, lần 2 = 2 điểm, dùng gợi ý = 1 điểm.
- Vượt chương khi **≥ 90% số từ/câu trong ván đạt ⭐⭐** (đúng ở lần 1 hoặc 2, không gợi ý): 9/10 và 7/8.
- Mã ghi kết quả: `challenge-vocab-L{mức}` và `challenge-dialog-L{mức}`, tính riêng theo Unit.

**Hiệu ứng:** đọc đúng (3 sao, máy nhận diện) thì từ/câu biến mất ngẫu nhiên 1 trong 6 kiểu (vò giấy + khói, lửa, hóa con vật chạy, mọc cánh bay, bụi sao, bong bóng), rồi hiện lại. Phần tử nào biến mất được đánh dấu `data-vanish`.

**Học thử** (không đăng nhập) chỉ có **Lớp 6 · Unit 1**, không lưu kết quả.

**Đóng vai: trả lời tự do** (`freetalk.js`, từ 28/11/2026):
- Học sinh trả lời theo ý mình, **không cần giống câu gợi ý**. Cột "Từ chấp nhận" giờ chỉ giúp nhận ra từ đúng chủ đề, không còn là điều kiện bắt buộc.
- **Máy nhận ra loại câu hỏi** (không dùng AI): tên, Where (nơi chốn), When/What time (thời gian), How often, How many/much/old (số), hỏi đường, Who (người), What do you do (hoạt động), What is … like (miêu tả), sở thích (favourite/like best/prefer), Yes/No, câu hỏi lựa chọn (… or …). Câu trả lời phải **đúng loại**; với câu hỏi Yes/No, lựa chọn và What/How chung thì phải có Yes/No hoặc **từ liên quan** (từ trong câu hỏi, câu gợi ý, cột Từ chấp nhận, từ vựng của Unit; động từ chung như like/go không tính).
- Sao mỗi lượt: 3 = câu đầy đủ (có động từ) **và đúng ý**; 2 = câu đầy đủ nhưng lạc đề, hoặc câu ngắn đúng ý; 1 = câu ngắn lạc đề, hoặc chỉ nhắc lại câu hỏi; 0 = máy không nghe được. Đã thử: 48/48 câu gợi ý của 3 Unit đạt 3 sao; câu lạc đề (VD "I like pizza") chỉ còn 2 sao.
- Nhận xét theo chính câu nói: có từ nối (because, and, but…), từ đúng chủ đề, trả lời Yes/No kèm câu, lịch sự, dùng nguyên câu gợi ý; kèm một lời khuyên (nói thành câu, thêm lý do…).
- Mỗi lượt lấy kết quả tốt nhất (được nói lại). Sao cả bài: ⭐⭐⭐ khi tổng sao ≥ 90% tối đa, ⭐⭐ khi trung bình ≥ 2 sao/câu, lượt bỏ qua tính 0. Màn tổng kết liệt kê từng câu và sao của câu đó.
- Gợi ý: Mức 1 hiện sẵn ("Một cách trả lời"), Mức 2–3 bấm 💡 mới hiện.
- Giới hạn còn lại: máy chỉ xét loại câu hỏi và từ khóa, không hiểu nghĩa sâu (VD hỏi "How often…" mà trả lời "I play games every day" vẫn được 3 sao vì đúng loại). Muốn hiểu nghĩa thật cần AI (VD Claude qua Supabase Edge Function, cần khóa API và có chi phí).

**Trang chủ** là **bìa chung**: logo SpeakBoost trên cùng + dải ruy băng **câu bùa đổi mỗi 15 giây**, tiếng Việt và tiếng Anh đan xen (danh sách `SPELLS_VI`, `SPELLS_EN` trong app.js; 7 câu bùa tiếng Việt do thầy soạn, câu nhiều dòng thì dòng đầu nằm trên ruy băng, các dòng sau hiện bên dưới; câu tiếng Anh là thần chú có thật như Abracadabra, Open Sesame hoặc bùa Harry Potter như Lumos, Alohomora, bấm 🔊 để nghe), không còn tên Unit to; bài đang học hiện ở dòng nhỏ "📖 Đang học: …".

**Âm thanh** (`sound.js`, 28/11/2026):
- **Nhạc nền** nhẹ, du dương (hộp nhạc rải hợp âm + nền êm, tạo bằng máy, không bản quyền) chỉ phát ở **trang chính và màn đăng nhập**. Vào bài học hoặc thử thách thì tắt hẳn để không lẫn vào micro.
- Trình duyệt chỉ cho phát âm thanh sau lần chạm/bấm đầu tiên, nên nhạc bắt đầu từ lúc đó.
- **Tiếng hiệu ứng** khi đọc đúng, khớp với kiểu biến mất: vò giấy + "phụt" khói, lửa bùng lách tách, chạy lạch bạch + "vèo", đập cánh + vút lên, chuông leng keng (bụi sao), bong bóng "bloop" rồi "bốp".
- Nút 🔊/🔇 ở góc trên trang chính tắt/bật **toàn bộ** âm thanh; lựa chọn lưu trên máy (`sb.sound`).
- Bìa: đã bỏ chữ SpeakBoost lớn, chỉ giữ logo trên cùng (to hơn); dải ruy băng câu bùa là tâm điểm.

**Nghe lời nói** (`speech.js`, bản `speech-2026-11-28a`):
- Máy nghe liên tục và **chỉ dừng khi học sinh im lặng khoảng 2 giây** (iPhone 1,8 giây), tối đa 15 giây một lượt (iPhone 8 giây).
- Chrome Android hay tự ngắt phiên nghe ở lần ngắt hơi đầu tiên: máy tự nghe tiếp (tối đa 6 lần) và ghép các đoạn lại; đoạn bị gửi lặp được gộp. Đây là lỗi "đọc câu dài bị cắt ngang rồi báo sai" học sinh báo ngày 28/11/2026.
- Chữ số máy nghe được được đổi thành chữ trước khi so khớp: "7:00" → seven, "6:45 a.m." → six forty five am, "2" → two, "1st" → first (`match.js`).

---

## 6. Giáo viên

**Dashboard** (đăng nhập email, link gửi qua email):
- Lớp học: tạo lớp, mã lớp tự sinh, QR, khóa/xóa lớp.
- Học sinh & PIN: dán danh sách hoặc Excel (cột A số, cột B tên gọi), PIN 4 số tự sinh, phiếu in, PIN mới.
- Giao bài & cài đặt (lưu trong `classes.assignment`): **Unit lớp đang học**, giao theo mức hoặc **tự luyện**, có tính thử thách, ngưỡng sao, hạn chót, thang 10/100.
- Tiến độ & điểm: % hoàn thành, **điểm gợi ý = tỉ lệ nhiệm vụ đạt × thang, làm tròn 0,5**, bài còn thiếu, từ máy hay chưa nghe rõ.
- Xuất dữ liệu: bảng điểm CSV, tổng hợp theo học sinh, toàn bộ lượt luyện, lọc ngày, mã ẩn danh.
- Quản trị (Super Admin / Quản trị trường): mời giáo viên theo email, thêm trường.

**Duyệt nội dung** (`teacher.html`): chọn bài, nhập Excel, duyệt từng mục hoặc cả phần, tải JSON đã duyệt, xem số câu có âm thanh.
Trạng thái duyệt hiện **chỉ lưu trên máy** đang mở; muốn học sinh thấy phải đưa tệp JSON lên GitHub.

---

## 7. Supabase

- Đăng nhập: học sinh = **ẩn danh** + RPC `student_join(mã lớp, số, PIN)`; giáo viên = email (magic link).
- Bảng: `schools, profiles, invites, classes (assignment jsonb), students (pin_hash bcrypt), student_links, attempts`.
- RPC: `class_roster, student_join, student_me, student_leave, record_attempt, upsert_students, reset_pin, create_school`.
- Quyền kiểm tra bằng **RLS**. Super Admin là email trong `supabase/02-super-admin.sql`; trường "THCS Nguyễn Văn Cừ".
- Cài đặt đã bật: Anonymous sign-ins; Site URL = dashboard.html; Redirect URLs `https://vietregen.github.io/speakboost/**` và `http://localhost:8080/**`.
- Nên nâng **Authentication → Rate Limits → anonymous users** lên ~300 trước khi cả lớp dùng phòng máy trường.
- Khóa **secret / service_role** và mật khẩu cơ sở dữ liệu: chỉ thầy giữ, không đưa cho ai.

---

## 8. Quy trình thường gặp

**Thêm một Unit mới từ Excel**
1. Excel đúng mẫu (trang tính: ThongTin, MucDo, TuVung, MauCau, HoiThoai, DongVai). Ảnh đặt tên `assets/<tên>.webp`, ghi vào cột "Ảnh".
2. Chạy máy chủ có quyền lưu: `powershell -ExecutionPolicy Bypass -File serve.ps1 -AllowSave`.
3. Trong trình duyệt ở `http://localhost:8080`: đọc Excel bằng `excel.js` (`workbookToUnit`), kiểm tra `content.validate`, đặt mã nội bộ (lớp khác lớp 6 → `lớp×100+unit`, thêm `meta.display_label`), lưu bằng `PUT /__save/data/units/unit-NN.json`.
4. Thêm dòng vào `data/units/index.json` (có `grade`, `label`).
5. Giáo viên duyệt (hoặc đổi `"review": "draft"` → `"approved"` khi thầy đồng ý duyệt cả bài).
6. Tạo âm thanh: `powershell -ExecutionPolicy Bypass -File tools\make-audio.ps1 -Unit NN`.
7. Đưa lên GitHub theo đợt (xem dưới), âm thanh trước, bảng tra âm thanh sau cùng.

**Sửa chữ một câu** → chạy lại `make-audio.ps1` cho Unit đó (tệp cũ tự xóa, tệp mới tự tạo), rồi đưa lên.

**Đưa lên web (chưa có Git)**
- Dùng **Chrome** (khung trình duyệt trong app Claude không mở được hộp chọn tệp): `https://github.com/vietregen/speakboost/upload/main` hoặc thêm đường dẫn thư mục, VD `/upload/main/js`.
- GitHub nhận **tối đa 100 tệp mỗi lần**; chia đợt. Kéo **nội dung bên trong** thư mục chuẩn bị sẵn, không kéo cả thư mục bọc ngoài.
- Bấm Commit changes, chờ 1–2 phút. GitHub Pages giữ bộ nhớ đệm ~10 phút: nhấn **Ctrl+F5**.
- Kiểm tra bằng cách tải tệp trên `vietregen.github.io` (thêm `?t=` để tránh bộ nhớ đệm).
- Gợi ý: cài **Git for Windows** và đăng nhập GitHub một lần thì Claude có thể tự đẩy mã lên, bớt nhiều bước.

**Chạy trên máy**: bấm đúp `start.bat`, mở http://localhost:8080.

---

## 9. Việc còn dang dở

- **iPhone**: Safari nhận diện từ đơn kém, chưa tự dừng nghe ổn định. Có sẵn `?debug=1` để chụp nhật ký và sửa tiếp. Âm thanh mẫu đã ổn nhờ tệp .wav.
- Lớp 6 · Unit 4: "chemist's" và "pharmacy" cùng emoji 💊, khó phân biệt trong Thử thách Chương 1 → nên đổi emoji hoặc thêm ảnh.
- Lớp 8 · Unit 4 chưa có ảnh minh họa (dùng emoji).
- Lớp 6 Unit 2, 3, 5, 6 chưa có nội dung.
- Trang duyệt nội dung chưa có đăng nhập và chưa lưu trạng thái duyệt lên máy chủ.
- 4 hình giao diện chưa dùng: `flag.png`, `ribbon-blue.png`, `ribbon-purple.png`, `frame.png`.
- Ảnh thiết kế mới cần ChatGPT làm lại: `assets/grades/g6/levels/level-speaksmart.png` có chữ "AI" (ứng dụng không chấm bằng AI); vài biểu tượng còn viền nền (Lớp 6: unit-6-04, 05, 06, 12; Lớp 8: nền trời quanh hình). Chưa có ảnh cho Lớp 7, Lớp 9.
- Hình giao diện cũ không còn dùng ở trang chủ: castle.jpg, island1–3.png, cat.png, shield.png (vẫn để trong assets/theme).
- Lớp thử "THU" trên Dashboard: xóa trước khi dùng dữ liệu thật cho thực nghiệm.
- Giới hạn học sinh chỉ vào được Unit đã giao cho lớp: thầy đã yêu cầu nhưng **tạm hoãn** (28/11/2026), hiện ai có mã lớp + PIN vẫn chọn được mọi Unit.

---

## 10. Lưu ý kỹ thuật

- PowerShell 5.1: tệp `.ps1` có tiếng Việt phải lưu **UTF-8 có BOM**; không dùng chuỗi `"…"` chứa `` `${…}` `` của JavaScript (dùng `'…'`).
- `serve.ps1 -AllowSave` chỉ cho lưu `data/units/unit-NN.json` từ chính máy đó.
- Giọng mẫu: Microsoft Zira (Anh–Mỹ), đã cắt khoảng lặng và chuẩn hóa âm lượng. Muốn giọng Anh–Anh cần cài thêm giọng UK cho Windows.
- Biểu tượng 🪽 không hiện trên Windows; đôi cánh trong hiệu ứng vẽ bằng CSS.
- Tài liệu thiết kế đầy đủ (kiến trúc, đa trường, bảo mật): https://claude.ai/artifact/EjL4ZGF2yQBxZxZ8mohofa
