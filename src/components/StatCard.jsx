export default function StatCard({ label, value, tone = 'default', sub }) {
  const toneClass = {
    default: 'text-slate-900',
    positive: 'text-brand-600',
    negative: 'text-red-600',
    neutral: 'text-slate-500',
  }[tone]

  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      {sub && <div className="text-sm text-slate-400 mt-1">{sub}</div>}
    </div>
  )
}
