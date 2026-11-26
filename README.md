# IOE · Ruby School

Ứng dụng luyện thi IOE dạng trang web tĩnh, chạy bằng HTML, CSS và JavaScript.

## Cấu trúc

- `index.html`: các màn hình và thành phần giao diện.
- `css/tailwind.css`: CSS đã biên dịch, được trình duyệt tải trực tiếp.
- `css/styles.css`: các kiểu giao diện bổ sung.
- `js/app.js`: xử lý bài thi, chấm điểm và giao diện.
- `tailwind.config.cjs` và `css/tailwind.input.css`: cấu hình và nguồn để biên dịch lại CSS.
- `media/json/lop<lớp>/vong<vòng>/cd<chuyên đề>.json`: 140 bộ câu hỏi, chia từ lớn
  đến nhỏ theo lớp, vòng thi rồi chuyên đề (ví dụ `media/json/lop3/vong2/cd4.json`).
- `media/images`: ảnh minh họa của câu hỏi, kể cả các ảnh trước đây nhúng trong JSON.
- `media/audio`: các MP3 dùng trong câu hỏi; `sources.json` ghi nguồn gốc tải về.

Ứng dụng tải câu hỏi và tài nguyên qua đường dẫn từ thư mục gốc của website.
Để chạy trên máy, hãy dùng một máy chủ HTTP thay vì mở `index.html`
trực tiếp, ví dụ:

```bash
python -m http.server 8000
```

Sau đó mở `http://localhost:8000/`. Khi triển khai từ repository lên
Vercel, chỉ cần phục vụ thư mục gốc dưới dạng static site.

Khi sửa các lớp giao diện, chạy `npm install` rồi `npm run build:css` để tạo
lại `css/tailwind.css`. Bản triển khai chỉ cần phục vụ các tệp tĩnh, không
cần chạy npm trên máy chủ.

Font Awesome vẫn được tải từ CDN; tính năng lưu ảnh kết quả dùng html2canvas
và phông chữ dùng Google Fonts. CSS Tailwind được lưu trong repository và
không còn phụ thuộc CDN Tailwind khi chạy.

## Kiểm tra dữ liệu

Chạy `python scripts/verify_media.py` sau khi thêm hoặc sửa nội dung.
`scripts/migrate_media.py` và `scripts/download_audio.py` ghi lại quy trình
chuyển đổi từ cấu trúc dữ liệu cũ.
