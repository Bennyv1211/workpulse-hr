import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail, User, ShieldCheck, Building2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Signup() {
  const { registerHr } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    security_question: "What is your first pet's name?",
    security_answer: '',
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (!/[A-Z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password)) {
      setError('Password must include an uppercase letter, a number, and a special character.')
      return
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await registerHr(form)
      navigate('/dashboard')
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to create HR account.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0f172a,_#1d4ed8_45%,_#38bdf8)] flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-[1.1fr_0.9fr] rounded-[2rem] overflow-hidden shadow-2xl border border-white/15 bg-white">
        <div className="hidden lg:flex flex-col justify-between p-10 bg-slate-950 text-white">
          <div>
            <img src="/emplora-wordmark.svg" alt="Emplora" className="h-14 w-auto brightness-0 invert" />
            <p className="mt-8 text-4xl font-bold leading-tight">
              Create the HR workspace that will manage employees, managers, payroll, leave approvals, paystubs, and reporting.
            </p>
            <p className="mt-5 text-slate-300 text-lg leading-8">
              This web signup is intentionally reserved for HR account creation. Employees do not register here, and manager access is added from inside the system.
            </p>
          </div>

          <div className="grid gap-4">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="flex items-center gap-3 mb-2">
                <ShieldCheck className="w-5 h-5 text-cyan-300" />
                <p className="font-semibold">HR-only onboarding</p>
              </div>
              <p className="text-sm text-slate-300">The account created here becomes the HR control center for your company setup.</p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="w-5 h-5 text-cyan-300" />
                <p className="font-semibold">Built for company rollout</p>
              </div>
              <p className="text-sm text-slate-300">Once inside, HR can create employees and managers, assign pay details, and manage leave balances and payroll.</p>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10">
          <div className="text-center lg:text-left mb-8">
            <img src="/emplora-wordmark.svg" alt="Emplora" className="h-12 mx-auto lg:mx-0 mb-4" />
            <p className="text-gray-500 mt-1">Create an HR admin account for your company workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">First Name</span>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input className="input pl-10" value={form.first_name} onChange={handleChange('first_name')} required />
                </div>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">Last Name</span>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input className="input pl-10" value={form.last_name} onChange={handleChange('last_name')} required />
                </div>
              </label>
            </div>

            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Company Name</span>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input className="input pl-10" value={form.company_name} onChange={handleChange('company_name')} placeholder="Emplora Ltd" required />
              </div>
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Work Email</span>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type="email" className="input pl-10" value={form.email} onChange={handleChange('email')} placeholder="hr@company.com" required />
              </div>
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Password</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} className="input pl-10 pr-10" value={form.password} onChange={handleChange('password')} required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</span>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input type={showConfirmPassword ? 'text' : 'password'} className="input pl-10 pr-10" value={form.confirmPassword} onChange={handleChange('confirmPassword')} required />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowConfirmPassword((current) => !current)}>
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Security Question</span>
              <select className="input" value={form.security_question} onChange={handleChange('security_question')} required>
                <option>What is your first pet&apos;s name?</option>
                <option>What city were you born in?</option>
                <option>What was the name of your first school?</option>
                <option>What is your mother’s maiden name?</option>
              </select>
            </label>

            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-2">Security Answer</span>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input className="input pl-10" value={form.security_answer} onChange={handleChange('security_answer')} required />
              </div>
            </label>

            <button type="submit" disabled={loading} className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Creating HR Account...' : 'Create HR Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an HR or manager account?{' '}
            <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
