import { useEffect, useMemo, useState } from 'react'
import {
  getAccountBalances, getDebtBalances, getCreditCardBalances,
  getTransactions, getRecurringPayments,
} from '../lib/queries'
import {
  computeAssetTotals, computeLiabilityTotals, computeNetWorth,
  totalIncome, totalExpense, startOfWeek, startOfMonth, startOfYear,
} from '../lib/calculations'
import { formatVND, formatDate, ACCOUNT_TYPE_LABELS } from '../lib/formatters'
import StatCard from '../components/StatCard'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [accountBalances, setAccountBalances] = useState([])
  const [debtBalances, setDebtBalances] = useState([])
  const [creditCardBalances, setCreditCardBalances] = useState([])
  const [transactions, setTransactions] = useState([])
  const [recurring, setRecurring] = useState([])
  const [showSensitive, setShowSensitive] = useState(false)

  const mask = (value) => (showSensitive ? formatVND(value) : '••••••••')

  useEffect(() => {
    async function load() {
      const [ab, db, cb, tx, rp] = await Promise.all([
        getAccountBalances(), getDebtBalances(), getCreditCardBalances(),
        getTransactions(), getRecurringPayments(),
      ])
      setAccountBalances(ab); setDebtBalances(db); setCreditCardBalances(cb)
      setTransactions(tx); setRecurring(rp)
      setLoading(false)
    }
    load()
  }, [])

  const assets = useMemo(() => computeAssetTotals(accountBalances), [accountBalances])
  const liabilities = useMemo(() => computeLiabilityTotals(debtBalances, creditCardBalances), [debtBalances, creditCardBalances])
  const netWorth = useMemo(
    () => computeNetWorth(assets.realAssetsTotal, liabilities.debtOwedToMe, liabilities.totalLiabilities),
    [assets, liabilities]
  )
  const netLiquidAfterDebt = useMemo(
    () => assets.liquidTotal - liabilities.debtIOwe - liabilities.creditCardDebt,
    [assets, liabilities]
  )

  const now = new Date()
  const weekIncome = totalIncome(transactions, startOfWeek(now), now)
  const weekExpense = totalExpense(transactions, startOfWeek(now), now)
  const monthIncome = totalIncome(transactions, startOfMonth(now), now)
  const monthExpense = totalExpense(transactions, startOfMonth(now), now)
  const yearIncome = totalIncome(transactions, startOfYear(now), now)
  const yearExpense = totalExpense(transactions, startOfYear(now), now)

  const in7Days = new Date(now); in7Days.setDate(in7Days.getDate() + 7)
  const upcomingRecurring = recurring.filter((r) => r.status === 'active' && new Date(r.next_due_date) <= in7Days)
  const dueDebts = debtBalances.filter((d) => d.status !== 'paid' && d.due_date && new Date(d.due_date) <= in7Days)
  const overdueDebts = debtBalances.filter((d) => d.status === 'overdue')

  if (loading) return <div className="text-slate-400">Đang tải dữ liệu...</div>

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Tổng quan</h1>
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-600"
            onClick={() => setShowSensitive((v) => !v)}
          >
            {showSensitive ? 'Ẩn số liệu' : 'Hiện số liệu'}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Tài sản thực tế (không gồm tiết kiệm)" value={formatVND(assets.liquidTotal)} />
          <StatCard
            label="Tài sản thực tế sau khi trừ nợ"
            value={formatVND(netLiquidAfterDebt)}
            tone={netLiquidAfterDebt >= 0 ? 'positive' : 'negative'}
          />
          <StatCard label="Tiền tiết kiệm" value={mask(assets.savings)} tone="positive" />
          <StatCard label="Net Worth" value={mask(netWorth)} tone={netWorth >= 0 ? 'positive' : 'negative'} />
          <StatCard label="Người khác nợ tôi" value={formatVND(liabilities.debtOwedToMe)} tone="neutral" />
          <StatCard label="Tôi đang nợ" value={formatVND(liabilities.debtIOwe)} tone="negative" />
          <StatCard label="Dư nợ thẻ tín dụng" value={formatVND(liabilities.creditCardDebt)} tone="negative" />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">Chi tiết tài sản</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(ACCOUNT_TYPE_LABELS).map(([key, label]) => (
            <StatCard
              key={key}
              label={label}
              value={key === 'savings' ? mask(assets[key] || 0) : formatVND(assets[key] || 0)}
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-slate-500 mb-3">Thu / chi theo mốc thời gian</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="text-sm text-slate-500 mb-2">Tuần này</div>
            <div className="text-brand-600 font-medium">+{formatVND(weekIncome)}</div>
            <div className="text-red-600 font-medium">-{formatVND(weekExpense)}</div>
          </div>
          <div className="card">
            <div className="text-sm text-slate-500 mb-2">Tháng này</div>
            <div className="text-brand-600 font-medium">+{formatVND(monthIncome)}</div>
            <div className="text-red-600 font-medium">-{formatVND(monthExpense)}</div>
          </div>
          <div className="card">
            <div className="text-sm text-slate-500 mb-2">Năm nay</div>
            <div className="text-brand-600 font-medium">+{formatVND(yearIncome)}</div>
            <div className="text-red-600 font-medium">-{formatVND(yearExpense)}</div>
          </div>
        </div>
      </div>

      {(upcomingRecurring.length > 0 || dueDebts.length > 0 || overdueDebts.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-3">Cảnh báo</h2>
          <div className="card space-y-2">
            {overdueDebts.map((d) => (
              <div key={d.debt_id} className="text-sm text-red-600">
                ⚠ Khoản nợ với {d.person_name} đã quá hạn ({formatVND(d.remaining_amount)})
              </div>
            ))}
            {dueDebts.filter(d => d.status !== 'overdue').map((d) => (
              <div key={d.debt_id} className="text-sm text-amber-600">
                ⏰ Nợ với {d.person_name} đến hạn {formatDate(d.due_date)} — còn {formatVND(d.remaining_amount)}
              </div>
            ))}
            {upcomingRecurring.map((r) => (
              <div key={r.id} className="text-sm text-amber-600">
                ⏰ "{r.name}" đến hạn {formatDate(r.next_due_date)} — {formatVND(r.amount)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
