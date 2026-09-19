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
    if (id) {
      await updateTransaction(id, payload)
    } else {
      await createTransaction(payload)
    }
    setShowForm(false)
    setEditingTransaction(null)
    await loadTransactions()
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
    await deleteTransaction(id)
    await loadTransactions()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Giao dịch</h1>
        <button
          className="btn-primary"
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

      <div className="card flex flex-wrap gap-3">
        <input
          className="input max-w-xs" placeholder="Tìm theo mô tả..."
          value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
        />
        <select className="input max-w-[180px]" value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}>
          <option value="">Tất cả loại</option>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input max-w-[180px]" value={filters.accountId} onChange={(e) => setFilters((f) => ({ ...f, accountId: e.target.value }))}>
          <option value="">Tất cả tài khoản</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input max-w-[180px]" value={filters.categoryId} onChange={(e) => setFilters((f) => ({ ...f, categoryId: e.target.value }))}>
          <option value="">Tất cả danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? <div className="text-slate-400">Đang tải...</div> : (
        <TransactionTable transactions={transactions} onDelete={handleDelete} onEdit={handleEdit} />
      )}
    </div>
  )
}
