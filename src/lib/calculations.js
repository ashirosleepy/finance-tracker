// All calculations here read already-fetched data (from the DB views / tables)
// and never touch the database themselves — keeps the money-math testable
// and in one place, per the "single source of truth" rule.

// Types that count as real expense (spending), matching the design doc.
const EXPENSE_TYPES = new Set(['expense', 'credit_card_charge'])
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

export function computeLiabilityTotals(debtBalances, creditCardBalances) {
  let debtIOwe = 0
  let debtOwedToMe = 0
  for (const d of debtBalances) {
    if (d.direction === 'i_owe') debtIOwe += Number(d.remaining_amount)
    else debtOwedToMe += Number(d.remaining_amount)
  }
  const creditCardDebt = creditCardBalances.reduce((sum, c) => sum + Number(c.used_balance), 0)
  const totalLiabilities = debtIOwe + creditCardDebt
  return { debtIOwe, debtOwedToMe, creditCardDebt, totalLiabilities }
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

export function buildForecast({ currentLiquid, recurringPayments, debtBalances, plannedIncomeByMonths = {} }) {
  return [3, 6, 12].map((months) => {
    const recurringOut = forecastRecurringOutflow(recurringPayments, months)
    const debtOut = forecastDebtOutflow(debtBalances, months)
    const plannedIncome = plannedIncomeByMonths[months] || 0
    const projected = currentLiquid + plannedIncome - recurringOut - debtOut
    return { months, plannedIncome, recurringOut, debtOut, projected }
  })
}
