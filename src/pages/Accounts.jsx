import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAccountBalances, createAccount, updateAccount, deleteAccount } from '../lib/queries'
import { formatVND, ACCOUNT_TYPE_LABELS } from '../lib/formatters'

const emptyForm = { name: '', type: 'bank', account_number: '', opening_balance: '', note: '' }

export default function Accounts() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setAccounts(await getAccountBalances())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    await createAccount({
      user_id: user.id,
      name: form.name,
      type: form.type,
      account_number: form.account_number || null,
      opening_balance: Number(form.opening_balance) || 0,
      note: form.note || null,
    })
    setForm(emptyForm); setShowForm(false)
    await load()
  }

  async function handleToggleActive(a) {
    await updateAccount(a.account_id, { is_active: false })
    await load()
  }

  async function handleDelete(a) {
    if (!confirm(`Xóa tài khoản "${a.name}"? Chỉ nên xóa nếu tài khoản chưa có giao dịch nào.`)) return
    try {
      await deleteAccount(a.account_id)
      await load()
    } catch (err) {
      alert('Không thể xóa: tài khoản này đang có giao dịch liên kết. Hãy ẩn (ngừng hoạt động) thay vì xóa.')
    }
  }

  const grouped = accounts.reduce((acc, a) => {
    (acc[a.type] = acc[a.type] || []).push(a)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tài khoản</h1>
        <button className="btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Đóng' : '+ Thêm tài khoản'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Tên tài khoản</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Loại</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Số dư ban đầu (₫)</label>
            <input type="number" className="input" value={form.opening_balance}
              onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
          </div>
          <div>
            <label className="label">Số tài khoản (tùy chọn)</label>
            <input className="input" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
          </div>
          <div>
            <label className="label">Ghi chú</label>
            <input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end">
            <button className="btn-primary">Lưu</button>
          </div>
        </form>
      )}

      {loading ? <div className="text-slate-400">Đang tải...</div> : (
        Object.entries(ACCOUNT_TYPE_LABELS).map(([type, label]) => (
          grouped[type]?.length > 0 && (
            <div key={type}>
              <h2 className="text-sm font-semibold text-slate-500 mb-3">{label}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {grouped[type].map((a) => (
                  <div key={a.account_id} className="card">
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xl font-semibold mt-1">{formatVND(a.current_balance)}</div>
                    <div className="flex gap-3 mt-3 text-xs">
                      <button className="text-slate-400 hover:text-slate-600" onClick={() => handleToggleActive(a)}>Ẩn</button>
                      <button className="text-slate-400 hover:text-red-600" onClick={() => handleDelete(a)}>Xóa</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ))
      )}
    </div>
  )
}
