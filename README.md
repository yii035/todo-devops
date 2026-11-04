# FinTrack

> Ứng dụng quản lý tài chính cá nhân bằng tiếng Việt — theo dõi thu chi, ngân sách, khoản vay/nợ và báo cáo trên cùng một nền tảng.

**FinTrack** gồm giao diện React, API Node.js và cơ sở dữ liệu MongoDB. Bạn có thể chạy nhanh toàn bộ ứng dụng bằng Docker Compose hoặc chạy frontend/backend riêng để phát triển.

| Chạy nhanh | Phát triển |
|---|---|
| Docker Compose | Node.js + MongoDB replica set |
| Ứng dụng: [http://localhost:4011](http://localhost:4011) | Giao diện: [http://localhost:5173](http://localhost:5173) |
| Bao gồm MongoDB, Prometheus và Grafana | API: [http://localhost:4000](http://localhost:4000) |

> **Dữ liệu demo:** sau khi nạp dữ liệu mẫu, đăng nhập bằng `demo@fintrack.local` / `password123`. Chỉ sử dụng tài khoản này trong môi trường phát triển.

## Mục lục

- [Tính năng](#tính-năng)
- [Công nghệ](#công-nghệ)
- [Chạy nhanh bằng Docker Compose](#chạy-nhanh-bằng-docker-compose)
- [Chạy để phát triển](#chạy-để-phát-triển)
- [Cấu hình môi trường](#cấu-hình-môi-trường)
- [Build và kiểm thử](#build-và-kiểm-thử)
- [Tự động đẩy image lên Docker Hub](#tự-động-đẩy-image-lên-docker-hub)
- [API và tài liệu](#api-và-tài-liệu)
- [Prometheus và Grafana](#prometheus-và-grafana)
- [Chatbot](#chatbot)
- [Cấu trúc dự án](#cấu-trúc-dự-án)
- [Bảo mật](#bảo-mật)
- [Khắc phục sự cố](#khắc-phục-sự-cố)

## Tính năng

- **Tổng quan:** số dư, thu chi, biểu đồ, giao dịch gần đây và cảnh báo.
- **Giao dịch:** tạo, tìm kiếm, lọc, chỉnh sửa, xóa và xuất CSV; hỗ trợ thu nhập, chi tiêu và chuyển khoản.
- **Tài khoản và danh mục:** quản lý tài khoản tiền mặt/ngân hàng/ví điện tử và danh mục thu chi.
- **Ngân sách:** đặt hạn mức theo danh mục, theo dõi mức sử dụng và cảnh báo.
- **Vay và nợ:** theo dõi khoản vay/cho vay, thanh toán và ngày đến hạn.
- **Báo cáo, thông báo và hồ sơ:** tổng hợp tài chính, nhắc nhở, cập nhật hồ sơ và ảnh đại diện.
- **Đăng nhập:** email/mật khẩu; Google Identity Services là tùy chọn.
- **Chatbot:** hướng dẫn sử dụng FinTrack dựa trên nội dung dự án đã xác minh.

Các API tài chính yêu cầu đăng nhập và chỉ truy cập dữ liệu của người dùng hiện tại. Chuyển khoản không được tính là thu nhập hoặc chi tiêu. Tiền tệ hiện hỗ trợ là VND.

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | Node.js 20+, Express, TypeScript |
| Cơ sở dữ liệu | MongoDB 7+, Mongoose |
| Xác thực | JWT, bcrypt; Google Identity Services tùy chọn |
| Kiểm thử | Jest và Node.js test runner |
| Container/giám sát | Docker Compose, Prometheus, Grafana |

## Chạy nhanh bằng Docker Compose

Cách này khởi động giao diện, API, MongoDB, Prometheus và Grafana cùng lúc. Cần cài **Docker Desktop** (bao gồm Docker Compose).

1. Mở PowerShell tại thư mục gốc dự án.
2. Tạo tệp cấu hình Docker từ mẫu (nếu chưa có):

   ```powershell
   if (-not (Test-Path .env)) { Copy-Item .env.example .env }
   ```

3. Mở `.env`, thay `JWT_SECRET` bằng một chuỗi ngẫu nhiên dài. Nếu dùng Grafana, hãy thay cả `GRAFANA_PASS`. Không dùng các giá trị mẫu cho môi trường thật.
4. Build và khởi động các dịch vụ:

   ```powershell
   docker compose up --build -d
   ```

5. Đợi các container khởi động, sau đó mở:

   | Dịch vụ | Địa chỉ |
   |---|---|
   | FinTrack (giao diện + API) | [http://localhost:4011](http://localhost:4011) |
   | API health | [http://localhost:4011/api/health](http://localhost:4011/api/health) |
   | Prometheus | [http://localhost:9090](http://localhost:9090) |
   | Grafana | [http://localhost:3000](http://localhost:3000) |

Compose tự khởi tạo MongoDB replica set và lưu dữ liệu trong các Docker volume. Để xem log:

```powershell
docker compose logs -f app
```

Nạp dữ liệu mẫu (tùy chọn) để đăng nhập bằng tài khoản demo:

```powershell
docker compose exec app node server/dist/seed.js
```

Dừng ứng dụng nhưng **giữ lại dữ liệu**:

```powershell
docker compose down
```

Chỉ xóa dữ liệu MongoDB, Prometheus và Grafana khi bạn thực sự muốn làm mới hoàn toàn:

```powershell
docker compose down -v
```

## Chạy để phát triển

### 1. Cài công cụ cần thiết

- Node.js 20 trở lên và npm.
- MongoDB chạy như **replica set** (cần thiết cho các nghiệp vụ dùng transaction).
- Docker Desktop để chạy MongoDB theo cách bên dưới; hoặc dùng một MongoDB Atlas cluster.

Mở PowerShell tại thư mục gốc dự án rồi cài các dependency:

```powershell
npm ci
```

### 2. Khởi động MongoDB

**Dùng Docker Desktop:** tạo một MongoDB replica set dùng riêng cho môi trường phát triển:

```powershell
docker run --name fintrack-mongo -d -p 27017:27017 mongo:7.0 mongod --replSet rs0 --bind_ip_all
Start-Sleep -Seconds 5
docker exec fintrack-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})'
```

Nếu container `fintrack-mongo` đã tồn tại, khởi động lại bằng `docker start fintrack-mongo` thay vì chạy lại lệnh `docker run`.

**Dùng MongoDB Atlas:** tạo cluster, lấy connection string và dùng URI đó ở bước tiếp theo. Atlas cluster mặc định hỗ trợ replica set.

### 3. Cấu hình backend

Tạo `server\.env` từ tệp mẫu một lần:

```powershell
if (-not (Test-Path server\.env)) { Copy-Item server\.env.example server\.env }
```

Mở `server\.env` và kiểm tra `MONGODB_URI`. Với MongoDB local theo bước trên, giữ giá trị mặc định `mongodb://127.0.0.1:27017/fintrack`. Nếu dùng Atlas, thay bằng URI của cluster. Bạn cũng nên thay `JWT_SECRET` bằng chuỗi bí mật riêng.

### 4. Nạp dữ liệu mẫu (tùy chọn)

```powershell
npm run seed --workspace server
```

Lệnh này tạo tài khoản demo `demo@fintrack.local` / `password123` cùng dữ liệu tài chính mẫu. Có thể chạy lại để bổ sung dữ liệu mẫu; không dùng tài khoản hoặc mật khẩu này trong production.

### 5. Chạy frontend và backend

```powershell
npm run dev
```

Lệnh trên khởi động cả API và Vite. Mở giao diện tại [http://localhost:5173](http://localhost:5173). Vite chuyển tiếp `/api` đến backend tại `http://localhost:4000`; kiểm tra backend tại [http://localhost:4000/api/health](http://localhost:4000/api/health).

Nhấn `Ctrl+C` trong terminal để dừng các tiến trình phát triển.

## Cấu hình môi trường

### Backend chạy local (`server\.env`)

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `PORT` | `4000` | Cổng API local |
| `JWT_SECRET` | Khóa phát triển mặc định | Đặt khóa riêng; bắt buộc trong production |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/fintrack` | MongoDB phải hỗ trợ replica set |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Origin frontend được phép gọi API |
| `GOOGLE_CLIENT_ID` | Trống | Chỉ cần nếu bật đăng nhập Google |
| `AI_API_KEY` | Trống | Để trống để chatbot dùng nguồn FinTrack tích hợp |
| `AI_API_URL` | `https://api.openai.com/v1/chat/completions` | API tương thích OpenAI, tùy chọn |
| `AI_MODEL` | `gpt-4o-mini` | Model của AI provider, tùy chọn |

### Docker Compose (`.env` ở thư mục gốc)

Compose yêu cầu `JWT_SECRET`. Các biến tùy chọn được khai báo trong [`.env.example`](./.env.example):

| Biến | Mục đích |
|---|---|
| `JWT_SECRET` | Khóa ký JWT, bắt buộc |
| `GRAFANA_PASS` | Mật khẩu tài khoản Grafana `admin` |
| `GOOGLE_CLIENT_ID` | Bật đăng nhập Google |
| `AI_API_KEY`, `AI_API_URL`, `AI_MODEL` | Cấu hình AI provider cho chatbot |

Đăng nhập Google cần tạo OAuth 2.0 Web client trong Google Cloud Console, thêm origin của ứng dụng vào **Authorized JavaScript origins**, đặt `GOOGLE_CLIENT_ID` ở backend rồi khởi động lại ứng dụng. Origin local là `http://localhost:5173`; khi dùng Compose là `http://localhost:4011`.

Không commit `.env`, không đưa khóa bí mật vào frontend và không dùng tiền tố `VITE_` cho thông tin nhạy cảm.

## Build và kiểm thử

Build frontend và backend:

```powershell
npm run build
```

Chạy kiểm thử backend (MongoDB phải hoạt động và `MONGODB_URI` phải trỏ đúng cơ sở dữ liệu):

```powershell
npm test --workspace server
```

Chạy kiểm thử Express ở thư mục gốc:

```powershell
npm test
```

## Tự động đẩy image lên Docker Hub

Workflow GitHub Actions sẽ build và đẩy image `fintrack` lên Docker Hub sau khi build, kiểm thử và smoke test thành công:

- Push lên nhánh mặc định `master`: đẩy tag `latest` và `master`.
- Push Git tag bắt đầu bằng `v` (ví dụ `v1.2.0`): đẩy tag image tương ứng.
- Pull request và các nhánh khác không đẩy image.

Thiết lập một lần trong GitHub:

1. Tạo repository `fintrack` trên Docker Hub.
2. Tạo Docker Hub access token có quyền **Read & Write**.
3. Trong GitHub, mở **Settings → Secrets and variables → Actions → New repository secret** và thêm:
   - `DOCKERHUB_USERNAME`: Docker Hub username.
   - `DOCKERHUB_TOKEN`: access token vừa tạo (không dùng mật khẩu tài khoản).
4. Push thay đổi lên `master` để workflow tự chạy. Để phát hành một phiên bản, tạo và push tag:

   ```powershell
   git tag v1.2.0
   git push origin v1.2.0
   ```

Sau khi chạy thành công, image sẽ có dạng `DOCKERHUB_USERNAME/fintrack:latest` hoặc `DOCKERHUB_USERNAME/fintrack:v1.2.0`. Thay `DOCKERHUB_USERNAME` bằng username Docker Hub của bạn khi pull image.

## API và tài liệu

Các API chức năng nằm dưới tiền tố `/api/v1`. Route cần đăng nhập yêu cầu token dạng `Authorization: Bearer <token>`.

- **Health check:** `GET /api/health`
- **Prometheus metrics:** `GET /metrics`
- [Tài liệu API](./docs/api-documentation.md)
- [Use case và quy trình nghiệp vụ](./docs/use-cases.md)
- [Thiết kế cơ sở dữ liệu](./docs/database-design.md)

## Prometheus và Grafana

Prometheus và Grafana được khởi động cùng Docker Compose. Prometheus lấy metrics từ API tại `/metrics`; kiểm tra trạng thái scrape ở [http://localhost:9090/targets](http://localhost:9090/targets), target `fintrack-app` cần ở trạng thái **UP**.

Đăng nhập Grafana tại [http://localhost:3000](http://localhost:3000) với tên `admin` và mật khẩu trong `GRAFANA_PASS` (mặc định trong cấu hình mẫu là `change-this-to-a-strong-password`). Thêm data source Prometheus với URL `http://prometheus:9090`. Ví dụ truy vấn:

```promql
rate(fintrack_http_requests_total[5m])
```

Endpoint `/metrics` không yêu cầu JWT. Nhãn route dùng mẫu đã khớp, tránh đưa ID thay đổi liên tục vào metrics.

## Chatbot

Chatbot xuất hiện sau khi người dùng đăng nhập. API `POST /api/v1/chat` chỉ hướng dẫn về tính năng và quy trình FinTrack; hiện không truy vấn dữ liệu tài chính cá nhân và không thực hiện thao tác ghi/sửa/xóa. Chatbot giới hạn 15 yêu cầu mỗi phút trên mỗi người dùng, mỗi tiến trình API.

Không cấu hình `AI_API_KEY`: chatbot trả lời từ nội dung FinTrack tích hợp. Khi bật AI provider, câu hỏi và trích đoạn tài liệu dự án phù hợp được gửi tới provider; dữ liệu tài chính riêng tư và khóa API không được gửi.

## Cấu trúc dự án

```text
client/                  Giao diện React/Vite
  src/components/        Thành phần giao diện
  src/pages/             Các trang ứng dụng
  src/services/          Kết nối API
server/                  API Express/TypeScript
  src/config/            Cấu hình môi trường
  src/models/            Mô hình MongoDB
  src/routes/             API theo chức năng
  src/services/           Chatbot và logic dùng chung
  tests/                  Kiểm thử backend
docs/                     Tài liệu API, use case, cơ sở dữ liệu
docker-compose.yml        Ứng dụng, MongoDB, Prometheus, Grafana
Dockerfile                Build ứng dụng dạng container
```

## Bảo mật

- Mỗi yêu cầu tài chính được xác thực và giới hạn theo người dùng.
- MongoDB không truy cập được thì backend không khởi động; ứng dụng không tự chuyển sang dữ liệu giả.
- Dùng `JWT_SECRET` riêng, đủ mạnh cho mọi môi trường triển khai.
- Không commit tệp `.env`, token hoặc khóa API.
- Nếu bật AI provider bên ngoài, hãy xem chính sách dữ liệu của provider trước khi sử dụng.

## Khắc phục sự cố

| Hiện tượng | Cách kiểm tra |
|---|---|
| Backend không kết nối được MongoDB | Kiểm tra MongoDB đang chạy, `MONGODB_URI` đúng và replica set đã khởi tạo. |
| Giao diện không gọi được API | Khi chạy dev, kiểm tra API ở `http://localhost:4000/api/health`, `PORT` và `CLIENT_ORIGIN`. Khi dùng Compose, kiểm tra `http://localhost:4011/api/health` và log bằng `docker compose logs -f app`. |
| Cổng `27017` đã được sử dụng | Dừng dịch vụ MongoDB khác hoặc đổi port được ánh xạ, đồng thời cập nhật `MONGODB_URI`. |
| Container MongoDB đã tồn tại | Dùng `docker start fintrack-mongo` thay vì tạo container cùng tên lần nữa. |
| Đăng nhập Google không hoạt động | Kiểm tra `GOOGLE_CLIENT_ID`, origin trong Google Cloud Console và khởi động lại ứng dụng. |
| Chatbot không gọi được AI provider | Kiểm tra `AI_API_KEY`, `AI_API_URL`, log backend và kết nối mạng. Có thể để trống khóa để dùng câu trả lời tích hợp. |
