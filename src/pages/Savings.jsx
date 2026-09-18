import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getAccountBalances, getSavingsGoals, createSavingsGoal, updateSavingsGoal } from '../lib/queries'
import { computeAssetTotals } from '../lib/calculations'
import { formatVND, formatDate } from '../lib/formatters'

const emptyForm = { account_id: '', name: '', target_amount: '', target_date: '', note: '' }

export default function Savings() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [goals, setGoals] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)

  async function load() {
    const ab = await getAccountBalances()
    setAccounts(ab.filter((a) => a.type === 'savings'))
    setGoals(await getSavingsGoals())
  }
  useEffect(() => { load() }, [])

  const assets = computeAssetTotals(accounts.length ? accounts : [])
  const totalAssetsAllTypes = accounts.reduce((s, a) => s + Number(a.current_balance), 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (editingId) {
      await updateSavingsGoal(editingId, {
        account_id: form.account_id || null, name: form.name,
        target_amount: form.target_amount ? Number(form.target_amount) : null,
        target_date: form.target_date || null, note: form.note || null,
      })
    } else {
      await createSavingsGoal({
        user_id: user.id, account_id: form.account_id || null, name: form.name,
        target_amount: form.target_amount ? Number(form.target_amount) : null,
        target_date: form.target_date || null, note: form.note || null,
      })
    }
    setForm(emptyForm); setShowForm(false); setEditingId(null)
    await load()
  }

  function handleEdit(g) {
    setForm({
      account_id: g.account_id || '',
      name: g.name || '',
      target_amount: g.target_amount ?? '',
      target_date: g.target_date || '',
      note: g.note || '',
    })
    setEditingId(g.id)
    setShowForm(true)
  }

  function handleCancelForm() {
    setForm(emptyForm); setShowForm(false); setEditingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tiết kiệm</h1>
        <button
          className="btn-primary"
          onClick={() => (showForm ? handleCancelForm() : (setForm(emptyForm), setEditingId(null), setShowForm(true)))}
        >
          {showForm ? 'Đóng' : '+ Thêm mục tiêu'}
        </button>
      </div>

      <div className="card">
        <div className="text-sm text-slate-500">Tổng tiền tiết kiệm</div>
        <div className="text-2xl font-semibold mt-1">{formatVND(totalAssetsAllTypes)}</div>
        <p className="text-xs text-slate-400 mt-2">
          Để đưa tiền vào/lấy ra khỏi tiết kiệm, dùng loại giao dịch "Chuyển tiền" ở trang Giao dịch —
          thao tác này không được tính là chi tiêu.
        </p>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Tên mục tiêu</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Tài khoản tiết kiệm liên kết</label>
            <select className="input" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
              <option value="">-- Không chọn --</option>
              {accounts.map((a) => <option key={a.account_id} value={a.account_id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Số tiền mục tiêu (₫)</label>
            <input type="number" className="input" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Ngày mục tiêu</label>
            <input type="date" className="input" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
          </div>
          <div className="col-span-2 flex justify-end gap-3">
            <button type="button" className="text-sm text-slate-400 hover:text-slate-600" onClick={handleCancelForm}>Hủy</button>
            <button className="btn-primary">{editingId ? 'Cập nhật' : 'Lưu'}</button>
          </div>
        </form>
      )}

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">Tài khoản tiết kiệm</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {accounts.length === 0 ? <div className="text-slate-400 text-sm">Chưa có tài khoản tiết kiệm nào.</div> : accounts.map((a) => (
            <div key={a.account_id} className="card">
              <div className="font-medium">{a.name}</div>
              <div className="text-xl font-semibold mt-1">{formatVND(a.current_balance)}</div>
            </div>
          ))}
        </div>
      </div>

      {goals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-3">Mục tiêu tiết kiệm</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {goals.map((g) => (
              <div key={g.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="font-medium">{g.name}</div>
                  <button className="text-xs text-slate-400 hover:text-blue-600" onClick={() => handleEdit(g)}>Sửa</button>
                </div>
                {g.target_amount && <div className="text-sm text-slate-500 mt-1">Mục tiêu: {formatVND(g.target_amount)}</div>}
                {g.target_date && <div className="text-xs text-slate-400">Hạn: {formatDate(g.target_date)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
