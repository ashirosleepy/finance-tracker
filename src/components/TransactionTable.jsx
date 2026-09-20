import { Fragment } from 'react'
import { formatVND, formatDateTime, TRANSACTION_TYPE_LABELS } from '../lib/formatters'

const EXPENSE_TYPES = new Set(['expense', 'credit_card_charge', 'debt_repay', 'debt_lend', 'credit_card_payment'])
const INCOME_TYPES = new Set(['income', 'debt_collect', 'debt_borrow'])

function rowMeta(t) {
  const sign = INCOME_TYPES.has(t.type) ? '+' : t.type === 'transfer' || t.type === 'adjustment' ? '' : '-'
  const color = INCOME_TYPES.has(t.type)
    ? 'text-brand-600 dark:text-brand-400'
    : sign === '-'
      ? 'text-red-600 dark:text-red-400'
      : 'text-slate-600 dark:text-slate-300'
  return { sign, color }
}

const WEEKDAY_LABELS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

function dayKey(dateStr) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(dateStr) {
  const d = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)

  const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const dateStrFmt = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

  if (isSameDay(d, today)) return `Hôm nay · ${dateStrFmt}`
  if (isSameDay(d, yesterday)) return `Hôm qua · ${dateStrFmt}`
  return `${WEEKDAY_LABELS[d.getDay()]} · ${dateStrFmt}`
}

// Groups an already-sorted transaction list into consecutive same-day buckets,
// each with a net total (income minus expense) for that day.
function groupByDay(transactions) {
  const groups = []
  let current = null

  for (const t of transactions) {
    const key = dayKey(t.occurred_at)
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(t.occurred_at), items: [], net: 0 }
      groups.push(current)
    }
    current.items.push(t)
    if (t.affects_balance !== false) {
      const { sign } = rowMeta(t)
      if (sign === '+') current.net += t.amount
      else if (sign === '-') current.net -= t.amount
    }
  }
  return groups
}

// onEdit(transaction) — pass the row so the caller can feed it into
// TransactionForm as `initialData` and call updateTransaction on submit.
export default function TransactionTable({ transactions, onDelete, onEdit }) {
  if (transactions.length === 0) {
    return <div className="card text-center text-slate-400">Chưa có giao dịch nào.</div>
  }

  const dayGroups = groupByDay(transactions)

  return (
    <>
      {/* Mobile: stacked cards — a wide table doesn't fit comfortably on a phone */}
      <div className="sm:hidden space-y-4">
        {dayGroups.map((group) => (
          <div key={group.key}>
            <div className="flex items-center justify-between px-1 mb-2">
              <div className="text-sm font-medium text-slate-500">{group.label}</div>
              {group.net !== 0 && (
                <div className={`text-sm font-medium ${group.net > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>
                  {group.net > 0 ? '+' : ''}{formatVND(group.net)}
                </div>
              )}
            </div>
            <div className="space-y-3">
              {group.items.map((t) => {
                const { sign, color } = rowMeta(t)
                return (
                  <div key={t.id} className="card">
                    <div className="flex justify-between items-start gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.description || TRANSACTION_TYPE_LABELS[t.type]}</div>
                        <div className="text-sm text-slate-400">{formatDateTime(t.occurred_at)}</div>
                      </div>
                      <div className={`text-lg font-semibold whitespace-nowrap ${color}`}>{sign}{formatVND(t.amount)}</div>
                    </div>
                    <div className="text-sm text-slate-500 mt-2">
                      {TRANSACTION_TYPE_LABELS[t.type]}
                      {t.category?.name && ` · ${t.category.name}`}
                      {(t.from_account || t.to_account) && (
                        <> · {t.from_account?.name || ''}{t.from_account && t.to_account ? ' → ' : ''}{t.to_account?.name || ''}</>
                      )}
                    </div>
                    {t.affects_balance === false && (
                      <div className="text-xs text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30 rounded px-2 py-1 mt-2 inline-block">
                        Không tính vào số dư
                      </div>
                    )}
                    <div className="flex gap-4 mt-3 pt-3 border-t border-slate-50 dark:border-slate-800">
                      <button className="text-sm font-medium text-brand-600 dark:text-brand-400" onClick={() => onEdit?.(t)}>Sửa</button>
                      <button className="text-sm font-medium text-red-600 dark:text-red-400" onClick={() => onDelete(t.id)}>Xóa</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden sm:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
              <th className="py-2 pr-3">Ngày</th>
              <th className="py-2 pr-3">Loại</th>
              <th className="py-2 pr-3">Mô tả</th>
              <th className="py-2 pr-3">Tài khoản</th>
              <th className="py-2 pr-3 text-right">Số tiền</th>
              <th className="py-2 pl-3"></th>
            </tr>
          </thead>
          <tbody>
            {dayGroups.map((group) => (
              <Fragment key={group.key}>
                <tr className="bg-slate-50 dark:bg-slate-800/60">
                  <td colSpan={6} className="py-1.5 px-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{group.label}</span>
                      {group.net !== 0 && (
                        <span className={`text-xs font-medium ${group.net > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-red-600 dark:text-red-400'}`}>
                          {group.net > 0 ? '+' : ''}{formatVND(group.net)}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {group.items.map((t) => {
                  const { sign, color } = rowMeta(t)
                  return (
                    <tr key={t.id} className="border-b border-slate-50 last:border-0 dark:border-slate-800">
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{formatDateTime(t.occurred_at)}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{TRANSACTION_TYPE_LABELS[t.type]}</td>
                      <td className="py-2 pr-3">
                        {t.description}
                        {t.category?.name && <span className="text-slate-400"> · {t.category.name}</span>}
                        {t.affects_balance === false && (
                          <span className="ml-2 text-xs text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30 rounded px-1.5 py-0.5">
                            Không tính vào số dư
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                        {t.from_account?.name || ''}{t.from_account && t.to_account ? ' → ' : ''}{t.to_account?.name || ''}
                      </td>
                      <td className={`py-2 pr-3 text-right font-medium whitespace-nowrap ${color}`}>
                        {sign}{formatVND(t.amount)}
                      </td>
                      <td className="py-2 pl-3 text-right whitespace-nowrap">
                        <button className="text-sm text-slate-400 hover:text-brand-600 mr-3" onClick={() => onEdit?.(t)}>
                          Sửa
                        </button>
                        <button className="text-sm text-slate-400 hover:text-red-600" onClick={() => onDelete(t.id)}>
                          Xóa
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
