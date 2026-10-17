# FinTrack

> Ứng dụng quản lý tài chính cá nhân giúp ghi nhận thu nhập, theo dõi chi tiêu, lập ngân sách và xem báo cáo trong một giao diện tiếng Việt.

## Mục lục

- [Giới thiệu](#giới-thiệu)
- [Công nghệ](#công-nghệ)
- [Tính năng](#tính-năng)
- [Kiến trúc dự án](#kiến-trúc-dự-án)
- [Yêu cầu](#yêu-cầu)
- [Chạy trên máy cá nhân](#chạy-trên-máy-cá-nhân)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Chạy bằng Docker Compose](#chạy-bằng-docker-compose)
- [Kiểm thử và build](#kiểm-thử-và-build)
- [Tài liệu API](#tài-liệu-api)
- [Chatbot FinTrack](#chatbot-fintrack)
- [Bảo mật và quyền riêng tư](#bảo-mật-và-quyền-riêng-tư)
- [Giới hạn hiện tại](#giới-hạn-hiện-tại)
- [Khắc phục sự cố](#khắc-phục-sự-cố)

## Giới thiệu

FinTrack là ứng dụng quản lý tài chính cá nhân gồm giao diện web và API backend. Người dùng có thể ghi nhận các khoản thu, chi và chuyển khoản; tổ chức tài khoản, danh mục, ngân sách, khoản vay/nợ; theo dõi số dư và xem báo cáo.

Ứng dụng lưu dữ liệu trên MongoDB. Các API tài chính yêu cầu đăng nhập và giới hạn dữ liệu theo người dùng hiện tại.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Giao diện | React 18, TypeScript, Vite, Tailwind CSS |
| API | Node.js 20+, Express, TypeScript |
| Cơ sở dữ liệu | MongoDB, Mongoose |
| Xác thực | JWT, bcrypt; Google Identity Services tùy chọn |
| Biểu đồ | Recharts |
| Kiểm thử API | Node.js test runner, `tsx`, MongoDB |
| Triển khai container | Docker, Docker Compose |
| Giám sát | Prometheus, `prom-client` |

## Tính năng

- **Tổng quan:** tổng thu, tổng chi, số dư, biểu đồ, giao dịch gần đây và cảnh báo.
- **Giao dịch:** tạo, xem, lọc, tìm kiếm, sửa, xóa và xuất CSV cho khoản thu, khoản chi và chuyển khoản.
- **Tài khoản:** quản lý tài khoản tiền mặt, ngân hàng, ví điện tử và số dư tính từ sổ giao dịch.
- **Danh mục:** phân loại thu nhập/chi tiêu bằng danh mục hệ thống hoặc danh mục cá nhân.
- **Ngân sách:** đặt hạn mức theo danh mục chi tiêu và khoảng ngày; theo dõi số đã dùng, còn lại và cảnh báo.
- **Vay & nợ:** quản lý khoản vay/cho vay, thanh toán, số còn lại và ngày đến hạn.
- **Báo cáo:** xem tổng hợp thu chi, xu hướng theo tháng, chi tiêu theo danh mục và xuất CSV.
- **Thông báo:** xem cảnh báo ngân sách và khoản nợ; đánh dấu đã đọc.
- **Hồ sơ:** cập nhật tên, số điện thoại, ngày sinh và ảnh đại diện; email đăng nhập chỉ đọc.
- **Giao diện:** avatar mặc định, menu tài khoản, chế độ sáng/tối được lưu trong trình duyệt.
- **Chatbot:** hỗ trợ câu hỏi về tính năng FinTrack dựa trên nội dung đã xác minh.
- **Đăng nhập:** email/mật khẩu; đăng nhập Google nếu đã cấu hình.

Các thao tác chuyển tiền, số dư và mức sử dụng ngân sách được kiểm tra ở backend. Chuyển khoản không được cộng vào thu nhập/chi tiêu hoặc mức dùng ngân sách. Tiền tệ hiện được hỗ trợ là VND và số tiền giao dịch là số nguyên dương.

## Kiến trúc dự án

```text
client/                  Ứng dụng React/Vite
  src/components/        Thành phần giao diện tái sử dụng
  src/pages/             Các trang giao diện
  src/services/          Kết nối API từ trình duyệt
server/                  API Express/TypeScript
  src/config/            Cấu hình môi trường
  src/middleware/        Xác thực và middleware
  src/models/             Mô hình MongoDB
  src/routes/             API theo chức năng
  src/services/           Logic dùng chung, chatbot
  tests/                  Kiểm thử API và luồng nghiệp vụ
docs/                     Tài liệu API, cơ sở dữ liệu, use case
public/                   Tài nguyên tĩnh phục vụ API/web
docker-compose.yml        Cấu hình ứng dụng, MongoDB, Prometheus
Dockerfile                Build và chạy ứng dụng dạng container
```

## Yêu cầu

- Node.js 20 trở lên và npm.
- MongoDB Atlas hoặc MongoDB chạy dưới dạng replica set. Replica set cần thiết cho các thao tác dùng transaction nhiều tài liệu.
- Docker Engine và Docker Compose plugin nếu chạy bằng container.

## Chạy trên máy cá nhân

Mở PowerShell tại thư mục dự án:

```powershell
npm install
Copy-Item server\.env.example server\.env
```

Mở `server\.env`, đặt `JWT_SECRET` thành chuỗi ngẫu nhiên dài và cấu hình `MONGODB_URI` trỏ đến MongoDB của bạn. Để thử với dữ liệu demo:

```powershell
npm run seed --workspace server
```

Khởi động API và giao diện:

```powershell
npm run dev
```

- Giao diện Vite: `http://localhost:5173`
- API mặc định: `http://localhost:4000`
- Kiểm tra API: `http://localhost:4000/api/health`

Vite chuyển tiếp các yêu cầu `/api` tới backend. Cổng mặc định có thể được ghi đè bằng cấu hình môi trường trong workspace client.

Lệnh seed có thể chạy lại và tạo người dùng demo `demo@fintrack.local` với mật khẩu `password123` cùng dữ liệu mẫu tài chính. **Chỉ dùng thông tin demo ở môi trường phát triển; không dùng mật khẩu này trong môi trường thật.**

## Cấu hình môi trường

### Backend cục bộ

Các biến được đọc từ `server\.env`:

| Biến | Mục đích | Mặc định / ghi chú |
|---|---|---|
| `PORT` | Cổng API | `4000` |
| `JWT_SECRET` | Ký token đăng nhập | Bắt buộc khi chạy production; cần đặt giá trị bí mật mạnh |
| `MONGODB_URI` | Địa chỉ MongoDB | `mongodb://127.0.0.1:27017/fintrack` |
| `CLIENT_ORIGIN` | Origin được phép gọi API | `http://localhost:5173` |
| `GOOGLE_CLIENT_ID` | Bật đăng nhập Google | Để trống nếu không dùng |
| `AI_API_KEY` | Bật sinh câu trả lời qua AI provider | Để trống để dùng câu trả lời từ nguồn dự án đã chọn |
| `AI_API_URL` | URL API tương thích OpenAI | Mặc định `https://api.openai.com/v1/chat/completions` |
| `AI_MODEL` | Tên model | Mặc định `gpt-4o-mini` |

Không đưa khóa bí mật vào mã frontend, không dùng tiền tố `VITE_` cho thông tin bí mật và không commit các tệp `.env`.

### Đăng nhập Google (tùy chọn)

1. Tạo OAuth 2.0 Web client trong Google Cloud Console.
2. Thêm origin của ứng dụng, ví dụ `http://localhost:5173`, vào **Authorized JavaScript origins**.
3. Đặt `GOOGLE_CLIENT_ID` trong `server\.env`.
4. Khởi động lại backend và frontend.

Luồng Google Identity Services dạng ID token chỉ cần client ID. Luồng OAuth redirect riêng của API cần bổ sung `GOOGLE_CLIENT_SECRET` và `GOOGLE_REDIRECT_URI` nếu sử dụng.

## Chạy bằng Docker Compose

Tạo `.env` ở thư mục gốc:

```powershell
Copy-Item .env.example .env
```

Đặt một `JWT_SECRET` mạnh trong `.env`. Có thể bổ sung `GOOGLE_CLIENT_ID` hoặc các biến AI nếu muốn bật các tích hợp tương ứng. Sau đó chạy:

```powershell
docker compose up --build -d
```

| Dịch vụ | Địa chỉ |
|---|---|
| FinTrack | `http://localhost:4010` |
| API health | `http://localhost:4010/api/health` |
| Prometheus | `http://localhost:9090` |

Dừng các dịch vụ:

```powershell
docker compose down
```

Lệnh trên giữ lại dữ liệu. Chỉ thêm `-v` nếu bạn chủ ý xóa các volume MongoDB và Prometheus:

```powershell
docker compose down -v
```

## Kiểm thử và build

Build frontend và backend:

```powershell
npm run build
```

Chạy kiểm thử API và nghiệp vụ (cần MongoDB sẵn sàng theo `MONGODB_URI`):

```powershell
npm test --workspace server
```

Chạy kiểm thử phần Express ở thư mục gốc:

```powershell
npm test
```

## Tài liệu API

Các API được đặt dưới tiền tố `/api/v1`. Route cá nhân yêu cầu header xác thực:

```text
Authorization: Bearer <token>
```

Tài liệu chi tiết:

- [Tài liệu API](./docs/api-documentation.md)
- [Use case và quy trình nghiệp vụ](./docs/use-cases.md)
- [Thiết kế cơ sở dữ liệu](./docs/database-design.md)

API health: `GET /api/health`. Chỉ số Prometheus: `GET /metrics`.

## Chatbot FinTrack

Chatbot nằm ở góc dưới bên phải sau khi người dùng đăng nhập. Chatbot trả lời bằng nội dung chức năng và quy trình FinTrack đã được xác minh; câu hỏi ngoài phạm vi bị từ chối và câu hỏi thiếu nguồn sẽ được báo rõ.

- API: `POST /api/v1/chat`, yêu cầu đăng nhập.
- Giới hạn: 15 yêu cầu mỗi phút cho mỗi người dùng trên mỗi tiến trình API.
- Chatbot không đọc số dư, giao dịch hoặc dữ liệu riêng tư, và không thực hiện thao tác ghi/sửa/xóa.
- Không cấu hình `AI_API_KEY`: dùng các trích đoạn nguồn FinTrack được chọn ở backend.
- Có cấu hình provider: câu hỏi và trích đoạn dự án phù hợp sẽ được gửi tới provider đã cấu hình; dữ liệu tài chính riêng tư và khóa API không được gửi.
- Thông tin giống mật khẩu, token hoặc khóa bí mật bị chặn trước khi xử lý.

Để bật sinh câu trả lời bằng provider OpenAI-compatible, cấu hình `AI_API_KEY` (và tùy chọn `AI_API_URL`, `AI_MODEL`) ở backend; với Docker Compose, khai báo chúng trong `.env` ở thư mục gốc. Không đặt khóa trong biến môi trường frontend.

## Bảo mật và quyền riêng tư

- Mỗi yêu cầu dữ liệu tài chính được xác thực và kiểm tra quyền sở hữu ở API.
- Không lưu thông tin bí mật trong Git; tệp `.env` cục bộ phải được giữ riêng.
- Môi trường production phải có `JWT_SECRET` riêng, đủ mạnh.
- MongoDB không sẵn sàng thì API không khởi chạy; ứng dụng không chuyển sang dữ liệu giả trong bộ nhớ.
- Ảnh hồ sơ được kiểm tra định dạng; email đăng nhập không thể sửa từ trang hồ sơ.
- Nếu bật AI provider bên ngoài, chỉ câu hỏi và đoạn tài liệu dự án liên quan được gửi đi. Hãy xem chính sách dữ liệu của provider trước khi sử dụng.

## Giới hạn hiện tại

- Chatbot chưa kết nối công cụ truy vấn số liệu cá nhân; người dùng xem dữ liệu của mình trong Tổng quan, Giao dịch, Ngân sách hoặc Báo cáo.
- Kho tri thức chatbot là nội dung dự án đã biên soạn, chưa phải hệ thống lập chỉ mục RAG tự động toàn bộ source code.
- Chuyển nhanh giữa các tài khoản đã liên kết chưa được hỗ trợ; người dùng có thể đăng xuất rồi đăng nhập tài khoản khác.
- Cảnh báo ngân sách và ngày đến hạn được tính khi đọc dữ liệu; tác vụ gửi nhắc tự động theo lịch chưa được triển khai.
- Giới hạn tốc độ chatbot đang lưu trong bộ nhớ của từng tiến trình; triển khai nhiều instance cần một rate limiter dùng chung.

## Khắc phục sự cố

### API không kết nối được MongoDB

- Kiểm tra `MONGODB_URI` trong `server\.env`.
- Đảm bảo MongoDB đang chạy và URI hỗ trợ replica set cho các nghiệp vụ dùng transaction.
- API không thể khởi chạy khi MongoDB không truy cập được.

### Giao diện không gọi được API

- Kiểm tra API có đang chạy đúng cổng trong `PORT` không.
- Kiểm tra cấu hình proxy của Vite và `CLIENT_ORIGIN`.
- Mở `http://localhost:4000/api/health` (đổi cổng nếu cấu hình khác) để kiểm tra backend.

### Đăng nhập Google không hiển thị hoặc không hoạt động

- Kiểm tra `GOOGLE_CLIENT_ID` và origin đã khai báo trong Google Cloud Console.
- Khởi động lại dev server sau khi sửa cấu hình.
- Đăng nhập popup cần chính sách `Cross-Origin-Opener-Policy: same-origin-allow-popups`, đã được cấu hình cho Vite và API production.

### Chatbot báo chưa cấu hình hoặc không thể kết nối

- Xác nhận người dùng đã đăng nhập.
- Kiểm tra log backend và kết nối tới provider nếu đã cấu hình `AI_API_KEY`.
- Có thể bỏ trống khóa AI để chatbot trả lời trực tiếp từ nguồn FinTrack đã xác minh.
