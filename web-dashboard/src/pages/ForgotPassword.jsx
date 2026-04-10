import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const requestQuestion = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/forgot-password', { email })
      setQuestion(response.data.security_question)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to find that account.')
    } finally {
      setLoading(false)
    }
  }

  const verifyAnswer = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await api.post('/auth/verify-security-answer', {
        email,
        security_answer: answer,
      })
      setToken(response.data.reset_token)
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Verification failed.')
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async () => {
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', {
        email,
        reset_token: token,
        new_password: newPassword,
      })
      setSuccess('Password updated. You can sign in now.')
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Unable to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#0f172a,_#1d4ed8_45%,_#38bdf8)] flex items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-[2rem] shadow-2xl border border-white/15 bg-white p-8 space-y-5">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Reset Password</h1>
          <p className="text-slate-500 mt-2">Use your security question to set a new password.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
          <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>

        {!question && (
          <button type="button" className="w-full btn-primary py-3" disabled={loading} onClick={requestQuestion}>
            {loading ? 'Loading...' : 'Show Security Question'}
          </button>
        )}

        {!!question && !token && (
          <>
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-slate-700 font-medium">{question}</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Answer</label>
              <input className="input" value={answer} onChange={(event) => setAnswer(event.target.value)} />
            </div>
            <button type="button" className="w-full btn-primary py-3" disabled={loading} onClick={verifyAnswer}>
              {loading ? 'Verifying...' : 'Verify Answer'}
            </button>
          </>
        )}

        {!!token && !success && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <input className="input" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              <p className="text-xs text-slate-500 mt-2">Minimum 8 characters with uppercase, number, and special character.</p>
            </div>
            <button type="button" className="w-full btn-primary py-3" disabled={loading} onClick={resetPassword}>
              {loading ? 'Updating...' : 'Reset Password'}
            </button>
          </>
        )}

        <div className="text-sm text-slate-600 text-center">
          <Link to="/login" className="text-primary-600 font-semibold hover:text-primary-700">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
