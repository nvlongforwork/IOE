# IOE · Ruby School

Ứng dụng luyện thi IOE dạng trang web tĩnh, chạy bằng HTML, CSS và JavaScript.

## Cấu trúc

- `index.html`: các màn hình và thành phần giao diện.
- `css/styles.css`: CSS của ứng dụng.
- `js/app.js`: xử lý bài thi, chấm điểm và giao diện.
- `js/tailwind-config.js`: cấu hình màu và phông chữ Tailwind.
- `media/json/lop3` đến `media/json/lop9`: 140 bộ câu hỏi theo lớp, vòng thi và chuyên đề.
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

Hai thư viện giao diện bên ngoài vẫn được tải từ CDN: Tailwind CSS, Font
Awesome; tính năng lưu ảnh kết quả dùng html2canvas và phông chữ dùng Google
Fonts. Nội dung bài thi, ảnh và âm thanh được lưu ngay trong repository.

## Kiểm tra dữ liệu

Chạy `python scripts/verify_media.py` sau khi thêm hoặc sửa nội dung.
`scripts/migrate_media.py` và `scripts/download_audio.py` ghi lại quy trình
chuyển đổi từ cấu trúc dữ liệu cũ.
