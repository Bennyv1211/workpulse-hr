import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Check,
  ShieldCheck,
  Briefcase,
  ChevronDown,
  ArrowLeft,
} from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(email, password, rememberMe)
      if (['super_admin', 'hr_admin', 'hr'].includes(user.role) && !['active', 'trial'].includes(user.subscription_status)) {
        navigate('/dashboard/billing')
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0f172a,_#1d4ed8_45%,_#38bdf8)] p-3 sm:p-4">
      <div className="w-full max-w-6xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl border border-white/15 bg-white">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200/80 bg-white/95 backdrop-blur">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary-600"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <img src="/emplora-wordmark.svg" alt="Emplora" className="h-9 w-auto" />
        </div>

        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col p-6 sm:p-8 lg:p-10 bg-slate-950 text-white">
            <div>
              <img src="/emplora-wordmark.svg" alt="Emplora" className="h-12 w-auto lg:h-14" />
              <p className="mt-6 text-3xl lg:text-4xl font-bold leading-tight">
                The control center for HR and managers who need payroll, leave, people data, and live team visibility in one place.
              </p>
              <p className="mt-5 text-slate-300 text-base lg:text-lg leading-8">
                This web dashboard is intentionally locked down for leadership users only, so approvals, payroll reviews, paystubs, and employee changes stay in the right hands.
              </p>
            </div>

            <div className="grid gap-4 mt-8">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-300" />
                  <p className="font-semibold">HR-only account creation</p>
                </div>
                <p className="text-sm text-slate-300">Only HR admins can sign up from the web. Employees are not created here.</p>
              </div>
              <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <div className="flex items-center gap-3 mb-2">
                  <Briefcase className="w-5 h-5 text-cyan-300" />
                  <p className="font-semibold">Manager-safe access</p>
                </div>
                <p className="text-sm text-slate-300">Managers can sign in and work from their dashboard, but payroll and HR-only tools stay restricted.</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 lg:p-10">
            <div className="text-center lg:text-left mb-8">
              <img src="/emplora-wordmark.svg" alt="Emplora" className="h-12 mx-auto lg:mx-0 mb-4" />
              <p className="text-gray-500 mt-1">Sign in for HR admins and managers only.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input pl-10" placeholder="Enter your work email" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input pl-10 pr-10" placeholder="Enter your password" required />
                  <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setRememberMe((current) => !current)}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${rememberMe ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`}
                >
                  {rememberMe && <Check className="w-3 h-3 text-white" />}
                </button>
                <label className="ml-2 text-sm text-gray-600 cursor-pointer" onClick={() => setRememberMe((current) => !current)}>
                  Remember me
                </label>
              </div>

              <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-6 p-4 bg-primary-50 rounded-lg">
              <p className="text-sm font-medium text-primary-700 text-center mb-2">Demo Accounts</p>
              <p className="text-xs text-gray-600 text-center">(HR) hr@company.com | (Manager) manager@company.com</p>
              <p className="text-xs text-primary-600 text-center mt-1">Password: Test123!</p>
            </div>

            <div className="mt-6 text-center text-sm text-gray-600">
              <Link to="/forgot-password" className="text-primary-600 font-semibold hover:text-primary-700">
                Forgot password?
              </Link>
            </div>

            <div className="mt-4 text-center text-sm text-gray-600">
              Need a new HR workspace?{' '}
              <Link to="/signup" className="text-primary-600 font-semibold hover:text-primary-700">
                Create an HR account
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowTerms((current) => !current)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-base font-semibold text-slate-900">Terms & Privacy</span>
                <ChevronDown className={`w-5 h-5 text-slate-500 transition-transform ${showTerms ? 'rotate-180' : ''}`} />
              </button>
              {showTerms && (
                <div className="px-5 pb-5 text-sm text-slate-600">
                  <p className="leading-6">
                    Emplora collects the data needed to run the platform, including account details, employee
                    records, attendance activity, leave requests, payroll and paystub information, session details,
                    and location data when GPS attendance features are used.
                  </p>
                  <p className="leading-6 mt-3">
                    We use this information solely for app functionality: secure sign-in, workforce management,
                    approvals, payroll processing, paystub delivery, reporting, backups, and system reliability.
                  </p>
                  <p className="leading-6 mt-3">
                    We do not sell your data, and we do not send it to third-party apps for advertising or resale.
                    Data is only handled as needed to operate and support the service.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
