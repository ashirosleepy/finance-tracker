import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getCreditCardBalances, createCreditCard, deleteCreditCard } from '../lib/queries'
import { formatVND } from '../lib/formatters'

const emptyForm = { name: '', credit_limit: '', statement_day: '5', due_day: '20', note: '' }

export default function CreditCards() {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)

  async function load() { setCards(await getCreditCardBalances()) }
  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await createCreditCard({
      user_id: user.id, name: form.name, credit_limit: Number(form.credit_limit),
      statement_day: Number(form.statement_day), due_day: Number(form.due_day), note: form.note || null,
    })
    setForm(emptyForm); setShowForm(false)
    await load()
  }

  async function handleDelete(c) {
    if (!confirm(`Xóa thẻ "${c.name}"?`)) return
    try { await deleteCreditCard(c.credit_card_id); await load() }
    catch { alert('Không thể xóa: thẻ này đang có giao dịch liên kết.') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Thẻ tín dụng</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Đóng' : '+ Thêm thẻ'}</button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Tên thẻ</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Hạn mức (₫)</label>
            <input type="number" required className="input" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
          </div>
          <div>
            <label className="label">Ngày chốt sao kê</label>
            <input type="number" min="1" max="31" required className="input" value={form.statement_day} onChange={(e) => setForm({ ...form, statement_day: e.target.value })} />
          </div>
          <div>
            <label className="label">Ngày đến hạn thanh toán</label>
            <input type="number" min="1" max="31" required className="input" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} />
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end"><button className="btn-primary">Lưu</button></div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.length === 0 ? <div className="text-slate-400 text-sm">Chưa có thẻ nào.</div> : cards.map((c) => {
          const pct = c.credit_limit > 0 ? Math.min(100, (c.used_balance / c.credit_limit) * 100) : 0
          return (
            <div key={c.credit_card_id} className="card">
              <div className="font-medium">{c.name}</div>
              <div className="text-lg font-semibold mt-1">{formatVND(c.used_balance)} <span className="text-xs font-normal text-slate-400">/ {formatVND(c.credit_limit)}</span></div>
              <div className="w-full bg-slate-100 rounded-full h-2 mt-2">
                <div className={`h-2 rounded-full ${pct > 80 ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-slate-400 mt-2">Khả dụng: {formatVND(c.credit_limit - c.used_balance)}</div>
              <button className="text-xs text-slate-400 hover:text-red-600 mt-3" onClick={() => handleDelete(c)}>Xóa</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
