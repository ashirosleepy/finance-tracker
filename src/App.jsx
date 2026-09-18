// 1. Đổi BrowserRouter thành HashRouter ở dòng import
import { HashRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Accounts from './pages/Accounts'
import Debts from './pages/Debts'
import CreditCards from './pages/CreditCards'
import RecurringPayments from './pages/RecurringPayments'
import Savings from './pages/Savings'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      {/* 2. Thay BrowserRouter bằng HashRouter. Bạn có thể xóa luôn phần basename đi vì HashRouter không cần nữa */}
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="accounts" element={<Accounts />} />
            <Route path="debts" element={<Debts />} />
            <Route path="credit-cards" element={<CreditCards />} />
            <Route path="recurring" element={<RecurringPayments />} />
            <Route path="savings" element={<Savings />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}