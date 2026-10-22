// All calculations here read already-fetched data (from the DB views / tables)
// and never touch the database themselves — keeps the money-math testable
// and in one place, per the "single source of truth" rule.

// Types that count as real expense (spending), matching the design doc.
// bnpl_charge = mua bằng Shopee trả sau: tính là chi tiêu ngay lúc mua (giống credit_card_charge).
// bnpl_payment (trả nợ/kỳ góp) KHÔNG tính vì chỉ là chuyển tiền để trả khoản đã ghi nhận.
const EXPENSE_TYPES = new Set(['expense', 'credit_card_charge', 'bnpl_charge'])
const INCOME_TYPES = new Set(['income'])

export function computeAssetTotals(accountBalances) {
  const totals = { bank: 0, ewallet: 0, cash: 0, savings: 0 }
  for (const a of accountBalances) {
    totals[a.type] = (totals[a.type] || 0) + Number(a.current_balance)
  }
  const liquidTotal = totals.bank + totals.ewallet + totals.cash
  const realAssetsTotal = liquidTotal + totals.savings // "tài sản thực tế" — không gồm khoản người khác nợ
  return { ...totals, liquidTotal, realAssetsTotal }
}

export function computeLiabilityTotals(debtBalances, creditCardBalances, bnplBalances = []) {
  let debtIOwe = 0
  let debtOwedToMe = 0
  for (const d of debtBalances) {
    if (d.direction === 'i_owe') debtIOwe += Number(d.remaining_amount)
    else debtOwedToMe += Number(d.remaining_amount)
  }
  const creditCardDebt = creditCardBalances.reduce((sum, c) => sum + Number(c.used_balance), 0)
  const bnplDebt = bnplBalances.reduce((sum, b) => sum + Number(b.used_balance), 0)
  const totalLiabilities = debtIOwe + creditCardDebt + bnplDebt
  return { debtIOwe, debtOwedToMe, creditCardDebt, bnplDebt, totalLiabilities }
}

// Net Worth = (real assets + money owed to me) - (money I owe + credit card debt)
// This matches the worked example in the spec, and deliberately differs from
// "real assets" (the liquid total), which is shown as a separate headline number.
export function computeNetWorth(realAssetsTotal, debtOwedToMe, totalLiabilities) {
  return realAssetsTotal + debtOwedToMe - totalLiabilities
}

export function sumByTypeInRange(transactions, types, start, end) {
  return transactions
    .filter((t) => {
      const d = new Date(t.occurred_at)
      return types.has(t.type) && (!start || d >= start) && (!end || d <= end)
    })
    .reduce((sum, t) => sum + Number(t.amount), 0)
}

export function totalIncome(transactions, start, end) {
  return sumByTypeInRange(transactions, INCOME_TYPES, start, end)
}

export function totalExpense(transactions, start, end) {
  return sumByTypeInRange(transactions, EXPENSE_TYPES, start, end)
}

export function expenseByCategory(transactions, start, end) {
  const map = {}
  for (const t of transactions) {
    if (!EXPENSE_TYPES.has(t.type)) continue
    const d = new Date(t.occurred_at)
    if (start && d < start) continue
    if (end && d > end) continue
    const name = t.category?.name || 'Khác'
    map[name] = (map[name] || 0) + Number(t.amount)
  }
  return Object.entries(map).map(([name, value]) => ({ name, value }))
}

export function startOfWeek(date = new Date()) {
  const d = new Date(date)
  const day = d.getDay() === 0 ? 7 : d.getDay() // Monday-start week
  d.setDate(d.getDate() - day + 1)
  d.setHours(0, 0, 0, 0)
  return d
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1)
}

// -----------------------------------------------------------------------
// Forecast: projects net liquid balance forward without assuming a fixed
// salary. Only uses: current balance, recurring payments due in the window,
// and debts (i_owe) due in the window. Planned/expected income can optionally
// be passed in — it is NEVER assumed automatically.
// -----------------------------------------------------------------------
export function forecastRecurringOutflow(recurringPayments, monthsAhead) {
  const end = new Date()
  end.setMonth(end.getMonth() + monthsAhead)
  let total = 0
  for (const rp of recurringPayments) {
    if (rp.status !== 'active') continue
    let due = new Date(rp.next_due_date)
    while (due <= end) {
      total += Number(rp.amount)
      due = new Date(nextDate(due, rp.frequency, rp.interval_days))
    }
  }
  return total
}

function nextDate(date, frequency, intervalDays) {
  const d = new Date(date)
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break
    case 'weekly': d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break
    default: d.setDate(d.getDate() + (intervalDays || 30))
  }
  return d
}

export function forecastDebtOutflow(debtBalances, monthsAhead) {
  const end = new Date()
  end.setMonth(end.getMonth() + monthsAhead)
  return debtBalances
    .filter((d) => d.direction === 'i_owe' && d.due_date && new Date(d.due_date) <= end)
    .reduce((sum, d) => sum + Number(d.remaining_amount), 0)
}

export function buildForecast({ currentLiquid, recurringPayments, debtBalances, installments = [], plannedIncomeByMonths = {} }) {
  return [3, 6, 12].map((months) => {
    const recurringOut = forecastRecurringOutflow(recurringPayments, months)
    const debtOut = forecastDebtOutflow(debtBalances, months)
    const installmentOut = forecastInstallmentOutflow(installments, months)
    const plannedIncome = plannedIncomeByMonths[months] || 0
    const projected = currentLiquid + plannedIncome - recurringOut - debtOut - installmentOut
    return { months, plannedIncome, recurringOut, debtOut, installmentOut, projected }
  })
}

// -----------------------------------------------------------------------
// Shopee trả sau (BNPL) & trả góp
// -----------------------------------------------------------------------
// "YYYY-MM-DD" theo giờ LOCAL (toISOString() sẽ ra giờ UTC, có thể lệch ngày).
export function localISO(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function computeBnplTotals(bnplBalances) {
  let totalLimit = 0
  let used = 0
  for (const b of bnplBalances) {
    totalLimit += Number(b.credit_limit)
    used += Number(b.used_balance)
  }
  const pct = totalLimit > 0 ? Math.min(100, (used / totalLimit) * 100) : 0
  return { totalLimit, used, available: totalLimit - used, pct }
}

// 'paid' | 'overdue' | 'soon' (trong 7 ngày tới) | 'upcoming'
export function installmentStatus(payment, today = localISO()) {
  if (payment.paid_at) return 'paid'
  if (payment.due_date < today) return 'overdue'
  const soon = new Date()
  soon.setDate(soon.getDate() + 7)
  if (payment.due_date <= localISO(soon)) return 'soon'
  return 'upcoming'
}

// `unpaid` = các kỳ chưa trả (paid_at is null).
export function installmentsDueInMonth(unpaid, date = new Date()) {
  const prefix = localISO(date).slice(0, 7)
  return unpaid
    .filter((p) => p.due_date.startsWith(prefix))
    .reduce((sum, p) => sum + Number(p.amount), 0)
}

// Gồm cả kỳ đã quá hạn nhưng chưa trả (vẫn là tiền phải ra).
export function forecastInstallmentOutflow(unpaid, monthsAhead) {
  const end = new Date()
  end.setMonth(end.getMonth() + monthsAhead)
  const endStr = localISO(end)
  return unpaid
    .filter((p) => !p.paid_at && p.due_date <= endStr)
    .reduce((sum, p) => sum + Number(p.amount), 0)
}

// Số tiền trả góp theo từng tháng (tháng đầu gồm cả kỳ quá hạn chưa trả).
export function installmentsByMonth(unpaid, monthsAhead = 6, now = new Date()) {
  const out = []
  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    const prefix = localISO(d).slice(0, 7)
    const value = unpaid
      .filter((p) => (i === 0 ? p.due_date.slice(0, 7) <= prefix : p.due_date.startsWith(prefix)))
      .reduce((sum, p) => sum + Number(p.amount), 0)
    out.push({ month: `${d.getMonth() + 1}/${d.getFullYear()}`, 'Phải trả': value })
  }
  return out
}
