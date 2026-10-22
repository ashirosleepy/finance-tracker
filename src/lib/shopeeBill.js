// Quy tắc hóa đơn Shopee trả sau — một nguồn sự thật duy nhất.
//   - Mỗi tháng một hóa đơn, chốt ngày 24.
//   - Hạn trả là ngày 10 của tháng sau ngày chốt.
//   - Thanh toán cả hóa đơn một lần.
// Hóa đơn được gọi tên theo THÁNG CHỐT: hóa đơn "tháng 11" chốt 24/11, hạn 10/12.

export const SHOPEE_STATEMENT_DAY = 24
export const SHOPEE_DUE_DAY = 10

const pad = (n) => String(n).padStart(2, '0')
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`

// Hóa đơn có tháng chốt là (year, month), month = 1..12.
export function billOf(year, month) {
  const dueYear = month === 12 ? year + 1 : year
  const dueMonth = month === 12 ? 1 : month + 1
  return {
    key: `${year}-${pad(month)}`,
    year,
    month,
    statementDate: iso(year, month, SHOPEE_STATEMENT_DAY),
    dueDate: iso(dueYear, dueMonth, SHOPEE_DUE_DAY),
  }
}

// Hóa đơn thứ n tháng sau `bill` (n có thể âm).
export function addBillMonths(bill, n) {
  const idx = bill.year * 12 + (bill.month - 1) + n
  return billOf(Math.floor(idx / 12), (idx % 12) + 1)
}

// Giao dịch mua vào ngày isoDate thuộc hóa đơn nào.
// Ngày <= 24 → hóa đơn chốt tháng đó; ngày > 24 → hóa đơn chốt tháng sau.
// isoDate phải là ngày LOCAL dạng 'YYYY-MM-DD' (dùng localISO(new Date(t.occurred_at))),
// không cắt chuỗi UTC để tránh lệch ngày với giờ Việt Nam.
export function billForDate(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  if (d <= SHOPEE_STATEMENT_DAY) return billOf(y, m)
  return m === 12 ? billOf(y + 1, 1) : billOf(y, m + 1)
}

// Đưa một ngày hạn bất kỳ về ngày hạn trả hợp lệ (ngày 10).
// Ngày <= 10 → ngày 10 cùng tháng; ngày > 10 → ngày 10 tháng sau.
export function snapDueDate(isoDate) {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number)
  if (d <= SHOPEE_DUE_DAY) return iso(y, m, SHOPEE_DUE_DAY)
  return m === 12 ? iso(y + 1, 1, SHOPEE_DUE_DAY) : iso(y, m + 1, SHOPEE_DUE_DAY)
}

// Kỳ trả góp có hạn trả dueISO thuộc hóa đơn chốt vào tháng liền trước tháng hạn.
// Tự đưa ngày về ngày 10 nên dữ liệu cũ (hạn ngày khác) vẫn xếp được vào hóa đơn.
export function billForDueDate(dueISO) {
  const [y, m] = snapDueDate(dueISO).split('-').map(Number)
  return m === 1 ? billOf(y - 1, 12) : billOf(y, m - 1)
}
