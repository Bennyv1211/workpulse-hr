import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import {
  User,
  Bell,
  Lock,
  Shield,
  Building2,
  Smartphone,
  Archive,
  Database,
  Loader2,
} from 'lucide-react'

const DEFAULT_PREFERENCES = {
  emailNotifications: true,
  pushNotifications: true,
  leaveRequestAlerts: true,
}

function ToggleRow({ label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="font-medium text-gray-800">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
          checked ? 'bg-primary-500' : 'bg-gray-300'
        }`}
        aria-pressed={checked}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
  const storageKey = useMemo(
    () => `emplora_web_preferences_${user?.id || user?.email || 'default'}`,
    [user?.email, user?.id]
  )

  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [retentionMessage, setRetentionMessage] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        setPreferences({ ...DEFAULT_PREFERENCES, ...JSON.parse(saved) })
      }
    } catch (error) {
      console.error('Failed to restore settings:', error)
    }
  }, [storageKey])

  const updatePreference = (key) => {
    setPreferences((current) => {
      const next = { ...current, [key]: !current[key] }
      localStorage.setItem(storageKey, JSON.stringify(next))
      return next
    })
  }

  const archiveOldPaystubs = async () => {
    setArchiveLoading(true)
    setRetentionMessage('')
    try {
      const response = await api.post('/admin/archive/paystubs?older_than_days=90&limit=100')
      setRetentionMessage(response.data?.message || 'Archive completed.')
    } catch (error) {
      setRetentionMessage(error.response?.data?.detail || 'Unable to archive paystubs right now.')
    } finally {
      setArchiveLoading(false)
    }
  }

  const cleanupTemporaryData = async () => {
    setCleanupLoading(true)
    setRetentionMessage('')
    try {
      const response = await api.post('/admin/cleanup/temporary-data?notification_days=90')
      setRetentionMessage(
        `Cleanup complete. Deleted ${response.data?.deleted_notifications || 0} old notification(s).`
      )
    } catch (error) {
      setRetentionMessage(error.response?.data?.detail || 'Unable to clean temporary data right now.')
    } finally {
      setCleanupLoading(false)
    }
  }

  const settingsSections = [
    {
      title: 'Profile Settings',
      description: 'Manage your account information',
      icon: User,
      items: [
        { label: 'Full Name', value: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || 'Not set' },
        { label: 'Email', value: user?.email || 'Not set' },
        { label: 'Role', value: user?.role?.replace('_', ' ') || 'Not set' },
      ],
    },
    {
      title: 'Workspace',
      description: 'Current account workspace information',
      icon: Building2,
      items: [
        { label: 'Company Workspace', value: user?.company_name || 'Your company workspace' },
        { label: 'Access Type', value: user?.role?.includes('manager') ? 'Manager dashboard access' : 'HR dashboard access' },
      ],
    },
    {
      title: 'Security',
      description: 'Password and authentication settings',
      icon: Lock,
      items: [
        { label: 'Password', value: '••••••••', action: 'Change' },
        { label: 'Two-Factor Auth', value: 'Disabled', action: 'Enable' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      <div className="space-y-6">
        {settingsSections.map((section) => (
          <div key={section.title} className="card">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-primary-50 rounded-xl">
                <section.icon className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{section.title}</h2>
                <p className="text-sm text-gray-500">{section.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              {section.items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-700">{item.label}</p>
                    <p className="text-sm text-gray-500 capitalize">{item.value}</p>
                  </div>
                  {item.action && (
                    <button className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                      {item.action}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="card">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-primary-50 rounded-xl">
              <Bell className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              <p className="text-sm text-gray-500">Email and push notification preferences</p>
            </div>
          </div>

          <ToggleRow
            label="Email Notifications"
            description={preferences.emailNotifications ? 'Enabled' : 'Disabled'}
            checked={preferences.emailNotifications}
            onChange={() => updatePreference('emailNotifications')}
          />
          <ToggleRow
            label="Push Notifications"
            description={preferences.pushNotifications ? 'Enabled' : 'Disabled'}
            checked={preferences.pushNotifications}
            onChange={() => updatePreference('pushNotifications')}
          />
          <ToggleRow
            label="Leave Request Alerts"
            description={preferences.leaveRequestAlerts ? 'Enabled' : 'Disabled'}
            checked={preferences.leaveRequestAlerts}
            onChange={() => updatePreference('leaveRequestAlerts')}
          />
        </div>

        <div className="card">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <Database className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Storage & Retention</h2>
              <p className="text-sm text-gray-500">
                Keep MongoDB lean by moving older paystub PDFs into private Cloudflare R2 storage.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={archiveOldPaystubs}
              disabled={archiveLoading}
              className="rounded-2xl border border-gray-200 p-4 text-left hover:border-primary-200 hover:bg-primary-50 disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary-100 text-primary-600">
                  {archiveLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Archive className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Archive old paystubs</p>
                  <p className="text-sm text-gray-500">Move PDFs older than 90 days to R2.</p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={cleanupTemporaryData}
              disabled={cleanupLoading}
              className="rounded-2xl border border-gray-200 p-4 text-left hover:border-primary-200 hover:bg-primary-50 disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                  {cleanupLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bell className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Clean old notifications</p>
                  <p className="text-sm text-gray-500">Delete temporary notifications older than 90 days.</p>
                </div>
              </div>
            </button>
          </div>

          {retentionMessage && (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {retentionMessage}
            </div>
          )}
        </div>
      </div>

      <div className="card bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <img src="/emplora-logo.png" alt="Emplora" className="h-10 w-10 rounded-xl" />
          </div>
          <h3 className="font-bold text-gray-900">Emplora</h3>
          <p className="text-sm text-gray-500 mt-1">Version 1.0.0</p>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Smartphone className="w-4 h-4" />
            Responsive on desktop, tablet, and phone layouts
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Shield className="w-4 h-4" />
            Enterprise HR Management Platform
          </div>
        </div>
      </div>
    </div>
  )
}
