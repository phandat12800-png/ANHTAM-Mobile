# Tâm Mobile — Website bán điện thoại

Website mẫu có giao diện khách hàng, tìm kiếm/lọc sản phẩm, giỏ hàng, đặt hàng COD, đăng nhập quản trị, CRUD sản phẩm và cập nhật trạng thái đơn hàng. Dữ liệu lưu trong SQLite tại `data/tam-mobile.sqlite`.

## 1. Yêu cầu

- Máy tính Windows/macOS/Linux.
- Node.js phiên bản LTS (khuyến nghị Node.js 20 hoặc 22): https://nodejs.org/
- Internet khi cài thư viện lần đầu và để tải ảnh minh họa từ URL ngoài.

## 2. Cài đặt và chạy trên Windows

1. Tải và cài Node.js LTS từ https://nodejs.org/. Trong trình cài đặt, giữ lựa chọn mặc định.
2. Giải nén `tam-mobile.zip` vào một thư mục dễ tìm, ví dụ `D:\tam-mobile`.
3. Mở thư mục `tam-mobile`, bấm vào thanh địa chỉ File Explorer, gõ `cmd` rồi nhấn Enter.
4. Trong cửa sổ Command Prompt, chạy lần lượt:

   ```bash
   node -v
   npm -v
   npm install
   npm start
   ```

5. Khi thấy dòng `Tâm Mobile đang chạy tại http://localhost:3000`, mở trình duyệt và truy cập:
   - Cửa hàng: http://localhost:3000
   - Quản trị: http://localhost:3000/admin

Không đóng cửa sổ Command Prompt khi đang dùng website. Nhấn `Ctrl + C` để dừng máy chủ.

## 3. Đăng nhập quản trị lần đầu

- Tên đăng nhập: `admin`
- Mật khẩu mặc định: `TamMobile@2026`

Hãy đổi mật khẩu mặc định trước khi công khai website. Cách dễ nhất trước lần chạy đầu tiên là đặt biến môi trường `ADMIN_PASSWORD` và `SESSION_SECRET` trong terminal rồi mới chạy `npm start`.

PowerShell (Windows), ví dụ:

```powershell
$env:ADMIN_USER="admin"
$env:ADMIN_PASSWORD="MatKhauMoiThatManh"
$env:SESSION_SECRET="ChuoiBiMatDaiVaNgauNhien"
npm start
```

Lưu ý: mật khẩu quản trị được khởi tạo trong database khi chạy lần đầu. Nếu database đã tồn tại, đổi biến môi trường không tự thay đổi mật khẩu đã lưu. Để đặt lại trong giai đoạn thử nghiệm, dừng server, sao lưu rồi xóa `data/tam-mobile.sqlite`, đặt biến môi trường và khởi động lại. Việc này xóa các đơn hàng và sản phẩm tùy chỉnh; chỉ làm khi chưa có dữ liệu cần giữ.

## 4. Sử dụng

- Tìm kiếm: nhập tên/hãng vào thanh tìm kiếm.
- Lọc: chọn thương hiệu, giá từ/đến và thứ tự sắp xếp.
- Giỏ hàng: thêm sản phẩm, tăng/giảm số lượng hoặc xóa.
- Đặt hàng: nhập tên, số điện thoại, địa chỉ; bản này hỗ trợ thanh toán khi nhận hàng (COD).
- Quản trị: đăng nhập, thêm/sửa/xóa sản phẩm, xem đơn và cập nhật trạng thái.
- Khi đơn được tạo, tồn kho được trừ trong transaction. Khi hủy đơn chưa hủy trước đó, tồn kho được cộng trả.

## 5. Cấu trúc thư mục

```text
tam-mobile/
├── server.js
├── package.json
├── README.md
├── data/                 # Tự tạo khi chạy, chứa SQLite database
└── public/
    ├── index.html
    ├── styles.css
    ├── app.js
    ├── admin.html
    ├── admin.js
    └── admin.css
```

## 6. Lưu ý trước khi bán hàng thật

Đây là nền tảng khởi đầu có backend và database, chưa phải hệ thống đã được kiểm thử/đánh giá bảo mật độc lập để triển khai thương mại ngay. Trước khi công khai:
- Đổi mật khẩu quản trị và `SESSION_SECRET`; dùng HTTPS.
- Dùng session store bền vững (không dùng MemoryStore mặc định) và cấu hình cookie/proxy phù hợp môi trường.
- Bổ sung giới hạn đăng nhập (rate limiting), CSRF protection, log/backup và chính sách bảo mật dữ liệu khách hàng.
- Tích hợp nhà cung cấp thanh toán nếu cần thanh toán online; hiện chỉ có COD.
- Kiểm tra giá, tồn kho, ảnh, bảo hành và thông tin doanh nghiệp. Dữ liệu sản phẩm mẫu là dữ liệu minh họa, cần xác nhận trước khi bán.
- Ảnh sản phẩm đang lấy từ URL bên ngoài và cần được thay bằng ảnh chính xác, có quyền sử dụng.
- Dùng dịch vụ hosting hỗ trợ Node.js và lưu trữ bền vững cho SQLite; nếu chạy nhiều máy chủ, nên chuyển sang PostgreSQL/MySQL.

## 7. Khắc phục lỗi phổ biến

- `node is not recognized`: cài Node.js LTS rồi đóng/mở lại Command Prompt.
- `npm install` lỗi: kiểm tra mạng và Node.js; dùng bản Node.js LTS mới.
- Port 3000 đang được dùng: PowerShell có thể chạy `$env:PORT=3001; npm start`, sau đó mở `http://localhost:3001`.
- Không hiện ảnh: ảnh demo phụ thuộc dịch vụ bên ngoài; thay link ảnh HTTPS trong trang quản trị.
- Quên mật khẩu: với dữ liệu đã có, cần quy trình đặt lại mật khẩu an toàn hoặc xử lý database trực tiếp khi server đã dừng; đừng xóa database nếu đang có đơn thật.
