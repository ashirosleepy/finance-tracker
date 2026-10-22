import { useEffect, useMemo, useState } from 'react'
import { getInstallmentPlans, getInstallmentPayments, deleteInstallmentPlan } from '../lib/queries'
import { installmentStatus, installmentsDueInMonth, localISO } from '../lib/calculations'
import { billForDueDate, SHOPEE_STATEMENT_DAY, SHOPEE_DUE_DAY } from '../lib/shopeeBill'
import { formatVND, formatDate } from '../lib/formatters'

const INSTALLMENT_STATUS_LABELS = {
  paid: 'Đã thanh toán',
  overdue: 'Quá hạn',
  soon: 'Sắp đến hạn',
  upcoming: 'Chưa đến hạn',
}
const PLAN_STATUS_LABELS = {
  active: 'Đang trả',
  overdue: 'Có kỳ quá hạn',
  completed: 'Đã tất toán',
}

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

// Trang này chỉ theo dõi. Các kỳ trả góp được thanh toán cùng hóa đơn tháng
// (xem "Shopee trả sau" → Xem hóa đơn), không thanh toán lẻ từng kỳ.
export default function Installments() {
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [payments, setPayments] = useState([])
  const [openId, setOpenId] = useState(null)

  async function load() {
    const [pl, pa] = await Promise.all([getInstallmentPlans(), getInstallmentPayments()])
    setPlans(pl); setPayments(pa)
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
        Mỗi kỳ trả góp nằm trong hóa đơn tháng tương ứng và được thanh toán cùng hóa đơn đó.
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
          <div className="text-sm text-slate-500">Cách thanh toán</div>
          <div className="text-sm mt-1">
            Hóa đơn chốt ngày {SHOPEE_STATEMENT_DAY}, hạn trả ngày {SHOPEE_DUE_DAY} tháng sau. Trả cả hóa đơn một lần.
          </div>
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
                  <div className="text-xs text-slate-400 mt-1">Kỳ tiếp theo: hạn trả {formatDate(plan.next_due_date)}</div>
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
                      const bill = billForDueDate(p.due_date)
                      return (
                        <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <div>Kỳ {p.period_no}/{plan.months} · hóa đơn tháng {bill.month}/{bill.year}</div>
                            <div className="text-xs text-slate-400">
                              Hạn trả {formatDate(p.due_date)} · Gốc {formatVND(p.principal_amount)}{Number(p.fee_amount) > 0 && ` + phí ${formatVND(p.fee_amount)}`}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-medium whitespace-nowrap">{formatVND(p.amount)}</span>
                            <span className={`text-xs rounded px-2 py-0.5 whitespace-nowrap ${STATUS_STYLE[st]}`}>{INSTALLMENT_STATUS_LABELS[st]}</span>
                          </div>
                        </div>
                      )
                    })}
                    <div className="text-xs text-slate-400 pt-1">
                      Muốn trả kỳ nào, hãy thanh toán hóa đơn tháng chứa kỳ đó ở trang "Shopee trả sau".
                    </div>
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
