import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  getAccounts, getInstallmentPlans, getInstallmentPayments, payInstallment, deleteInstallmentPlan,
} from '../lib/queries'
import { installmentStatus, installmentsDueInMonth, localISO } from '../lib/calculations'
import { formatVND, formatDate, INSTALLMENT_STATUS_LABELS, PLAN_STATUS_LABELS } from '../lib/formatters'

const STATUS_STYLE = {
  paid: 'text-brand-600 bg-brand-50 dark:text-brand-400 dark:bg-brand-500/10',
  overdue: 'text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/30',
  soon: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30',
  upcoming: 'text-slate-500 bg-slate-100 dark:text-slate-300 dark:bg-slate-800',
}
const PLAN_STYLE = {
  active: STATUS_STYLE.upcoming,
  overdue: STATUS_STYLE.overdue,
  completed: STATUS_STYLE.paid,
}

export default function Installments() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [payments, setPayments] = useState([])
  const [accounts, setAccounts] = useState([])
  const [payFrom, setPayFrom] = useState('')
  const [openId, setOpenId] = useState(null)
  const [busyId, setBusyId] = useState(null)

  async function load() {
    const [pl, pa, ac] = await Promise.all([getInstallmentPlans(), getInstallmentPayments(), getAccounts()])
    const spendable = ac.filter((a) => a.type !== 'savings')
    setPlans(pl); setPayments(pa); setAccounts(spendable)
    setPayFrom((prev) => prev || spendable[0]?.id || '')
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const byPlan = useMemo(() => {
    const map = {}
    for (const p of payments) (map[p.plan_id] ||= []).push(p)
    return map
  }, [payments])

  const today = localISO()
  const unpaid = payments.filter((p) => !p.paid_at)
  const overdueList = unpaid.filter((p) => installmentStatus(p, today) === 'overdue')
  const dueThisMonth = installmentsDueInMonth(unpaid)
  const overdueTotal = overdueList.reduce((s, p) => s + Number(p.amount), 0)

  async function handlePay(plan, payment) {
    if (!payFrom) { alert('Hãy chọn tài khoản để trừ tiền.'); return }
    if (!confirm(`Xác nhận đã thanh toán kỳ ${payment.period_no}/${plan.months} (${formatVND(payment.amount)})?`)) return
    setBusyId(payment.id)
    try {
      await payInstallment({ userId: user.id, plan, payment, accountId: payFrom })
      await load()
    } catch (err) {
      alert('Không ghi nhận được thanh toán: ' + (err.message || err))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeletePlan(plan) {
    if (!confirm(`Xóa kế hoạch "${plan.name}"? Giao dịch mua và các khoản đã trả của kế hoạch này cũng bị xóa (số dư tài khoản sẽ được hoàn lại).`)) return
    await deleteInstallmentPlan(plan.plan_id)
    setOpenId(null)
    await load()
  }

  if (loading) return <div className="text-slate-400">Đang tải...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Trả góp</h1>
      <p className="text-sm text-slate-400">
        Tạo khoản trả góp mới ở trang "Giao dịch": chọn loại "Mua bằng Shopee trả sau" rồi bật "Trả góp theo tháng".
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-slate-500">Phải trả tháng này</div>
          <div className="text-lg font-semibold mt-1">{formatVND(dueThisMonth)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-slate-500">Quá hạn ({overdueList.length} kỳ)</div>
          <div className={`text-lg font-semibold mt-1 ${overdueTotal > 0 ? 'text-red-600 dark:text-red-400' : ''}`}>{formatVND(overdueTotal)}</div>
        </div>
        <div className="card">
          <label className="label">Trừ tiền từ tài khoản</label>
          <select className="input" value={payFrom} onChange={(e) => setPayFrom(e.target.value)}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      </div>

      {plans.length === 0 ? <div className="card text-center text-slate-400">Chưa có khoản trả góp nào.</div> : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const rows = byPlan[plan.plan_id] || []
            const open = openId === plan.plan_id
            const pct = plan.months > 0 ? (plan.paid_count / plan.months) * 100 : 0
            return (
              <div key={plan.plan_id} className="card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{plan.name}</div>
                    <div className="text-xs text-slate-400">
                      {plan.bnpl_name} · {plan.months} tháng · mua {formatVND(plan.total_amount)}
                      {Number(plan.fee_total) > 0 && ` · phí ${formatVND(plan.fee_total)}`}
                    </div>
                  </div>
                  <span className={`text-xs rounded px-2 py-0.5 whitespace-nowrap ${PLAN_STYLE[plan.status]}`}>{PLAN_STATUS_LABELS[plan.status]}</span>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mt-3">
                  <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-sm mt-2">
                  <span className="text-slate-500">Đã trả {plan.paid_count}/{plan.months} kỳ · {formatVND(plan.paid_amount)}</span>
                  <span className="font-medium">Còn lại {formatVND(plan.remaining_amount)}</span>
                </div>
                {plan.next_due_date && (
                  <div className="text-xs text-slate-400 mt-1">Kỳ tiếp theo: {formatDate(plan.next_due_date)}</div>
                )}

                <div className="flex gap-4 mt-3">
                  <button className="text-sm font-medium text-brand-600 dark:text-brand-400" onClick={() => setOpenId(open ? null : plan.plan_id)}>
                    {open ? 'Ẩn các kỳ' : 'Xem các kỳ'}
                  </button>
                  <button className="text-sm text-slate-400 hover:text-red-600" onClick={() => handleDeletePlan(plan)}>Xóa kế hoạch</button>
                </div>

                {open && (
                  <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    {rows.map((p) => {
                      const st = installmentStatus(p, today)
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <div>Kỳ {p.period_no}/{plan.months} · {formatDate(p.due_date)}</div>
                            <div className="text-xs text-slate-400">
                              Gốc {formatVND(p.principal_amount)}{Number(p.fee_amount) > 0 && ` + phí ${formatVND(p.fee_amount)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-medium whitespace-nowrap">{formatVND(p.amount)}</span>
                            <span className={`text-xs rounded px-2 py-0.5 whitespace-nowrap ${STATUS_STYLE[st]}`}>{INSTALLMENT_STATUS_LABELS[st]}</span>
                            {!p.paid_at && (
                              <button
                                className="btn-secondary text-xs"
                                disabled={busyId === p.id}
                                onClick={() => handlePay(plan, p)}
                              >
                                {busyId === p.id ? '...' : 'Đã thanh toán'}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
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
