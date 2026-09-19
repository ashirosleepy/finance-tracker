export function formatVND(amount) {
  const n = Number(amount) || 0
  return n.toLocaleString('vi-VN') + ' ₫'
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

export const ACCOUNT_TYPE_LABELS = {
  bank: 'Ngân hàng',
  ewallet: 'Ví điện tử',
  cash: 'Tiền mặt',
  savings: 'Tiết kiệm',
}

export const TRANSACTION_TYPE_LABELS = {
  income: 'Thu nhập',
  expense: 'Chi tiêu',
  transfer: 'Chuyển tiền',
  adjustment: 'Điều chỉnh số dư',
  credit_card_charge: 'Chi tiêu thẻ tín dụng',
  credit_card_payment: 'Thanh toán thẻ tín dụng',
  debt_lend: 'Cho vay',
  debt_borrow: 'Đi vay',
  debt_collect: 'Thu nợ',
  debt_repay: 'Trả nợ',
}

export const DEBT_STATUS_LABELS = {
  active: 'Đang nợ',
  paid: 'Đã trả xong',
  overdue: 'Quá hạn',
}
