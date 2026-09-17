import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Giao dịch' },
  { to: '/accounts', label: 'Tài khoản' },
  { to: '/debts', label: 'Nợ' },
  { to: '/credit-cards', label: 'Thẻ tín dụng' },
  { to: '/recurring', label: 'Khoản phải trả' },
  { to: '/savings', label: 'Tiết kiệm' },
  { to: '/reports', label: 'Báo cáo' },
  { to: '/settings', label: 'Cài đặt' },
]

export default function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <aside className="md:w-56 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-100">
        <div className="p-4 font-semibold text-brand-700 text-lg">💰 Tài chính</div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible px-2 pb-2 md:pb-4 gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `whitespace-nowrap px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block mt-auto p-4 border-t border-slate-100 text-xs text-slate-400">
          <div className="truncate mb-2">{user?.email}</div>
          <button onClick={signOut} className="btn-secondary w-full text-xs">
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
