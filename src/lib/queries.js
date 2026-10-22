import { supabase } from '../supabaseClient'
import { localISO } from './calculations'

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export async function getAccounts() {
  const { data, error } = await supabase.from('accounts').select('*').order('created_at')
  if (error) throw error
  return data
}

// Balances come from the `account_balances` view (computed from transactions),
// never from a stored column. The view doesn't carry every column on
// `accounts` (e.g. account_number, note), so merge those in from the base
// table — otherwise the edit form for an account loses them on save.
export async function getAccountBalances() {
  const [{ data: balances, error: balErr }, { data: accounts, error: accErr }] = await Promise.all([
    supabase.from('account_balances').select('*'),
    supabase.from('accounts').select('id, account_number, note'),
  ])
  if (balErr) throw balErr
  if (accErr) throw accErr

  const extrasById = new Map(accounts.map((a) => [a.id, a]))
  return balances.map((b) => {
    const extra = extrasById.get(b.account_id)
    return extra
      ? { ...b, account_number: extra.account_number, note: extra.note }
      : b
  })
}

export async function createAccount(account) {
  const { data, error } = await supabase.from('accounts').insert(account).select().single()
  if (error) throw error
  return data
}

export async function updateAccount(id, patch) {
  const { data, error } = await supabase.from('accounts').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteAccount(id) {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
const DEFAULT_CATEGORIES = [
  ['Ăn uống', 'expense'], ['Đi lại', 'expense'], ['Nhà ở', 'expense'],
  ['Điện nước', 'expense'], ['Internet', 'expense'], ['Điện thoại', 'expense'],
  ['Mua sắm', 'expense'], ['Giải trí', 'expense'], ['Học tập', 'expense'],
  ['Game', 'expense'], ['Thiết bị', 'expense'], ['Phần mềm', 'expense'],
  ['Sức khỏe', 'expense'], ['Quà tặng', 'expense'], ['Khác', 'expense'],
  ['Freelance', 'income'], ['Content creator', 'income'], ['Tiền thưởng', 'income'],
  ['Bán đồ', 'income'], ['Hoàn tiền', 'income'], ['Gia đình gửi', 'income'],
  ['Thu nhập khác', 'income'],
]

export async function getCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('name')
  if (error) throw error
  return data
}

// Call once after first login so the user has a starting set of categories.
export async function ensureDefaultCategories(userId) {
  const existing = await getCategories()
  if (existing.length > 0) return existing
  const rows = DEFAULT_CATEGORIES.map(([name, kind]) => ({
    user_id: userId, name, kind, is_default: true,
  }))
  const { data, error } = await supabase.from('categories').insert(rows).select()
  if (error) throw error
  return data
}

export async function createCategory(category) {
  const { data, error } = await supabase.from('categories').insert(category).select().single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------
// filters: { fromDate, toDate, type, categoryId, accountId, debtId, creditCardId, bnplAccountId, search }
export async function getTransactions(filters = {}) {
  let query = supabase
    .from('transactions')
    .select('*, category:categories(id,name,kind), from_account:accounts!transactions_from_account_id_fkey(id,name), to_account:accounts!transactions_to_account_id_fkey(id,name)')
    .order('occurred_at', { ascending: false })

  if (filters.fromDate) query = query.gte('occurred_at', filters.fromDate)
  if (filters.toDate) query = query.lte('occurred_at', filters.toDate)
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.debtId) query = query.eq('debt_id', filters.debtId)
  if (filters.creditCardId) query = query.eq('credit_card_id', filters.creditCardId)
  if (filters.bnplAccountId) query = query.eq('bnpl_account_id', filters.bnplAccountId)
  if (filters.accountId) {
    query = query.or(`from_account_id.eq.${filters.accountId},to_account_id.eq.${filters.accountId}`)
  }
  if (filters.search) query = query.ilike('description', `%${filters.search}%`)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createTransaction(tx) {
  const { data, error } = await supabase.from('transactions').insert(tx).select().single()
  if (error) throw error
  return data
}

export async function updateTransaction(id, patch) {
  const { data, error } = await supabase.from('transactions').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------
export async function getDebtBalances() {
  const { data, error } = await supabase.from('debt_balances').select('*').order('due_date')
  if (error) throw error
  return data
}

export async function createDebt(debt) {
  const { data, error } = await supabase.from('debts').insert(debt).select().single()
  if (error) throw error
  return data
}

export async function updateDebt(id, patch) {
  const { data, error } = await supabase.from('debts').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteDebt(id) {
  const { error } = await supabase.from('debts').delete().eq('id', id)
  if (error) throw error
}

export async function getDebtPayments(debtId) {
  const { data, error } = await supabase
    .from('debt_payments').select('*').eq('debt_id', debtId).order('paid_at', { ascending: false })
  if (error) throw error
  return data
}

// Records a repayment AND the matching cash-movement transaction together.
export async function recordDebtPayment({ userId, debt, amount, accountId, note }) {
  const { error: payErr } = await supabase.from('debt_payments').insert({
    user_id: userId, debt_id: debt.debt_id, amount, note,
  })
  if (payErr) throw payErr

  const isCollect = debt.direction === 'owed_to_me'
  const tx = {
    user_id: userId,
    type: isCollect ? 'debt_collect' : 'debt_repay',
    amount,
    debt_id: debt.debt_id,
    description: isCollect ? `${debt.person_name} trả nợ` : `Trả nợ cho ${debt.person_name}`,
    note,
  }
  if (isCollect) tx.to_account_id = accountId
  else tx.from_account_id = accountId

  const { error: txErr } = await supabase.from('transactions').insert(tx)
  if (txErr) throw txErr
}

// ---------------------------------------------------------------------------
// Credit cards
// ---------------------------------------------------------------------------
export async function getCreditCardBalances() {
  const { data, error } = await supabase.from('credit_card_balances').select('*')
  if (error) throw error
  return data
}

export async function createCreditCard(card) {
  const { data, error } = await supabase.from('credit_cards').insert(card).select().single()
  if (error) throw error
  return data
}

export async function updateCreditCard(id, patch) {
  const { data, error } = await supabase.from('credit_cards').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteCreditCard(id) {
  const { error } = await supabase.from('credit_cards').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Recurring payments
// ---------------------------------------------------------------------------
export async function getRecurringPayments() {
  const { data, error } = await supabase
    .from('recurring_payments').select('*, account:accounts(name), category:categories(name)')
    .order('next_due_date')
  if (error) throw error
  return data
}

export async function createRecurringPayment(rp) {
  const { data, error } = await supabase.from('recurring_payments').insert(rp).select().single()
  if (error) throw error
  return data
}

export async function updateRecurringPayment(id, patch) {
  const { data, error } = await supabase.from('recurring_payments').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteRecurringPayment(id) {
  const { error } = await supabase.from('recurring_payments').delete().eq('id', id)
  if (error) throw error
}

export function computeNextDueDate(currentDue, frequency, intervalDays) {
  const d = new Date(currentDue)
  switch (frequency) {
    case 'daily': d.setDate(d.getDate() + 1); break
    case 'weekly': d.setDate(d.getDate() + 7); break
    case 'monthly': d.setMonth(d.getMonth() + 1); break
    case 'yearly': d.setFullYear(d.getFullYear() + 1); break
    case 'custom': d.setDate(d.getDate() + (intervalDays || 30)); break
    default: d.setMonth(d.getMonth() + 1)
  }
  return d.toISOString().slice(0, 10)
}

// Marks a recurring payment as paid today: creates the expense transaction
// and advances next_due_date, in one call.
export async function markRecurringPaymentPaid(userId, rp) {
  const { error: txErr } = await supabase.from('transactions').insert({
    user_id: userId,
    type: 'expense',
    amount: rp.amount,
    from_account_id: rp.account_id,
    category_id: rp.category_id,
    description: rp.name,
    recurring_payment_id: rp.id,
  })
  if (txErr) throw txErr

  const nextDue = computeNextDueDate(rp.next_due_date, rp.frequency, rp.interval_days)
  return updateRecurringPayment(rp.id, { next_due_date: nextDue })
}

// ---------------------------------------------------------------------------
// Savings goals
// ---------------------------------------------------------------------------
export async function getSavingsGoals() {
  const { data, error } = await supabase.from('savings_goals').select('*, account:accounts(name, opening_balance)')
  if (error) throw error
  return data
}

export async function createSavingsGoal(goal) {
  const { data, error } = await supabase.from('savings_goals').insert(goal).select().single()
  if (error) throw error
  return data
}

export async function updateSavingsGoal(id, patch) {
  const { data, error } = await supabase.from('savings_goals').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Net worth summary (view)
// ---------------------------------------------------------------------------
export async function getNetWorthSummary() {
  const { data, error } = await supabase.from('net_worth_summary').select('*').maybeSingle()
  if (error) throw error
  return data
}

// ---------------------------------------------------------------------------
// Shopee trả sau (BNPL) — hạn mức
// ---------------------------------------------------------------------------
export async function getBnplBalances() {
  const { data, error } = await supabase.from('bnpl_balances').select('*').order('name')
  if (error) throw error
  return data
}

export async function createBnplAccount(account) {
  const { data, error } = await supabase.from('bnpl_accounts').insert(account).select().single()
  if (error) throw error
  return data
}

export async function updateBnplAccount(id, patch) {
  const { data, error } = await supabase.from('bnpl_accounts').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteBnplAccount(id) {
  const { error } = await supabase.from('bnpl_accounts').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Trả góp
// ---------------------------------------------------------------------------
// Cộng n tháng vào "YYYY-MM-DD", kẹp ngày cuối tháng (31/1 + 1 tháng = 28/2).
export function addMonthsISO(iso, n) {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(y, m - 1 + n, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  return localISO(target)
}

export async function getInstallmentPlans() {
  const { data, error } = await supabase
    .from('installment_plan_summary').select('*')
    .order('next_due_date', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data
}

// opts: { planId, unpaidOnly }
export async function getInstallmentPayments({ planId, unpaidOnly } = {}) {
  let query = supabase
    .from('installment_payments')
    .select('*, plan:installment_plans(id,name,months,bnpl_account_id)')
    .order('due_date')
  if (planId) query = query.eq('plan_id', planId)
  if (unpaidOnly) query = query.is('paid_at', null)
  const { data, error } = await query
  if (error) throw error
  return data
}

// Tạo kế hoạch + các kỳ + giao dịch "mua bằng trả sau" (ghi nhận chi tiêu, chưa trừ tiền thật).
// Phần dư do làm tròn dồn vào kỳ cuối.
export async function createInstallmentPlan({
  userId, bnplAccountId, name, totalAmount, months, feeTotal = 0,
  firstDueDate, occurredAt, categoryId = null, note = null,
}) {
  const purchaseDate = occurredAt ? new Date(occurredAt) : new Date()
  const first = firstDueDate || addMonthsISO(localISO(purchaseDate), 1)
  const total = Number(totalAmount)
  const fee = Number(feeTotal) || 0

  const { data: plan, error: planErr } = await supabase.from('installment_plans').insert({
    user_id: userId, bnpl_account_id: bnplAccountId, name,
    total_amount: total, months, fee_total: fee,
    monthly_amount: Math.round((total + fee) / months),
    first_due_date: first, purchased_at: purchaseDate.toISOString(), note,
  }).select().single()
  if (planErr) throw planErr

  const principalBase = Math.floor(total / months)
  const feeBase = Math.floor(fee / months)
  const rows = Array.from({ length: months }, (_, i) => {
    const last = i === months - 1
    return {
      user_id: userId, plan_id: plan.id, period_no: i + 1,
      due_date: addMonthsISO(first, i),
      principal_amount: last ? total - principalBase * (months - 1) : principalBase,
      fee_amount: last ? fee - feeBase * (months - 1) : feeBase,
    }
  })

  const { error: payErr } = await supabase.from('installment_payments').insert(rows)
  if (payErr) {
    await supabase.from('installment_plans').delete().eq('id', plan.id)
    throw payErr
  }

  const { error: txErr } = await supabase.from('transactions').insert({
    user_id: userId, type: 'bnpl_charge', amount: total,
    occurred_at: purchaseDate.toISOString(),
    bnpl_account_id: bnplAccountId, installment_plan_id: plan.id,
    category_id: categoryId, description: name, note,
  })
  if (txErr) {
    await supabase.from('installment_plans').delete().eq('id', plan.id) // cascade xoá các kỳ
    throw txErr
  }
  return plan
}

// Ghi nhận đã trả 1 kỳ: tạo giao dịch trừ tiền từ tài khoản thật + đánh dấu kỳ đã trả.
export async function payInstallment({ userId, plan, payment, accountId }) {
  const { data: tx, error: txErr } = await supabase.from('transactions').insert({
    user_id: userId, type: 'bnpl_payment', amount: payment.amount,
    from_account_id: accountId,
    bnpl_account_id: plan.bnpl_account_id,
    installment_plan_id: plan.plan_id,
    installment_payment_id: payment.id,
    description: `Trả góp ${plan.name} (kỳ ${payment.period_no}/${plan.months})`,
  }).select().single()
  if (txErr) throw txErr

  const { error: upErr } = await supabase.from('installment_payments')
    .update({ paid_at: new Date().toISOString(), transaction_id: tx.id })
    .eq('id', payment.id)
  if (upErr) {
    await supabase.from('transactions').delete().eq('id', tx.id) // hoàn tác
    throw upErr
  }
  return tx
}

// Xoá kế hoạch kèm mọi giao dịch liên quan (mua + các kỳ đã trả) để số dư/hạn mức về đúng.
export async function deleteInstallmentPlan(planId) {
  const { error: txErr } = await supabase.from('transactions').delete().eq('installment_plan_id', planId)
  if (txErr) throw txErr
  const { error } = await supabase.from('installment_plans').delete().eq('id', planId)
  if (error) throw error
}
