import { supabase } from '../supabaseClient'

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export async function getAccounts() {
  const { data, error } = await supabase.from('accounts').select('*').order('created_at')
  if (error) throw error
  return data
}

// Balances come from the `account_balances` view (computed from transactions),
// never from a stored column.
export async function getAccountBalances() {
  const { data, error } = await supabase.from('account_balances').select('*')
  if (error) throw error
  return data
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
// filters: { fromDate, toDate, type, categoryId, accountId, debtId, creditCardId, search }
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
