import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Leave from './pages/Leave'
import Attendance from './pages/Attendance'
import Payroll from './pages/Payroll'
import Paystubs from './pages/Paystubs'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import { canAccessWebDashboard, getDashboardPathForRole, isHrRole } from './lib/roles'

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
    </div>
  )
}

function PublicOnlyRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <FullPageSpinner />
  }

  if (user && canAccessWebDashboard(user.role)) {
    return <Navigate to={getDashboardPathForRole(user.role)} replace />
  }

  return children
}

function ProtectedRoute({ children, hrOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <FullPageSpinner />
  }

  if (!user || !canAccessWebDashboard(user.role)) {
    return <Navigate to="/login" replace />
  }

  if (hrOnly && !isHrRole(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <Login />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <Signup />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPassword />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route
            path="employees"
            element={
              <ProtectedRoute hrOnly>
                <Employees />
              </ProtectedRoute>
            }
          />
          <Route path="leave" element={<Leave />} />
          <Route path="attendance" element={<Attendance />} />
          <Route
            path="payroll"
            element={
              <ProtectedRoute hrOnly>
                <Payroll />
              </ProtectedRoute>
            }
          />
          <Route
            path="paystubs"
            element={
              <ProtectedRoute hrOnly>
                <Paystubs />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute hrOnly>
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
