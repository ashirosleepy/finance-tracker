# Quản lý tài chính cá nhân

Website quản lý tài chính cá nhân cho 1 người dùng. React + Vite + Tailwind CSS ở frontend,
Supabase (Auth + PostgreSQL + Row Level Security) ở backend, host miễn phí trên GitHub Pages.

## 1. Cấu trúc thư mục

```
finance-tracker/
├── supabase/
│   ├── migrations/0001_init.sql   # toàn bộ schema, view tính số dư, RLS policy
│   └── seed.sql                   # dữ liệu mẫu để kiểm thử
├── public/
│   └── 404.html                   # cho phép routing hoạt động đúng trên GitHub Pages
├── src/
│   ├── components/                # Layout, form, table, các UI dùng chung
│   ├── context/AuthContext.jsx    # quản lý session đăng nhập
│   ├── lib/
│   │   ├── queries.js             # toàn bộ lệnh gọi Supabase (data access layer)
│   │   ├── calculations.js        # công thức tài sản / nợ / net worth / dự báo
│   │   └── formatters.js          # định dạng tiền tệ, ngày tháng, nhãn hiển thị
│   ├── pages/                     # 1 file cho mỗi trang trong menu
│   ├── App.jsx                    # định tuyến (routing)
│   └── main.jsx                   # entry point
├── .env.example
└── vite.config.js
```

**Nguyên tắc quan trọng nhất trong code:** không có bảng nào lưu "số dư hiện tại" trực tiếp.
Số dư tài khoản, dư nợ thẻ, số nợ còn lại đều được **tính từ bảng `transactions`** thông qua
các SQL view (`account_balances`, `credit_card_balances`, `debt_balances`). Sửa hoặc xóa một
giao dịch → số dư tự cập nhật đúng, không cần logic đồng bộ thủ công ở phía frontend.

## 2. Tạo project Supabase

1. Vào [supabase.com](https://supabase.com) → tạo project mới (free tier).
2. Vào **SQL Editor** → dán toàn bộ nội dung `supabase/migrations/0001_init.sql` → chạy (Run).
   Đây là bước tạo toàn bộ bảng, enum, view và bật Row Level Security.
3. Vào **Project Settings → API** → copy `Project URL` và `anon public` key.

## 3. Kết nối Supabase với frontend

```bash
cp .env.example .env
```

Mở `.env` và điền:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxxx...
```

`.env` đã có trong `.gitignore` — **không commit file này lên GitHub**.

Cài đặt và chạy thử ở local:
```bash
npm install
npm run dev
```

Mở trình duyệt, bấm "Chưa có tài khoản? Đăng ký" để tạo tài khoản đăng nhập đầu tiên
(chính là tài khoản duy nhất của bạn — mọi RLS policy đều khóa theo `auth.uid()` nên
không ai khác xem được dữ liệu của bạn kể cả khi biết URL Supabase).

## 4. Nạp dữ liệu mẫu (tùy chọn, để kiểm thử)

1. Đăng ký/đăng nhập vào app một lần (để có user trong Supabase Auth).
2. Mở `supabase/seed.sql`, sửa dòng `'YOUR_EMAIL_HERE'` thành email bạn vừa đăng ký.
3. Chạy file này trong SQL Editor của Supabase.

Dữ liệu mẫu bao gồm đủ các trường hợp: thu nhập không đều (freelance), chi tiêu thường ngày,
chuyển tiền giữa ngân hàng và ví điện tử, cho vay + được trả một phần, đi vay, mua hàng bằng
thẻ tín dụng + thanh toán một phần dư nợ thẻ, khoản phải trả hàng tháng (tiền phòng, internet),
và chuyển tiền vào tài khoản tiết kiệm.

## 5. Deploy lên GitHub Pages

1. Tạo repo GitHub mới, ví dụ tên `finance-tracker`.
2. Nếu bạn đặt tên repo khác, sửa `base: '/finance-tracker/'` trong `vite.config.js` và
   `basename="/finance-tracker"` trong `src/App.jsx` cho khớp tên repo.
3. Push code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<username>/finance-tracker.git
   git push -u origin main
   ```
4. Deploy:
   ```bash
   npm run deploy
   ```
   Lệnh này build project (`vite build`) và đẩy thư mục `dist/` lên nhánh `gh-pages`
   (nhờ package `gh-pages` đã có sẵn trong `package.json`).
5. Vào repo trên GitHub → **Settings → Pages** → Source chọn nhánh `gh-pages`, thư mục `/ (root)`.
6. Sau vài phút, trang sẽ chạy tại `https://<username>.github.io/finance-tracker/`.

**Lưu ý:** biến môi trường `.env` không được đẩy lên GitHub Pages (vì đó là static hosting, không
có server). Khi chạy `npm run deploy`, Vite sẽ nhúng giá trị `.env` **tại thời điểm build** vào
file JS — nghĩa là URL/anon key của Supabase sẽ nằm trong mã nguồn JS công khai. Điều này **an
toàn** vì `anon key` được thiết kế để lộ ra frontend — chính Row Level Security mới là lớp bảo vệ
dữ liệu, không phải việc giấu key.

## 6. Cập nhật website sau mỗi lần sửa code

```bash
git add .
git commit -m "Mô tả thay đổi"
git push
npm run deploy
```

`npm run deploy` luôn build lại từ code mới nhất và ghi đè nhánh `gh-pages` — không cần thao tác
gì thêm trên GitHub. Dữ liệu tài chính của bạn nằm hoàn toàn trên Supabase (không nằm trong code),
nên sẽ **không bao giờ mất dữ liệu** khi bạn cập nhật/deploy lại frontend.

## 7. Kiểm tra Row Level Security

Cách nhanh nhất để tự kiểm chứng RLS hoạt động đúng:

1. Vào Supabase → **Authentication** → tạo thêm 1 user thử nghiệm thứ hai (email bất kỳ).
2. Đăng nhập vào app bằng user thứ hai này.
3. Nếu bạn thấy dashboard trống trơn (không thấy giao dịch/tài khoản của user đầu tiên) →
   RLS đang hoạt động đúng.
4. Kiểm tra sâu hơn trong Supabase: vào **Table Editor** → mở bảng `transactions` → cột
   `user_id` phải khác nhau giữa các dòng tùy theo ai tạo ra chúng — nhưng khi app gọi
   `select * from transactions`, Postgres tự động lọc theo `auth.uid()` nhờ policy
   `for all using (auth.uid() = user_id)`, nên mỗi user chỉ thấy đúng dòng của mình dù
   code frontend không hề tự thêm điều kiện lọc `user_id` vào câu query.
5. Nếu muốn chắc chắn hơn nữa, vào **SQL Editor**, chạy `set role authenticated;` rồi thử
   `select * from transactions` — Supabase SQL Editor mặc định chạy với quyền `service_role`
   (bỏ qua RLS) nên cách kiểm tra đáng tin cậy nhất vẫn là đăng nhập bằng 2 tài khoản thật
   như bước 1–3.

## 8. Ghi chú về các luồng tiền dễ nhầm (đã xử lý trong code)

| Tình huống | Cách xử lý |
|---|---|
| Chuyển tiền giữa 2 tài khoản của mình | type = `transfer`, không tính vào báo cáo thu/chi |
| Mua hàng bằng thẻ tín dụng | type = `credit_card_charge`, tính là chi tiêu thật, KHÔNG trừ tiền ngân hàng |
| Thanh toán dư nợ thẻ tín dụng | type = `credit_card_payment`, trừ tiền ngân hàng + giảm dư nợ thẻ, KHÔNG tính là chi tiêu (tránh đếm 2 lần) |
| Chuyển tiền vào tài khoản tiết kiệm | vẫn là `transfer` bình thường (tiết kiệm chỉ là 1 loại tài khoản) |
| Cho người khác vay / đi vay | type = `debt_lend` / `debt_borrow`, không tính thu/chi |
| Thu nợ / trả nợ | type = `debt_collect` / `debt_repay`, không tính thu/chi |
| Dự báo tài chính | không cộng "người khác nợ tôi" cho tới khi thực sự có giao dịch `debt_collect` |
