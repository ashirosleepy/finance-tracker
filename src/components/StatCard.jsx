export default function StatCard({ label, value, tone = 'default', sub }) {
  const toneClass = {
    default: 'text-slate-900 dark:text-slate-100',
    positive: 'text-brand-600 dark:text-brand-400',
    negative: 'text-red-600 dark:text-red-400',
    neutral: 'text-slate-500 dark:text-slate-300',
  }[tone]

  return (
    <div className="card">
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      {sub && <div className="text-sm text-slate-400 dark:text-slate-500 mt-1">{sub}</div>}
    </div>
  )
}
