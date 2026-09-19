import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
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
      <aside className="sticky top-0 z-10 md:z-auto md:h-screen md:sticky md:top-0 md:w-56 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-100 dark:bg-slate-900 dark:border-slate-800">
        <div className="p-4 flex items-center justify-between">
          <span className="font-semibold text-brand-700 dark:text-brand-400 text-xl">💰 Tài chính</span>
          <ThemeToggle />
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible px-2 pb-2 md:pb-4 gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `whitespace-nowrap px-3.5 py-2.5 rounded-lg text-base font-medium min-h-[44px] flex items-center ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                    : 'text-slate-600 hover:bg-slate-50 active:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:active:bg-slate-800'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block mt-auto p-4 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-400">
          <div className="truncate mb-2">{user?.email}</div>
          <button onClick={signOut} className="btn-secondary w-full">
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        <Outlet />
        {/* Sign-out stays reachable on mobile since the sidebar footer is hidden there */}
        <div className="md:hidden mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-sm text-slate-400">
          <div className="truncate mb-2">{user?.email}</div>
          <button onClick={signOut} className="btn-secondary w-full">
            Đăng xuất
          </button>
        </div>
      </main>
    </div>
  )
}
