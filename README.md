# SpeakBoost – Bản mẫu Unit 1 (Giai đoạn 1)

Ứng dụng web luyện nói tiếng Anh lớp 6 (Global Success), Unit 1 – My New School.
Bản mẫu chạy hoàn toàn trên trình duyệt: không đăng nhập, không máy chủ dữ liệu, không gọi AI, không tốn phí.

## Chạy thử trên máy tính

1. Nháy đúp `start.bat`. Trình duyệt mở `http://localhost:8080`.
2. Dùng **Chrome** hoặc **Edge** để có nhận diện lời nói. Lần đầu bấm 🎤, trình duyệt hỏi quyền dùng micro: chọn Cho phép.
3. Tắt máy chủ: đóng cửa sổ PowerShell.

Không mở trực tiếp `index.html` bằng cách nháy đúp: trình duyệt chặn đọc tệp dữ liệu khi mở kiểu `file://`.

## Quy trình duyệt nội dung

Mọi mục trong `data/units/unit-01.json` đang ở trạng thái `"review": "draft"`. **Học sinh chỉ thấy mục `"approved"`.**

1. Mở `http://localhost:8080/teacher.html`.
2. Đọc từng mục, bấm 🔊 để nghe thử, chọn trạng thái *Đã duyệt* / *Cần sửa*.
3. Bấm **👀 Xem trước** để xem như học sinh nhưng có cả bản nháp (có dải vàng ở đầu trang).
4. Bấm **⬇ Tải tệp JSON đã duyệt**, rồi chép tệp vừa tải đè lên `data/units/unit-01.json`.
   Từ đó mọi máy học sinh đều thấy nội dung đã duyệt.

Trạng thái duyệt chọn trên trang giáo viên chỉ lưu trên trình duyệt đó cho tới khi thầy cô tải tệp JSON về và thay vào.

## Nhập nội dung từ Excel (khuyên dùng)

1. Mở trang giáo viên, bấm **⬇ Tải Excel mẫu**. Tệp có sẵn nội dung đang xem để làm ví dụ, và trang tính **HuongDan** giải thích từng cột.
2. Sửa hoặc điền thêm trong Excel. Mỗi trang tính là một phần: ThongTin, MucDo, TuVung, MauCau, HoiThoai, DongVai.
   Muốn soạn Unit mới thì đổi số Unit ở trang ThongTin.
3. Bấm **⬆ Tải lên tệp Excel đã điền**. Ứng dụng báo lỗi theo trang tính và số dòng (ví dụ “TuVung dòng 4: mức phải là 1, 2 hoặc 3”).
4. Bấm **👀 Xem trước** để xem như học sinh. Nội dung nhập chỉ nằm trên máy của thầy cô, học sinh chưa thấy.
5. Hết lỗi thì bấm **⬇ Tải tệp JSON đã duyệt** và tải tệp đó lên thư mục `data/units` trên GitHub.
   Nếu là Unit mới, thêm tên tệp vào `data/units/index.json`.

Trạng thái ở cột “Trạng thái” trong Excel thay thế các trạng thái duyệt đã chọn trước đó trên máy này.
Bấm **Bỏ nội dung nhập** để quay về bản đang có trên web.

## Sửa trực tiếp tệp JSON

Cũng có thể sửa tệp `data/units/unit-01.json` (bằng Notepad, VS Code…), không phải sửa mã nguồn.
Trang giáo viên tự kiểm tra cấu trúc và báo lỗi bằng tiếng Việt (thiếu trường, trùng id…).

Thêm một từ vựng: chép một khối trong `"vocabulary"`, đổi `id` (không trùng), sửa các trường:

| Trường | Ý nghĩa |
| --- | --- |
| `word`, `ipa`, `meaning_vi`, `example` | Từ, phiên âm, nghĩa, câu ví dụ |
| `level` | 1, 2 hoặc 3: học sinh ở mức thấp hơn sẽ không thấy từ này |
| `accepted_variants` | Cách viết khác của chính từ đó vẫn chấp nhận: số nhiều, viết liền/tách, Anh–Mỹ (`math`). Không ghi từ đồng nghĩa như `soccer`, `bike` |
| `emoji` / `image` | Hình tạm bằng emoji; muốn dùng ảnh thật thì đặt ảnh vào `assets/` và ghi `"image": "assets/uniform.webp"` |
| `audio` | Tệp ghi âm mẫu, ví dụ `"assets/audio/uniform.mp3"`; để `null` thì dùng giọng máy |
| `review` | `draft` / `approved` / `needs_fix` |

Mẫu câu (`patterns`): `frame` phải có `___`; `slot_options` là các từ điền được; `free_required` là các nhóm từ bắt buộc ở mức 3
(mỗi nhóm cần ít nhất một từ; `"*ing"` nghĩa là có một từ đuôi -ing).
Đóng vai (`roleplays`): mỗi lượt có câu của máy (`bot`), các từ chấp nhận (`expect_any`) và câu gợi ý (`hint`).

Thêm Unit mới: tạo `data/units/unit-02.json` theo cùng cấu trúc và ghi tên tệp vào `data/units/index.json`.

## Nhận diện lời nói khác đánh giá phát âm

- Ngôi sao chỉ cho biết **máy nhận diện được bao nhiêu chữ** học sinh nói (Web Speech API của trình duyệt). Màn kết quả luôn ghi “không phải điểm phát âm”.
- Trên Chrome, âm thanh nhận diện được trình duyệt gửi tới dịch vụ nhận diện của nhà cung cấp trình duyệt (Google, Microsoft). SpeakBoost không gửi và không lưu bản ghi nào.
- Trình duyệt không hỗ trợ (Firefox, một số trình duyệt trong ứng dụng): học sinh ghi âm, nghe lại và **tự đánh giá**; kết quả ghi nguồn `self_check`.
- Đánh giá phát âm chuyên sâu là tính năng tùy chọn ở giai đoạn 4, cần phụ huynh đồng ý.

## Dữ liệu và quyền riêng tư

- Không hỏi tên, không đăng nhập. Tiến độ (sao, số lượt) lưu trong trình duyệt của thiết bị đó.
- Bản ghi âm chỉ nằm trong bộ nhớ trang, mất khi chuyển màn hoặc đóng trang.
- Trang giáo viên → “Tải CSV”: xuất các lượt luyện **thật** trên thiết bị đó, cột `nguon_danh_gia` cho biết `asr_match` hay `self_check`. Ứng dụng không tạo số liệu mẫu.

## Cấu trúc thư mục

```
index.html, teacher.html     Trang học sinh, trang giáo viên
css/                         Giao diện
js/content.js                Nạp, kiểm tra, lọc dữ liệu bài học
js/speech.js                 Nghe mẫu, nhận diện lời nói, ghi âm
js/match.js                  So khớp kết quả nhận diện với câu mục tiêu
js/progress.js               Tiến độ trên thiết bị
js/ui.js, js/app.js          Giao diện học sinh
js/teacher.js                Trang duyệt nội dung
data/units/                  Dữ liệu bài học (giáo viên sửa ở đây)
serve.ps1, start.bat         Máy chủ nhỏ để chạy trên máy
```

## Giới hạn của bản mẫu

- Chưa có đăng nhập và phân quyền (giai đoạn 2); trang giáo viên ai mở cũng vào được.
- Chưa có trợ lý AI; đóng vai chạy theo kịch bản giáo viên duyệt (giai đoạn 4).
- Nội dung Unit 1 là bản nháp, chưa đối chiếu sách giáo khoa; hình là emoji tạm.
- Muốn học sinh dùng trên điện thoại cần đưa thư mục này lên một dịch vụ web tĩnh có HTTPS (micro không hoạt động trên địa chỉ http thường, trừ localhost).
