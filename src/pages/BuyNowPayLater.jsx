import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getBnplBalances, createBnplAccount, deleteBnplAccount, getAccounts } from '../lib/queries'
import { computeBnplTotals } from '../lib/calculations'
import { SHOPEE_STATEMENT_DAY, SHOPEE_DUE_DAY } from '../lib/shopeeBill'
import { formatVND } from '../lib/formatters'
import BnplBills from './BnplBills'

const emptyForm = { name: 'Shopee trả sau', credit_limit: '', note: '' }
const WARN_PCT = 80

export default function BuyNowPayLater() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [spendable, setSpendable] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [openId, setOpenId] = useState(null)

  async function load() {
    const [bnpl, ac] = await Promise.all([getBnplBalances(), getAccounts()])
    setAccounts(bnpl)
    setSpendable(ac.filter((a) => a.type !== 'savings'))
  }
  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await createBnplAccount({
      user_id: user.id, name: form.name, credit_limit: Number(form.credit_limit),
      statement_day: SHOPEE_STATEMENT_DAY, due_day: SHOPEE_DUE_DAY, note: form.note || null,
    })
    setForm(emptyForm); setShowForm(false)
    await load()
  }

  async function handleDelete(a) {
    if (!confirm(`Xóa tài khoản "${a.name}"?`)) return
    try { await deleteBnplAccount(a.bnpl_id); await load() }
    catch { alert('Không thể xóa: tài khoản này đang có giao dịch hoặc kế hoạch trả góp liên kết.') }
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
      <p className="text-sm text-slate-400">
        Mỗi tháng một hóa đơn: chốt ngày {SHOPEE_STATEMENT_DAY}, hạn trả ngày {SHOPEE_DUE_DAY} tháng sau, thanh toán cả hóa đơn một lần
        (gồm các kỳ trả góp thuộc hóa đơn đó).
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
          <div className="col-span-2 text-xs text-slate-400">
            Hóa đơn chốt ngày {SHOPEE_STATEMENT_DAY}, hạn trả ngày {SHOPEE_DUE_DAY} tháng sau (cố định theo Shopee).
          </div>
          <div className="col-span-2">
            <label className="label">Ghi chú</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end"><button className="btn-primary">Lưu</button></div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {accounts.length === 0 ? <div className="text-slate-400 text-sm">Chưa có hạn mức nào.</div> : accounts.map((a) => {
          const pct = a.credit_limit > 0 ? Math.min(100, (a.used_balance / a.credit_limit) * 100) : 0
          const near = pct >= WARN_PCT
          const open = openId === a.bnpl_id
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
                Khả dụng: {formatVND(a.available_balance)} · Chốt ngày {SHOPEE_STATEMENT_DAY} · Hạn trả ngày {SHOPEE_DUE_DAY} tháng sau
              </div>
              <div className="flex gap-4 mt-3">
                <button className="text-xs text-slate-500 hover:text-brand-600" onClick={() => setOpenId(open ? null : a.bnpl_id)}>
                  {open ? 'Ẩn hóa đơn' : 'Xem hóa đơn'}
                </button>
                <button className="text-xs text-slate-400 hover:text-red-600" onClick={() => handleDelete(a)}>Xóa</button>
              </div>

              {open && <BnplBills account={a} userId={user.id} spendable={spendable} onChanged={load} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
