import { useEffect, useState } from 'react'
import { TRANSACTION_TYPE_LABELS } from '../lib/formatters'
import DateTimePicker from './DateTimePicker'

const TYPE_GROUPS = [
  { value: 'income', label: TRANSACTION_TYPE_LABELS.income },
  { value: 'expense', label: TRANSACTION_TYPE_LABELS.expense },
  { value: 'transfer', label: TRANSACTION_TYPE_LABELS.transfer },
  { value: 'adjustment', label: TRANSACTION_TYPE_LABELS.adjustment },
  { value: 'credit_card_charge', label: TRANSACTION_TYPE_LABELS.credit_card_charge },
  { value: 'credit_card_payment', label: TRANSACTION_TYPE_LABELS.credit_card_payment },
  { value: 'debt_lend', label: TRANSACTION_TYPE_LABELS.debt_lend },
  { value: 'debt_borrow', label: TRANSACTION_TYPE_LABELS.debt_borrow },
]

// Which fields are relevant per type — drives which inputs are shown.
const FIELD_MAP = {
  income: ['toAccount', 'category'],
  expense: ['fromAccount', 'category'],
  transfer: ['fromAccount', 'toAccount'],
  adjustment: ['direction', 'account'],
  credit_card_charge: ['creditCard', 'category'],
  credit_card_payment: ['fromAccount', 'creditCard'],
  debt_lend: ['fromAccount', 'debt'],
  debt_borrow: ['toAccount', 'debt'],
}

const emptyForm = {
  type: 'expense',
  amount: '',
  occurred_at: new Date().toISOString().slice(0, 16),
  from_account_id: '',
  to_account_id: '',
  category_id: '',
  credit_card_id: '',
  debt_id: '',
  description: '',
  note: '',
  adjustment_direction: 'increase',
  affects_balance: true,
}

// Converts a transaction row (as returned by getTransactions, with amount as
// number and occurred_at as ISO string) back into the shape the form edits.
function toFormState(tx) {
  return {
    type: tx.type,
    amount: String(tx.amount ?? ''),
    occurred_at: tx.occurred_at ? new Date(tx.occurred_at).toISOString().slice(0, 16) : emptyForm.occurred_at,
    from_account_id: tx.from_account_id || '',
    to_account_id: tx.to_account_id || '',
    category_id: tx.category_id || '',
    credit_card_id: tx.credit_card_id || '',
    debt_id: tx.debt_id || '',
    description: tx.description || '',
    note: tx.note || '',
    // adjustment rows only ever populate one of from/to; direction is derived
    adjustment_direction: tx.to_account_id ? 'increase' : 'decrease',
    affects_balance: tx.affects_balance ?? true,
  }
}

// Pass `initialData` (a transaction row) to edit it in place instead of
// creating a new one. onSubmit(payload, id) receives the transaction's id
// as the second argument when editing, or undefined when creating.
export default function TransactionForm({ accounts, categories, creditCards, debts, userId, onSubmit, onCancel, initialData }) {
  const [form, setForm] = useState(() => (initialData ? toFormState(initialData) : emptyForm))
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(initialData)
  const fields = FIELD_MAP[form.type] || []

  useEffect(() => {
    setForm(initialData ? toFormState(initialData) : emptyForm)
  }, [initialData])

  function update(patch) {
    setForm((f) => ({ ...f, ...patch }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        user_id: userId,
        type: form.type,
        amount: Number(form.amount),
        occurred_at: new Date(form.occurred_at).toISOString(),
        description: form.description || null,
        note: form.note || null,
        affects_balance: form.affects_balance,
        from_account_id: null,
        to_account_id: null,
        category_id: null,
        credit_card_id: null,
        debt_id: null,
      }

      if (fields.includes('fromAccount')) payload.from_account_id = form.from_account_id || null
      if (fields.includes('toAccount')) payload.to_account_id = form.to_account_id || null
      if (fields.includes('category')) payload.category_id = form.category_id || null
      if (fields.includes('creditCard')) payload.credit_card_id = form.credit_card_id || null
      if (fields.includes('debt')) payload.debt_id = form.debt_id || null
      if (fields.includes('account')) {
        // adjustment: increase -> to_account_id, decrease -> from_account_id
        if (form.adjustment_direction === 'increase') payload.to_account_id = form.from_account_id || null
        else payload.from_account_id = form.from_account_id || null
      }

      if (isEditing) {
        await onSubmit(payload, initialData.id)
      } else {
        await onSubmit(payload)
        setForm(emptyForm)
      }
    } finally {
      setSaving(false)
    }
  }

  const expenseCategories = categories.filter((c) => c.kind === 'expense')
  const incomeCategories = categories.filter((c) => c.kind === 'income')

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {isEditing && (
        <div className="text-sm font-medium text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
          Đang sửa giao dịch
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label">Loại giao dịch</label>
          <select className="input" value={form.type} onChange={(e) => update({ type: e.target.value })}>
            {TYPE_GROUPS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Số tiền (₫)</label>
          <input
            type="number" min="0" step="1" required className="input"
            value={form.amount} onChange={(e) => update({ amount: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Ngày giờ</label>
          <DateTimePicker
            required
            value={form.occurred_at}
            onChange={(v) => update({ occurred_at: v })}
          />
        </div>

        <div className="sm:col-span-2 flex items-start gap-2 bg-slate-50 rounded-lg px-3 py-2">
          <input
            id="affects_balance" type="checkbox" className="mt-1"
            checked={!form.affects_balance}
            onChange={(e) => update({ affects_balance: !e.target.checked })}
          />
          <label htmlFor="affects_balance" className="text-sm text-slate-600">
            Chỉ ghi nhận để thống kê chi tiêu (ví dụ: giao dịch trong quá khứ) — không cộng/trừ vào số dư hiện tại
          </label>
        </div>

        {form.type === 'adjustment' && (
          <div>
            <label className="label">Hướng điều chỉnh</label>
            <select className="input" value={form.adjustment_direction}
              onChange={(e) => update({ adjustment_direction: e.target.value })}>
              <option value="increase">Tăng số dư</option>
              <option value="decrease">Giảm số dư</option>
            </select>
          </div>
        )}

        {(fields.includes('fromAccount') || fields.includes('account')) && (
          <div>
            <label className="label">{form.type === 'adjustment' ? 'Tài khoản' : 'Tài khoản nguồn'}</label>
            <select className="input" required value={form.from_account_id}
              onChange={(e) => update({ from_account_id: e.target.value })}>
              <option value="">-- Chọn tài khoản --</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        {fields.includes('toAccount') && (
          <div>
            <label className="label">Tài khoản đích</label>
            <select className="input" required value={form.to_account_id}
              onChange={(e) => update({ to_account_id: e.target.value })}>
              <option value="">-- Chọn tài khoản --</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        )}

        {fields.includes('category') && (
          <div>
            <label className="label">Danh mục</label>
            <select className="input" value={form.category_id} onChange={(e) => update({ category_id: e.target.value })}>
              <option value="">-- Không chọn --</option>
              {(form.type === 'income' ? incomeCategories : expenseCategories).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {fields.includes('creditCard') && (
          <div>
            <label className="label">Thẻ tín dụng</label>
            <select className="input" required value={form.credit_card_id}
              onChange={(e) => update({ credit_card_id: e.target.value })}>
              <option value="">-- Chọn thẻ --</option>
              {creditCards.map((c) => <option key={c.credit_card_id} value={c.credit_card_id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {fields.includes('debt') && (
          <div>
            <label className="label">Khoản nợ liên quan</label>
            <select className="input" required value={form.debt_id}
              onChange={(e) => update({ debt_id: e.target.value })}>
              <option value="">-- Chọn khoản nợ --</option>
              {debts.map((d) => <option key={d.debt_id} value={d.debt_id}>{d.person_name} ({d.direction === 'i_owe' ? 'tôi nợ' : 'nợ tôi'})</option>)}
            </select>
            <p className="text-sm text-slate-400 mt-1">Chưa có khoản nợ phù hợp? Tạo trước ở trang "Nợ".</p>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="label">Mô tả</label>
          <input className="input" value={form.description} onChange={(e) => update({ description: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Ghi chú</label>
          <input className="input" value={form.note} onChange={(e) => update({ note: e.target.value })} />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel}>Hủy</button>}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Đang lưu...' : isEditing ? 'Cập nhật giao dịch' : 'Lưu giao dịch'}
        </button>
      </div>
    </form>
  )
}
