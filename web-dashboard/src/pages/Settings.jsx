import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  User,
  Mail,
  Shield,
  Bell,
  Lock,
  Globe,
  Moon,
  Palette
} from 'lucide-react'

export default function Settings() {
  const { user } = useAuth()

  const settingsSections = [
    {
      title: 'Profile Settings',
      description: 'Manage your account information',
      icon: User,
      items: [
        { label: 'Full Name', value: `${user?.first_name} ${user?.last_name}` },
        { label: 'Email', value: user?.email },
        { label: 'Role', value: user?.role?.replace('_', ' ') }
      ]
    },
    {
      title: 'Security',
      description: 'Password and authentication settings',
      icon: Lock,
      items: [
        { label: 'Password', value: '••••••••', action: 'Change' },
        { label: 'Two-Factor Auth', value: 'Disabled', action: 'Enable' }
      ]
    },
    {
      title: 'Notifications',
      description: 'Email and push notification preferences',
      icon: Bell,
      items: [
        { label: 'Email Notifications', value: 'Enabled', toggle: true },
        { label: 'Push Notifications', value: 'Enabled', toggle: true },
        { label: 'Leave Request Alerts', value: 'Enabled', toggle: true }
      ]
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      {/* Settings sections */}
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
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
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
                  {item.toggle && (
                    <div className="w-11 h-6 bg-primary-500 rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* App info */}
      <div className="card bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">WP</span>
          </div>
          <h3 className="font-bold text-gray-900">Emplora</h3>
          <p className="text-sm text-gray-500 mt-1">Version 1.0.0</p>
          <p className="text-xs text-gray-400 mt-2">Enterprise HR Management Platform</p>
        </div>
      </div>
    </div>
  )
}
