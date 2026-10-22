import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getBnplBalances, createBnplAccount, deleteBnplAccount, getTransactions } from '../lib/queries'
import { computeBnplTotals } from '../lib/calculations'
import { formatVND, formatDateTime } from '../lib/formatters'

const emptyForm = { name: 'Shopee trả sau', credit_limit: '', statement_day: '5', due_day: '20', note: '' }
const WARN_PCT = 80

export default function BuyNowPayLater() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [openId, setOpenId] = useState(null)
  const [purchases, setPurchases] = useState([])

  async function load() { setAccounts(await getBnplBalances()) }
  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await createBnplAccount({
      user_id: user.id, name: form.name, credit_limit: Number(form.credit_limit),
      statement_day: Number(form.statement_day), due_day: Number(form.due_day), note: form.note || null,
    })
    setForm(emptyForm); setShowForm(false)
    await load()
  }

  async function handleDelete(a) {
    if (!confirm(`Xóa tài khoản "${a.name}"?`)) return
    try { await deleteBnplAccount(a.bnpl_id); await load() }
    catch { alert('Không thể xóa: tài khoản này đang có giao dịch hoặc kế hoạch trả góp liên kết.') }
  }

  async function toggle(a) {
    if (openId === a.bnpl_id) { setOpenId(null); return }
    setOpenId(a.bnpl_id)
    setPurchases(await getTransactions({ bnplAccountId: a.bnpl_id }))
  }

  const totals = computeBnplTotals(accounts)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Shopee trả sau</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>{showForm ? 'Đóng' : '+ Thêm hạn mức'}</button>
      </div>

      <p className="text-sm text-slate-400">
        Đây là hạn mức tín dụng, không phải tiền trong ví. Ví ShopeePay thật hãy thêm ở trang "Tài khoản" với loại ví điện tử.
      </p>

      {accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card"><div className="text-sm text-slate-500">Tổng hạn mức</div><div className="text-lg font-semibold mt-1">{formatVND(totals.totalLimit)}</div></div>
          <div className="card"><div className="text-sm text-slate-500">Đã sử dụng ({totals.pct.toFixed(0)}%)</div><div className="text-lg font-semibold mt-1 text-red-600 dark:text-red-400">{formatVND(totals.used)}</div></div>
          <div className="card"><div className="text-sm text-slate-500">Còn khả dụng</div><div className="text-lg font-semibold mt-1 text-brand-600 dark:text-brand-400">{formatVND(totals.available)}</div></div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Tên</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Hạn mức (₫)</label>
            <input type="number" required className="input" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
          </div>
          <div>
            <label className="label">Ngày chốt kỳ</label>
            <input type="number" min="1" max="31" required className="input" value={form.statement_day} onChange={(e) => setForm({ ...form, statement_day: e.target.value })} />
          </div>
          <div>
            <label className="label">Ngày đến hạn thanh toán</label>
            <input type="number" min="1" max="31" required className="input" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} />
          </div>
          <div className="col-span-2">
            <label className="label">Ghi chú</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end"><button className="btn-primary">Lưu</button></div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.length === 0 ? <div className="text-slate-400 text-sm">Chưa có hạn mức nào.</div> : accounts.map((a) => {
          const pct = a.credit_limit > 0 ? Math.min(100, (a.used_balance / a.credit_limit) * 100) : 0
          const near = pct >= WARN_PCT
          return (
            <div key={a.bnpl_id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium">{a.name}</div>
                {near && (
                  <span className="text-xs text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30 rounded px-2 py-0.5">
                    {pct >= 100 ? 'Đã hết hạn mức' : 'Gần hết hạn mức'}
                  </span>
                )}
              </div>
              <div className="text-lg font-semibold mt-1">
                {formatVND(a.used_balance)} <span className="text-xs font-normal text-slate-400">/ {formatVND(a.credit_limit)}</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-2">
                <div className={`h-2 rounded-full ${near ? 'bg-red-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Khả dụng: {formatVND(a.available_balance)} · Chốt kỳ ngày {a.statement_day} · Đến hạn ngày {a.due_day}
              </div>
              <div className="flex gap-4 mt-3">
                <button className="text-xs text-slate-500 hover:text-brand-600" onClick={() => toggle(a)}>
                  {openId === a.bnpl_id ? 'Ẩn giao dịch' : 'Xem giao dịch'}
                </button>
                <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => handleDelete(a)}>Xóa</button>
              </div>

              {openId === a.bnpl_id && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {purchases.length === 0 ? <div className="text-sm text-slate-400">Chưa có giao dịch.</div> : purchases.slice(0, 15).map((t) => (
                    <div key={t.id} className="flex justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate">{t.description || (t.type === 'bnpl_charge' ? 'Mua trả sau' : 'Thanh toán')}</div>
                        <div className="text-xs text-slate-400">{formatDateTime(t.occurred_at)}</div>
                      </div>
                      <div className={`whitespace-nowrap font-medium ${t.type === 'bnpl_charge' ? 'text-red-600 dark:text-red-400' : 'text-brand-600 dark:text-brand-400'}`}>
                        {t.type === 'bnpl_charge' ? '-' : '+'}{formatVND(t.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
