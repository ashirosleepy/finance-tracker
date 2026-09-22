import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getAccounts, getCategories, getCreditCardBalances, getDebtBalances,
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
} from '../lib/queries'
import { TRANSACTION_TYPE_LABELS } from '../lib/formatters'
import TransactionForm from '../components/TransactionForm'
import TransactionTable from '../components/TransactionTable'

export default function Transactions() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [creditCards, setCreditCards] = useState([])
  const [debts, setDebts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState(null)
  const [filters, setFilters] = useState({ type: '', accountId: '', categoryId: '', search: '' })
  const [loading, setLoading] = useState(true)
  const hasActiveFilters = Object.values(filters).some(Boolean)

  async function loadAll() {
    const [acc, cat, cc, dt] = await Promise.all([
      getAccounts(), getCategories(), getCreditCardBalances(), getDebtBalances(),
    ])
    setAccounts(acc); setCategories(cat); setCreditCards(cc); setDebts(dt)
  }

  async function loadTransactions() {
    setLoading(true)
    const tx = await getTransactions({
      type: filters.type || undefined,
      accountId: filters.accountId || undefined,
      categoryId: filters.categoryId || undefined,
      search: filters.search || undefined,
    })
    setTransactions(tx)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])
  useEffect(() => { loadTransactions() }, [filters])

  async function handleSubmit(payload, id) {
    setShowForm(false)
    setEditingTransaction(null)

    if (id) {
      // Optimistic update: patch the row in place immediately
      const previous = transactions
      setTransactions((list) => list.map((t) => (t.id === id ? { ...t, ...payload } : t)))
      try {
        const updated = await updateTransaction(id, payload)
        if (updated) {
          setTransactions((list) => list.map((t) => (t.id === id ? updated : t)))
        }
      } catch (err) {
        setTransactions(previous) // rollback on failure
        alert('Không thể cập nhật giao dịch. Vui lòng thử lại.')
        throw err
      }
      // Balances (accounts/cards/debts) depend on server-side calc, refresh quietly
      loadAll()
    } else {
      // Optimistic create: show a temporary row right away
      const tempId = `temp-${Date.now()}`
      const optimisticTx = { ...payload, id: tempId, _optimistic: true }
      setTransactions((list) => [optimisticTx, ...list])
      try {
        const created = await createTransaction(payload)
        setTransactions((list) => list.map((t) => (t.id === tempId ? created : t)))
      } catch (err) {
        setTransactions((list) => list.filter((t) => t.id !== tempId)) // rollback on failure
        alert('Không thể thêm giao dịch. Vui lòng thử lại.')
        throw err
      }
      loadAll()
    }
  }

  function handleEdit(tx) {
    setEditingTransaction(tx)
    setShowForm(true)
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditingTransaction(null)
  }

  async function handleDelete(id) {
    if (!confirm('Xóa giao dịch này? Số dư liên quan sẽ tự động cập nhật lại.')) return
    const previous = transactions
    setTransactions((list) => list.filter((t) => t.id !== id)) // optimistic remove
    try {
      await deleteTransaction(id)
      loadAll()
    } catch (err) {
      setTransactions(previous) // rollback on failure
      alert('Không thể xóa giao dịch. Vui lòng thử lại.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Giao dịch</h1>
        <button
          className="btn-primary px-3 py-2 text-sm sm:px-4 sm:text-base"
          onClick={() => {
            if (showForm) handleCloseForm()
            else setShowForm(true)
          }}
        >
          {showForm ? 'Đóng' : '+ Thêm giao dịch'}
        </button>
      </div>

      {showForm && (
        <TransactionForm
          accounts={accounts} categories={categories} creditCards={creditCards} debts={debts}
          userId={user.id} initialData={editingTransaction}
          onSubmit={handleSubmit} onCancel={handleCloseForm}
        />
      )}

      <div className="card grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
        <input
          className="input col-span-2 py-2.5 sm:col-span-1 sm:max-w-xs" placeholder="Tìm theo mô tả..."
          value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <select className="input py-2.5 sm:max-w-[160px]" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">Tất cả loại</option>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input py-2.5 sm:max-w-[160px]" value={filters.accountId} onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}>
          <option value="">Tất cả tài khoản</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input py-2.5 sm:max-w-[160px]" value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {hasActiveFilters && (
          <button
            onClick={() => setFilters({ type: '', accountId: '', categoryId: '', search: '' })}
            className="col-span-2 sm:col-span-1 py-2 text-sm text-slate-500 hover:text-slate-700 underline underline-offset-2"
          >
            Xóa lọc
          </button>
        )}
      </div>

      {loading ? <div className="text-slate-400">Đang tải...</div> : (
        <TransactionTable transactions={transactions} onDelete={handleDelete} onEdit={handleEdit} />
      )}
    </div>
  )
}
