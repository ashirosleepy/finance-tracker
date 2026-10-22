import { useEffect, useMemo, useState } from 'react'
import { getTransactions, getInstallmentPayments, getBnplBills, payBill } from '../lib/queries'
import { buildBnplBills, localISO } from '../lib/calculations'
import { formatVND, formatDate } from '../lib/formatters'

// Hóa đơn theo kỳ của một hạn mức Shopee trả sau.
// account: một dòng của bnpl_balances. spendable: tài khoản thật dùng để trả.
export default function BnplBills({ account, userId, spendable, onChanged }) {
  const [tab, setTab] = useState('unpaid')
  const [data, setData] = useState(null)
  const [openKey, setOpenKey] = useState(null)
  const [payFrom, setPayFrom] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const [tx, ip, rows] = await Promise.all([
      getTransactions({ bnplAccountId: account.bnpl_id, type: 'bnpl_charge' }),
      getInstallmentPayments(),
      getBnplBills(account.bnpl_id),
    ])
    setData({ tx, ip: ip.filter((p) => p.plan?.bnpl_account_id === account.bnpl_id), rows })
  }
  useEffect(() => { load() }, [account.bnpl_id])

  const bills = useMemo(
    () => (data ? buildBnplBills({ account, charges: data.tx, installmentPayments: data.ip, billRows: data.rows }) : []),
    [data, account],
  )
  const unpaid = bills.filter((b) => !b.paid).sort((a, b) => a.key.localeCompare(b.key))
  const paid = bills.filter((b) => b.paid).sort((a, b) => b.key.localeCompare(a.key))
  const list = tab === 'unpaid' ? unpaid : paid
  const today = localISO()
  const from = payFrom || spendable[0]?.id || ''

  async function handlePay(bill) {
    if (!from) { alert('Hãy chọn tài khoản để trừ tiền.'); return }
    if (!confirm(`Xác nhận đã thanh toán hóa đơn tháng ${bill.month}/${bill.year} (${formatVND(bill.payable)})?`)) return
    setBusy(true)
    try {
      await payBill({ userId, account, bill, accountId: from })
      await load()
      onChanged?.()
    } catch (err) {
      alert('Không ghi nhận được thanh toán: ' + (err.message || err))
    } finally {
      setBusy(false)
    }
  }

  if (!data) return <div className="text-sm text-slate-400 mt-3">Đang tải hóa đơn...</div>

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
      <div className="flex gap-1 mb-3">
        {[['unpaid', `Chưa thanh toán (${unpaid.length})`], ['paid', 'Đã thanh toán']].map(([v, l]) => (
          <button key={v} onClick={() => { setTab(v); setOpenKey(null) }}
            className={`px-3 py-1.5 rounded-lg text-sm ${tab === v ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
            {l}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="text-sm text-slate-400">{tab === 'unpaid' ? 'Không có hóa đơn nào cần thanh toán.' : 'Chưa có hóa đơn nào đã thanh toán.'}</div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const open = openKey === b.key
            const overdue = !b.paid && b.dueDate < today
            return (
              <div key={b.key} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                <button className="w-full flex items-start justify-between gap-3 text-left" onClick={() => setOpenKey(open ? null : b.key)}>
                  <div className="min-w-0">
                    <div className="font-medium">tháng {b.month}</div>
                    <div className="text-xs text-slate-400">
                      Hóa đơn ngày {formatDate(b.statementDate)}, trả trễ nhất {formatDate(b.dueDate)}
                    </div>
                    {overdue && <span className="text-xs text-red-600 dark:text-red-400">Quá hạn</span>}
                    {b.paid && b.paidAt && <span className="text-xs text-brand-600 dark:text-brand-400">Đã trả {formatDate(b.paidAt)}</span>}
                  </div>
                  <div className="font-semibold whitespace-nowrap">{formatVND(b.paid ? b.total : b.payable)}</div>
                </button>

                {open && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {b.items.map((i) => (
                      <div key={i.id} className="flex justify-between gap-3 text-sm">
                        <div className="min-w-0">
                          <div className="truncate">{i.label}</div>
                          {i.fee > 0 && <div className="text-xs text-slate-400">Gốc {formatVND(i.principal)} + phí {formatVND(i.fee)}</div>}
                        </div>
                        <div className="whitespace-nowrap">{formatVND(i.amount)}</div>
                      </div>
                    ))}
                    {!b.paid && (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <select className="input py-2 sm:max-w-[200px]" value={from} onChange={(e) => setPayFrom(e.target.value)}>
                          {spendable.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                        <button className="btn-primary" disabled={busy} onClick={() => handlePay(b)}>
                          {busy ? 'Đang lưu...' : `Thanh toán ${formatVND(b.payable)}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
