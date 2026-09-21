import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts'
import {
  getTransactions, getAccountBalances, getRecurringPayments, getDebtBalances,
} from '../lib/queries'
import {
  totalIncome, totalExpense, expenseByCategory, computeAssetTotals, buildForecast,
} from '../lib/calculations'
import { formatVND } from '../lib/formatters'

const COLORS = ['#0f9d78', '#38bdf8', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#84cc16']

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export default function Reports() {
  const [period, setPeriod] = useState('month') // day | week | month | year
  const [transactions, setTransactions] = useState([])
  const [accountBalances, setAccountBalances] = useState([])
  const [recurring, setRecurring] = useState([])
  const [debtBalances, setDebtBalances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [tx, ab, rp, db] = await Promise.all([
        getTransactions(), getAccountBalances(), getRecurringPayments(), getDebtBalances(),
      ])
      setTransactions(tx); setAccountBalances(ab); setRecurring(rp); setDebtBalances(db)
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const rangeStart = useMemo(() => {
    const d = new Date(now)
    if (period === 'day') d.setHours(0, 0, 0, 0)
    else if (period === 'week') { d.setDate(d.getDate() - 7) }
    else if (period === 'month') { d.setDate(1); d.setHours(0, 0, 0, 0) }
    else { d.setMonth(0, 1); d.setHours(0, 0, 0, 0) }
    return d
  }, [period])

  const income = totalIncome(transactions, rangeStart, now)
  const expense = totalExpense(transactions, rangeStart, now)
  const categoryData = expenseByCategory(transactions, rangeStart, now)

  // Last 6 months income vs expense, for the trend chart
  const monthlyTrend = useMemo(() => {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(d)
    }
    return months.map((d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      return {
        month: `${d.getMonth() + 1}/${d.getFullYear()}`,
        Thu: totalIncome(transactions, start, end),
        Chi: totalExpense(transactions, start, end),
      }
    })
  }, [transactions])

  const assets = computeAssetTotals(accountBalances)
  const forecast = buildForecast({ currentLiquid: assets.liquidTotal, recurringPayments: recurring, debtBalances })

  if (loading) return <div className="text-slate-400">Đang tải...</div>

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Báo cáo</h1>

      <div className="flex gap-2">
        {[['day', 'Hôm nay'], ['week', '7 ngày'], ['month', 'Tháng này'], ['year', 'Năm nay']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)}
            className={`px-3 py-1.5 rounded-lg text-sm ${period === v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card"><div className="text-sm text-slate-500">Tổng thu</div><div className="text-xl font-semibold text-brand-600">{formatVND(income)}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Tổng chi</div><div className="text-xl font-semibold text-red-600">{formatVND(expense)}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Chênh lệch</div><div className={`text-xl font-semibold ${income - expense >= 0 ? 'text-brand-600' : 'text-red-600'}`}>{formatVND(income - expense)}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="text-sm font-semibold text-slate-500 mb-3">Thu vs Chi (6 tháng gần đây)</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyTrend}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 1000000).toFixed(0) + 'tr'} />
              <Tooltip formatter={(v) => formatVND(v)} />
              <Legend />
              <Bar dataKey="Thu" fill="#0f9d78" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="text-sm font-semibold text-slate-500 mb-3">Chi theo danh mục</div>
          {categoryData.length === 0 ? <div className="text-slate-400 text-sm py-16 text-center">Chưa có dữ liệu chi tiêu.</div> : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  labelLine={false}
                  label={({ percent, cx, cy, midAngle, innerRadius, outerRadius }) => {
                    // Too tiny to label at all — let the legend carry it.
                    if (percent < 0.02) return null

                    const RADIAN = Math.PI / 180
                    const cos = Math.cos(-midAngle * RADIAN)
                    const sin = Math.sin(-midAngle * RADIAN)

                    // Small slices have little tangential room near the center,
                    // so push them closer to the outer edge where the slice is
                    // wider; bigger slices sit at their natural midpoint.
                    const depth = percent >= 0.08 ? 0.6 : 0.82
                    const r = innerRadius + (outerRadius - innerRadius) * depth
                    const x = cx + r * cos
                    const y = cy + r * sin

                    // Rotate the label to follow this slice's own angle (so it
                    // can read horizontal, vertical, or anywhere in between),
                    // flipped upright when it would otherwise render upside down.
                    let rotateDeg = -midAngle
                    rotateDeg = ((rotateDeg + 180) % 360 + 360) % 360 - 180
                    if (rotateDeg > 90 || rotateDeg < -90) rotateDeg += 180

                    const fontSize = percent >= 0.08 ? 12 : 10

                    return (
                      <text
                        x={x} y={y}
                        transform={`rotate(${rotateDeg} ${x} ${y})`}
                        fill="#fff" textAnchor="middle" dominantBaseline="central"
                        fontSize={fontSize} fontWeight={600}
                        stroke="#000" strokeWidth={3} strokeLinejoin="round" paintOrder="stroke"
                      >
                        {(percent * 100).toFixed(0)}%
                      </text>
                    )
                  }}
                >
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatVND(v)} />
                <Legend
                  layout="vertical"
                  align="right"
                  verticalAlign="middle"
                  wrapperStyle={{ fontSize: 12, lineHeight: '20px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-1">Dự báo tài chính</h2>
        <p className="text-sm text-slate-400 mb-4">
          Dựa trên số dư hiện tại, khoản phải trả định kỳ và nợ đến hạn — không giả định thu nhập cố định.
          Tiền người khác nợ bạn không được tính vào cho tới khi thực sự nhận được.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="text-sm text-slate-500">Hiện tại</div>
            <div className="text-xl font-semibold mt-1">{formatVND(assets.liquidTotal)}</div>
          </div>
          {forecast.map((f) => (
            <div key={f.months} className="card">
              <div className="text-sm text-slate-500">Sau {f.months} tháng</div>
              <div className="text-xl font-semibold mt-1">{formatVND(f.projected)}</div>
              <div className="text-xs text-slate-400 mt-2 space-y-0.5">
                <div>Khoản phải trả định kỳ: -{formatVND(f.recurringOut)}</div>
                <div>Nợ đến hạn: -{formatVND(f.debtOut)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
