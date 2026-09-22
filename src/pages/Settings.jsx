import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getCategories, createCategory, getTransactions, getAccounts, createTransaction, createAccount } from '../lib/queries'

export default function Settings() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [newCat, setNewCat] = useState({ name: '', kind: 'expense' })
  const [status, setStatus] = useState('')
  const fileInputRef = useRef()

  async function load() { setCategories(await getCategories()) }
  useEffect(() => { load() }, [])

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCat.name.trim()) return
    await createCategory({ user_id: user.id, name: newCat.name, kind: newCat.kind })
    setNewCat({ name: '', kind: 'expense' })
    await load()
  }

  async function handleExportJSON() {
    const [transactions, accounts] = await Promise.all([getTransactions(), getAccounts()])
    const payload = { exported_at: new Date().toISOString(), accounts, categories, transactions }
    downloadFile(`finance-export-${Date.now()}.json`, JSON.stringify(payload, null, 2), 'application/json')
  }

  async function handleExportCSV() {
    const transactions = await getTransactions()
    const header = ['occurred_at', 'type', 'amount', 'category', 'from_account', 'to_account', 'description', 'note']
    const rows = transactions.map((t) => [
      t.occurred_at, t.type, t.amount, t.category?.name || '', t.from_account?.name || '', t.to_account?.name || '',
      (t.description || '').replace(/,/g, ';'), (t.note || '').replace(/,/g, ';'),
    ])
    const csv = [header.join(','), ...rows.map((r) => r.join(','))].join('\n')
    downloadFile(`transactions-${Date.now()}.csv`, csv, 'text/csv')
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImportJSON(e) {
    const file = e.target.files[0]
    if (!file) return
    setStatus('Đang import...')
    try {
      const text = await file.text()
      const data = JSON.parse(text)

      // Tài khoản đã có sẵn trong DB (khớp theo tên, không phân biệt hoa/thường
      // và khoảng trắng thừa) — dùng để tránh tạo trùng khi file import có "accounts".
      const existingAccounts = await getAccounts()
      const existingByName = new Map(
        existingAccounts.map((a) => [a.name.trim().toLowerCase(), a.id])
      )

      // accountIdMap: id trong file -> id thật trong DB.
      // Mặc định ánh xạ mỗi tài khoản hiện có về chính nó, để những giao dịch
      // tham chiếu thẳng tới id tài khoản đã tồn tại (không kèm mảng "accounts")
      // vẫn được giữ nguyên thay vì bị rơi về null.
      const accountIdMap = {}
      for (const a of existingAccounts) accountIdMap[a.id] = a.id

      for (const a of data.accounts || []) {
        const key = (a.name || '').trim().toLowerCase()
        const existingId = existingByName.get(key)
        if (existingId) {
          // Tài khoản cùng tên đã tồn tại -> dùng lại, KHÔNG tạo mới.
          accountIdMap[a.id || a.account_id] = existingId
        } else {
          const created = await createAccount({
            user_id: user.id, name: a.name, type: a.type,
            opening_balance: a.opening_balance || a.current_balance || 0, note: a.note,
          })
          accountIdMap[a.id || a.account_id] = created.id
          existingByName.set(key, created.id)
        }
      }

      let okCount = 0
      const errors = []
      for (const [i, t] of (data.transactions || []).entries()) {
        try {
          await createTransaction({
            user_id: user.id,
            type: t.type,
            amount: t.amount,
            occurred_at: t.occurred_at,
            // Nếu id trong file không nằm trong map (không được remap và cũng
            // không khớp tài khoản có sẵn) thì fallback về chính id đó thay vì
            // null, phòng trường hợp file chỉ chứa transactions tham chiếu
            // thẳng tới account_id/category_id đã có sẵn trong DB.
            from_account_id: t.from_account_id ? (accountIdMap[t.from_account_id] || t.from_account_id) : null,
            to_account_id: t.to_account_id ? (accountIdMap[t.to_account_id] || t.to_account_id) : null,
            category_id: t.category_id || null,
            credit_card_id: t.credit_card_id || null,
            debt_id: t.debt_id || null,
            description: t.description,
            note: t.note,
            affects_balance: t.affects_balance ?? true,
          })
          okCount++
        } catch (rowErr) {
          errors.push(`dòng ${i + 1}: ${rowErr.message}`)
        }
      }
      const total = (data.transactions || []).length
      if (errors.length === 0) {
        setStatus(`Import thành công! Đã thêm ${okCount}/${total} giao dịch.`)
      } else {
        setStatus(`Đã thêm ${okCount}/${total} giao dịch. Lỗi ${errors.length} dòng: ${errors.slice(0, 3).join(' | ')}${errors.length > 3 ? ' ...' : ''}`)
      }
    } catch (err) {
      setStatus('Lỗi import: ' + err.message)
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-xl font-semibold">Cài đặt</h1>

      <div className="card">
        <h2 className="font-medium mb-3">Danh mục</h2>
        <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
          <input className="input" placeholder="Tên danh mục mới" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
          <select className="input max-w-[140px]" value={newCat.kind} onChange={(e) => setNewCat({ ...newCat, kind: e.target.value })}>
            <option value="expense">Chi tiêu</option>
            <option value="income">Thu nhập</option>
          </select>
          <button className="btn-primary whitespace-nowrap">+ Thêm</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className={`text-xs px-2 py-1 rounded-full ${c.kind === 'income' ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
              {c.name}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <h2 className="font-medium mb-3">Sao lưu &amp; dữ liệu</h2>
        <div className="flex flex-wrap gap-2 mb-3">
          <button className="btn-secondary" onClick={handleExportJSON}>Export JSON</button>
          <button className="btn-secondary" onClick={handleExportCSV}>Export CSV (giao dịch)</button>
          <button className="btn-secondary" onClick={() => fileInputRef.current.click()}>Import JSON</button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleImportJSON} />
        </div>
        {status && <p className="text-sm text-slate-500">{status}</p>}
        <p className="text-xs text-slate-400 mt-2">
          Dữ liệu được lưu trực tiếp trên Supabase (PostgreSQL) nên sẽ không mất khi bạn cập nhật code website.
          Export chỉ để bạn tự sao lưu thêm phòng trường hợp cần khôi phục.
        </p>
      </div>

      <div className="card">
        <h2 className="font-medium mb-2">Tài khoản đăng nhập</h2>
        <p className="text-sm text-slate-500">{user?.email}</p>
      </div>
    </div>
  )
}
