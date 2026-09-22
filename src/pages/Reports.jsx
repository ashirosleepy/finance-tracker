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
  const [monthOffset, setMonthOffset] = useState(0) // 0 = tháng này, -1 = tháng trước, ... (chỉ dùng khi period === 'month')
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

  // The month currently being viewed when period === 'month' (offset from this month).
  const selectedMonthDate = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() + monthOffset, 1),
    [monthOffset],
  )

  const rangeStart = useMemo(() => {
    const d = new Date(now)
    if (period === 'day') d.setHours(0, 0, 0, 0)
    else if (period === 'week') { d.setDate(d.getDate() - 7) }
    else if (period === 'month') return new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1)
    else { d.setMonth(0, 1); d.setHours(0, 0, 0, 0) }
    return d
  }, [period, selectedMonthDate])

  // For a past month, the range should end at the month's last moment rather than "now".
  const rangeEnd = useMemo(() => {
    if (period === 'month' && monthOffset !== 0) {
      return new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth() + 1, 0, 23, 59, 59)
    }
    return now
  }, [period, monthOffset, selectedMonthDate])

  const income = totalIncome(transactions, rangeStart, rangeEnd)
  const expense = totalExpense(transactions, rangeStart, rangeEnd)
  const categoryData = expenseByCategory(transactions, rangeStart, rangeEnd)

  // Trend chart can show the last 6 months or the whole current year,
  // and clicking a month bar drills into a day-by-day view of that month.
  const [trendMode, setTrendMode] = useState('6m') // '6m' | 'year'
  const [drillMonth, setDrillMonth] = useState(null) // { year, month } | null

  const monthlyTrend = useMemo(() => {
    const months = []
    if (trendMode === 'year') {
      for (let m = 0; m < 12; m++) months.push(new Date(now.getFullYear(), m, 1))
    } else {
      for (let i = 5; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1))
    }
    return months.map((d) => {
      const start = new Date(d.getFullYear(), d.getMonth(), 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      return {
        month: `${d.getMonth() + 1}/${d.getFullYear()}`,
        monthIndex: d.getMonth(),
        year: d.getFullYear(),
        Thu: totalIncome(transactions, start, end),
        Chi: totalExpense(transactions, start, end),
      }
    })
  }, [transactions, trendMode])

  // Daily breakdown for the month the user drilled into.
  const dailyTrend = useMemo(() => {
    if (!drillMonth) return []
    const { year, month } = drillMonth
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const lastDay = (year === now.getFullYear() && month === now.getMonth())
      ? now.getDate()
      : daysInMonth
    const days = []
    for (let day = 1; day <= lastDay; day++) days.push(day)
    return days.map((day) => {
      const start = new Date(year, month, day, 0, 0, 0)
      const end = new Date(year, month, day, 23, 59, 59)
      return {
        day: `${day}`,
        Thu: totalIncome(transactions, start, end),
        Chi: totalExpense(transactions, start, end),
      }
    })
  }, [transactions, drillMonth])

  const assets = computeAssetTotals(accountBalances)
  const forecast = buildForecast({ currentLiquid: assets.liquidTotal, recurringPayments: recurring, debtBalances })

  if (loading) return <div className="text-slate-400">Đang tải...</div>

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold">Báo cáo</h1>

      <div className="flex flex-wrap items-center gap-2">
        {[['day', 'Hôm nay'], ['week', '7 ngày'], ['month', 'Tháng này'], ['year', 'Năm nay']].map(([v, l]) => (
          <button key={v} onClick={() => { setPeriod(v); if (v === 'month') setMonthOffset(0) }}
            className={`px-3 py-1.5 rounded-lg text-sm ${period === v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
            {l}
          </button>
        ))}
        {period === 'month' && (
          <div className="flex items-center gap-1 ml-1">
            <button
              onClick={() => setMonthOffset((o) => o - 1)}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm bg-slate-100 text-slate-600"
              aria-label="Tháng trước"
            >
              ‹
            </button>
            <span className="text-sm text-slate-600 min-w-[64px] text-center">
              {monthOffset === 0 ? 'Tháng này' : `${selectedMonthDate.getMonth() + 1}/${selectedMonthDate.getFullYear()}`}
            </span>
            <button
              onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
              disabled={monthOffset >= 0}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-sm bg-slate-100 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Tháng sau"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card"><div className="text-sm text-slate-500">Tổng thu</div><div className="text-xl font-semibold text-brand-600">{formatVND(income)}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Tổng chi</div><div className="text-xl font-semibold text-red-600">{formatVND(expense)}</div></div>
        <div className="card"><div className="text-sm text-slate-500">Chênh lệch</div><div className={`text-xl font-semibold ${income - expense >= 0 ? 'text-brand-600' : 'text-red-600'}`}>{formatVND(income - expense)}</div></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="text-sm font-semibold text-slate-500">
              {drillMonth
                ? `Thu vs Chi theo ngày — Tháng ${drillMonth.month + 1}/${drillMonth.year}`
                : `Thu vs Chi (${trendMode === 'year' ? 'cả năm' : '6 tháng gần đây'})`}
            </div>
            {drillMonth ? (
              <button
                onClick={() => setDrillMonth(null)}
                className="text-xs text-brand-600 hover:underline shrink-0"
              >
                ← Quay lại
              </button>
            ) : (
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => setTrendMode('6m')}
                  className={`px-2 py-1 rounded text-xs ${trendMode === '6m' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  6 tháng
                </button>
                <button
                  onClick={() => setTrendMode('year')}
                  className={`px-2 py-1 rounded text-xs ${trendMode === 'year' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  Cả năm
                </button>
              </div>
            )}
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={drillMonth ? dailyTrend : monthlyTrend}>
              <XAxis dataKey={drillMonth ? 'day' : 'month'} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => (v / 1000000).toFixed(0) + 'tr'} />
              <Tooltip formatter={(v) => formatVND(v)} />
              <Legend />
              <Bar
                dataKey="Thu" fill="#0f9d78" radius={[4, 4, 0, 0]}
                cursor={!drillMonth ? 'pointer' : 'default'}
                onClick={!drillMonth ? (data) => setDrillMonth({ year: data.year, month: data.monthIndex }) : undefined}
              />
              <Bar
                dataKey="Chi" fill="#ef4444" radius={[4, 4, 0, 0]}
                cursor={!drillMonth ? 'pointer' : 'default'}
                onClick={!drillMonth ? (data) => setDrillMonth({ year: data.year, month: data.monthIndex }) : undefined}
              />
            </BarChart>
          </ResponsiveContainer>
          {!drillMonth && (
            <div className="text-xs text-slate-400 mt-2">Bấm vào cột để xem chi tiết theo ngày trong tháng đó.</div>
          )}
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
