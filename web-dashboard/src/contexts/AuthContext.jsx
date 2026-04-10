import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { canAccessWebDashboard, isHrRole } from '../lib/roles'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('token'))

  useEffect(() => {
    if (token) {
      fetchUser()
      return
    }
    setLoading(false)
  }, [token])

  const clearSession = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('remember_me')
    setToken(null)
    setUser(null)
  }

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me')
      const userData = response.data
      if (!canAccessWebDashboard(userData.role)) {
        clearSession()
        throw new Error('This web dashboard is only available for HR and managers.')
      }
      setUser(userData)
    } catch (error) {
      clearSession()
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password, rememberMe = false) => {
    const response = await api.post('/auth/login', { email, password, remember_me: rememberMe })
    const { access_token, user: userData } = response.data

    if (!canAccessWebDashboard(userData.role)) {
      throw new Error('This sign-in is only for HR and managers.')
    }

    localStorage.setItem('token', access_token)
    if (rememberMe) {
      localStorage.setItem('remember_me', 'true')
    } else {
      localStorage.removeItem('remember_me')
    }

    setToken(access_token)
    setUser(userData)
    return userData
  }

  const registerHr = async ({ email, password, first_name, last_name, security_question, security_answer }) => {
    const response = await api.post('/auth/register', {
      email,
      password,
      first_name,
      last_name,
      role: 'hr_admin',
      security_question,
      security_answer,
    })

    const { access_token, user: userData } = response.data
    if (!isHrRole(userData.role)) {
      throw new Error('Only HR accounts can be created from the web dashboard.')
    }

    localStorage.setItem('token', access_token)
    setToken(access_token)
    setUser(userData)
    return userData
  }

  const logout = () => {
    clearSession()
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      registerHr,
      isHr: isHrRole(user?.role),
    }),
    [loading, token, user]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
