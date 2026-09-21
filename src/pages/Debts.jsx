import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getDebtBalances, createDebt, updateDebt, deleteDebt, recordDebtPayment, getAccounts } from '../lib/queries'
import { formatVND, formatDate, DEBT_STATUS_LABELS } from '../lib/formatters'

const emptyForm = { direction: 'owed_to_me', person_name: '', principal_amount: '', due_date: '', note: '' }

// Formats a raw numeric string for display with '.' as thousand separators (e.g. "22000000" -> "22.000.000").
// Keeps the underlying state as plain digits so Number(...) elsewhere still works unchanged.
function formatAmountInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('vi-VN')
}

// Strips everything but digits, so typed '.', ',' or spaces don't end up in the stored value.
function parseAmountInput(value) {
  return String(value ?? '').replace(/\D/g, '')
}

export default function Debts() {
  const { user } = useAuth()
  const [debts, setDebts] = useState([])
  const [accounts, setAccounts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [payingDebt, setPayingDebt] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payAccount, setPayAccount] = useState('')
  const [editingDebt, setEditingDebt] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setDebts(await getDebtBalances())
    setAccounts(await getAccounts())
  }
  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    const debt = await createDebt({
      user_id: user.id,
      direction: form.direction,
      person_name: form.person_name,
      principal_amount: Number(form.principal_amount),
      due_date: form.due_date || null,
      note: form.note || null,
    })
    // record the matching cash movement so the money-flow stays consistent
    if (payAccount) {
      const tx = { user_id: user.id, type: form.direction === 'owed_to_me' ? 'debt_lend' : 'debt_borrow', amount: debt.principal_amount, debt_id: debt.id, description: form.direction === 'owed_to_me' ? `Cho ${debt.person_name} mượn` : `Vay từ ${debt.person_name}` }
      if (form.direction === 'owed_to_me') tx.from_account_id = payAccount
      else tx.to_account_id = payAccount
      const { createTransaction } = await import('../lib/queries')
      await createTransaction(tx)
    }
    setForm(emptyForm); setPayAccount(''); setShowForm(false)
    await load()
  }

  async function handleRecordPayment(e) {
    e.preventDefault()
    if (Number(payAmount) > payingDebt.remaining_amount) {
      alert(`Số tiền không được vượt quá ${formatVND(payingDebt.remaining_amount)}`)
      return
    }
    await recordDebtPayment({
      userId: user.id, debt: payingDebt, amount: Number(payAmount), accountId: payAccount,
    })
    setPayingDebt(null); setPayAmount(''); setPayAccount('')
    await load()
  }

  function openEdit(d) {
    setEditingDebt(d)
    setEditForm({
      direction: d.direction,
      person_name: d.person_name,
      principal_amount: String(d.principal_amount),
      due_date: d.due_date || '',
      note: d.note || '',
    })
  }

  // Edits the debt record itself — person, principal amount, due date, note.
  // This does NOT touch past payments; it only corrects the debt's own data
  // (e.g. you typed the wrong amount, or agreed on a new due date).
  async function handleEditSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateDebt(editingDebt.debt_id, {
        person_name: editForm.person_name,
        principal_amount: Number(editForm.principal_amount),
        due_date: editForm.due_date || null,
        note: editForm.note || null,
      })
      setEditingDebt(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteDebt(d) {
    if (!confirm(`Xóa khoản nợ với ${d.person_name}? Các giao dịch liên quan sẽ không bị xóa.`)) return
    await deleteDebt(d.debt_id)
    if (editingDebt?.debt_id === d.debt_id) setEditingDebt(null)
    await load()
  }

  const iOwe = debts.filter((d) => d.direction === 'i_owe')
  const owedToMe = debts.filter((d) => d.direction === 'owed_to_me')

  function DebtCard({ d }) {
    return (
      <div className="card">
        <div className="flex justify-between items-start">
          <div className="min-w-0">
            <div className="font-medium truncate">{d.person_name}</div>
            <div className="text-sm text-slate-400">
              Từ {formatDate(d.start_date)}{d.due_date && ` · hạn ${formatDate(d.due_date)}`}
            </div>
          </div>
          <span className={`text-sm px-2 py-1 rounded-full whitespace-nowrap ${
            d.status === 'overdue' ? 'bg-red-50 text-red-600' : d.status === 'paid' ? 'bg-slate-100 text-slate-500' : 'bg-amber-50 text-amber-600'
          }`}>{DEBT_STATUS_LABELS[d.status]}</span>
        </div>
        <div className="mt-3 text-base text-slate-500">Gốc: {formatVND(d.principal_amount)} · Đã {d.direction === 'i_owe' ? 'trả' : 'thu'}: {formatVND(d.paid_amount)}</div>
        <div className="text-xl font-semibold mt-1">{formatVND(d.remaining_amount)} <span className="text-sm font-normal text-slate-400">còn lại</span></div>
        <div className="flex flex-wrap gap-2 mt-3">
          {d.status !== 'paid' && (
            <button className="btn-secondary text-sm" onClick={() => setPayingDebt(d)}>
              {d.direction === 'i_owe' ? 'Ghi nhận trả nợ' : 'Ghi nhận thu nợ'}
            </button>
          )}
          <button className="btn-secondary text-sm" onClick={() => openEdit(d)}>Sửa</button>
          <button className="text-sm text-red-500 px-2" onClick={() => handleDeleteDebt(d)}>Xóa</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nợ</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Đóng' : '+ Thêm khoản nợ'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Loại</label>
            <select className="input" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
              <option value="owed_to_me">Người khác nợ tôi</option>
              <option value="i_owe">Tôi nợ người khác</option>
            </select>
          </div>
          <div>
            <label className="label">Tên người</label>
            <input required className="input" value={form.person_name} onChange={(e) => setForm({ ...form, person_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Số tiền (₫)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                className="input pr-8"
                value={formatAmountInput(form.principal_amount)}
                onChange={(e) => setForm({ ...form, principal_amount: parseAmountInput(e.target.value) })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">₫</span>
            </div>
          </div>
          <div>
            <label className="label">Hạn trả (tùy chọn)</label>
            <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Tài khoản {form.direction === 'owed_to_me' ? 'đưa tiền ra' : 'nhận tiền vào'} (tùy chọn — bỏ trống nếu chỉ muốn ghi sổ nợ, không ảnh hưởng số dư)</label>
            <select className="input" value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
              <option value="">-- Không ghi nhận dòng tiền --</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Ghi chú</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="sm:col-span-2 flex justify-end"><button className="btn-primary">Lưu</button></div>
        </form>
      )}

      {payingDebt && (
        <form onSubmit={handleRecordPayment} className="card grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 font-medium">
            {payingDebt.direction === 'i_owe' ? 'Trả nợ cho' : 'Thu nợ từ'} {payingDebt.person_name} — còn lại {formatVND(payingDebt.remaining_amount)}
          </div>
          <div>
            <label className="label">Số tiền (₫)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                className="input pr-8"
                value={formatAmountInput(payAmount)}
                onChange={(e) => setPayAmount(parseAmountInput(e.target.value))}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">₫</span>
            </div>
          </div>
          <div>
            <label className="label">Tài khoản</label>
            <select required className="input" value={payAccount} onChange={(e) => setPayAccount(e.target.value)}>
              <option value="">-- Chọn --</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setPayingDebt(null)}>Hủy</button>
            <button className="btn-primary">Xác nhận</button>
          </div>
        </form>
      )}

      {editingDebt && (
        <form onSubmit={handleEditSubmit} className="card grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2 font-medium text-brand-700 bg-brand-50 rounded-lg px-3 py-2">
            Đang sửa khoản nợ với {editingDebt.person_name}
          </div>
          <div>
            <label className="label">Tên người</label>
            <input required className="input" value={editForm.person_name} onChange={(e) => setEditForm({ ...editForm, person_name: e.target.value })} />
          </div>
          <div>
            <label className="label">Số tiền gốc (₫)</label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                required
                className="input pr-8"
                value={formatAmountInput(editForm.principal_amount)}
                onChange={(e) => setEditForm({ ...editForm, principal_amount: parseAmountInput(e.target.value) })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">₫</span>
            </div>
          </div>
          <div>
            <label className="label">Hạn trả (tùy chọn)</label>
            <input type="date" className="input" value={editForm.due_date} onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <input className="input" value={editForm.note} onChange={(e) => setEditForm({ ...editForm, note: e.target.value })} />
          </div>
          <p className="sm:col-span-2 text-sm text-slate-400">
            Lưu ý: sửa số tiền gốc ở đây chỉ chỉnh lại thông tin khoản nợ, không tự tạo hay xóa giao dịch nào. Nếu số tiền thực tế đã đưa/vay bị sai, hãy sửa luôn giao dịch tương ứng ở trang "Giao dịch".
          </p>
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditingDebt(null)}>Hủy</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Đang lưu...' : 'Cập nhật'}</button>
          </div>
        </form>
      )}

      <div>
        <h2 className="text-base font-semibold text-slate-500 mb-3">Người khác nợ tôi</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {owedToMe.length === 0 ? <div className="text-slate-400 text-sm">Chưa có khoản nào.</div> : owedToMe.map((d) => <DebtCard key={d.debt_id} d={d} />)}
        </div>
      </div>
      <div>
        <h2 className="text-base font-semibold text-slate-500 mb-3">Tôi nợ người khác</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {iOwe.length === 0 ? <div className="text-slate-400 text-sm">Chưa có khoản nào.</div> : iOwe.map((d) => <DebtCard key={d.debt_id} d={d} />)}
        </div>
      </div>
    </div>
  )
}
