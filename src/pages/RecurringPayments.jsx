import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getRecurringPayments, createRecurringPayment, markRecurringPaymentPaid, deleteRecurringPayment, getAccounts, getCategories } from '../lib/queries'
import { formatVND, formatDate } from '../lib/formatters'

const emptyForm = { name: '', amount: '', frequency: 'monthly', interval_days: '', next_due_date: '', account_id: '', category_id: '', note: '' }

const FREQ_LABELS = { daily: 'Hàng ngày', weekly: 'Hàng tuần', monthly: 'Hàng tháng', yearly: 'Hàng năm', custom: 'Tùy chỉnh' }

export default function RecurringPayments() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() {
    setItems(await getRecurringPayments())
    setAccounts(await getAccounts())
    setCategories(await getCategories())
  }
  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await createRecurringPayment({
      user_id: user.id, name: form.name, amount: Number(form.amount), frequency: form.frequency,
      interval_days: form.frequency === 'custom' ? Number(form.interval_days) : null,
      next_due_date: form.next_due_date, account_id: form.account_id || null,
      category_id: form.category_id || null, note: form.note || null,
    })
    setForm(emptyForm); setShowForm(false)
    await load()
  }

  async function handleMarkPaid(rp) {
    if (!rp.account_id) { alert('Khoản này chưa gắn tài khoản thanh toán — hãy sửa để thêm tài khoản trước.'); return }
    await markRecurringPaymentPaid(user.id, rp)
    await load()
  }

  async function handleDelete(id) {
    if (!confirm('Xóa khoản phải trả này?')) return
    await deleteRecurringPayment(id)
    await load()
  }

  const now = new Date()
  const in7Days = new Date(now); in7Days.setDate(in7Days.getDate() + 7)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const yearEnd = new Date(now.getFullYear(), 11, 31)

  const dueToday = items.filter((r) => r.status === 'active' && r.next_due_date === now.toISOString().slice(0, 10))
  const due7Days = items.filter((r) => r.status === 'active' && new Date(r.next_due_date) <= in7Days)
  const dueThisMonth = items.filter((r) => r.status === 'active' && new Date(r.next_due_date) <= monthEnd)
  const dueThisYear = items.filter((r) => r.status === 'active' && new Date(r.next_due_date) <= yearEnd)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Khoản phải trả định kỳ</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Đóng' : '+ Thêm khoản'}</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card"><div className="text-sm text-slate-500">Hôm nay</div><div className="text-lg font-semibold">{formatVND(dueToday.reduce((s, r) => s + Number(r.amount), 0))}</div></div>
        <div className="card"><div className="text-sm text-slate-500">7 ngày tới</div><div className="text-lg font-semibold">{formatVND(due7Days.reduce((s, r) => s + Number(r.amount), 0))}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Tháng này</div><div className="text-lg font-semibold">{formatVND(dueThisMonth.reduce((s, r) => s + Number(r.amount), 0))}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Năm nay</div><div className="text-lg font-semibold">{formatVND(dueThisYear.reduce((s, r) => s + Number(r.amount), 0))}</div></div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Tên khoản</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Số tiền (₫)</label>
            <input type="number" required className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Chu kỳ</label>
            <select className="input" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
              {Object.entries(FREQ_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          {form.frequency === 'custom' && (
            <div>
              <label className="label">Số ngày mỗi chu kỳ</label>
              <input type="number" className="input" value={form.interval_days} onChange={(e) => setForm({ ...form, interval_days: e.target.value })} />
            </div>
          )}
          <div>
            <label className="label">Ngày thanh toán tiếp theo</label>
            <input type="date" required className="input" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} />
          </div>
          <div>
            <label className="label">Tài khoản thanh toán</label>
            <select className="input" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
              <option value="">-- Chọn tài khoản --</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Danh mục</label>
            <select className="input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">-- Không chọn --</option>
              {categories.filter(c => c.kind === 'expense').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label">Ghi chú</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end"><button className="btn-primary">Lưu</button></div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2 pr-3">Tên</th>
              <th className="py-2 pr-3">Số tiền</th>
              <th className="py-2 pr-3">Chu kỳ</th>
              <th className="py-2 pr-3">Kỳ tiếp theo</th>
              <th className="py-2 pr-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2 pr-3">{r.name}<div className="text-xs text-slate-400">{r.account?.name}{r.category?.name ? ` · ${r.category.name}` : ''}</div></td>
                <td className="py-2 pr-3">{formatVND(r.amount)}</td>
                <td className="py-2 pr-3">{FREQ_LABELS[r.frequency]}</td>
                <td className="py-2 pr-3">{formatDate(r.next_due_date)}</td>
                <td className="py-2 pr-3 text-right whitespace-nowrap">
                  <button className="text-xs text-brand-600 mr-3" onClick={() => handleMarkPaid(r)}>Đã trả</button>
                  <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => handleDelete(r.id)}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
