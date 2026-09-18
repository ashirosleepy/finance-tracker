import { formatVND, formatDateTime, TRANSACTION_TYPE_LABELS } from '../lib/formatters'

const EXPENSE_TYPES = new Set(['expense', 'credit_card_charge', 'debt_repay', 'debt_lend', 'credit_card_payment'])
const INCOME_TYPES = new Set(['income', 'debt_collect', 'debt_borrow'])

function rowMeta(t) {
  const sign = INCOME_TYPES.has(t.type) ? '+' : t.type === 'transfer' || t.type === 'adjustment' ? '' : '-'
  const color = INCOME_TYPES.has(t.type) ? 'text-brand-600' : sign === '-' ? 'text-red-600' : 'text-slate-600'
  return { sign, color }
}

// onEdit(transaction) — pass the row so the caller can feed it into
// TransactionForm as `initialData` and call updateTransaction on submit.
export default function TransactionTable({ transactions, onDelete, onEdit }) {
  if (transactions.length === 0) {
    return <div className="card text-center text-slate-400">Chưa có giao dịch nào.</div>
  }

  return (
    <>
      {/* Mobile: stacked cards — a wide table doesn't fit comfortably on a phone */}
      <div className="sm:hidden space-y-3">
        {transactions.map((t) => {
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
              <div className="flex gap-4 mt-3 pt-3 border-t border-slate-50">
                <button className="text-sm font-medium text-brand-600" onClick={() => onEdit?.(t)}>Sửa</button>
                <button className="text-sm font-medium text-red-600" onClick={() => onDelete(t.id)}>Xóa</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Desktop / tablet: table */}
      <div className="hidden sm:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-slate-100">
              <th className="py-2 pr-3">Ngày</th>
              <th className="py-2 pr-3">Loại</th>
              <th className="py-2 pr-3">Mô tả</th>
              <th className="py-2 pr-3">Tài khoản</th>
              <th className="py-2 pr-3 text-right">Số tiền</th>
              <th className="py-2 pl-3"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const { sign, color } = rowMeta(t)
              return (
                <tr key={t.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{formatDateTime(t.occurred_at)}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{TRANSACTION_TYPE_LABELS[t.type]}</td>
                  <td className="py-2 pr-3">
                    {t.description}
                    {t.category?.name && <span className="text-slate-400"> · {t.category.name}</span>}
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
          </tbody>
        </table>
      </div>
    </>
  )
}
