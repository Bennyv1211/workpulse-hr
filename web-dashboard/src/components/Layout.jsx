import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { isHrRole } from '../lib/roles'
import api from '../lib/api'
import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarDays,
  Clock,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  FileText
} from 'lucide-react'

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [notificationsOpen, setNotificationsOpen] = React.useState(false)
  const notificationsRef = React.useRef(null)

  const hrUser = isHrRole(user?.role)

  const navigation = hrUser
    ? [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Schedules', href: '/dashboard/schedules', icon: CalendarDays },
        { name: 'Employees', href: '/dashboard/employees', icon: Users },
        { name: 'Leave Requests', href: '/dashboard/leave', icon: Calendar },
        { name: 'Attendance', href: '/dashboard/attendance', icon: Clock },
        { name: 'Payroll', href: '/dashboard/payroll', icon: DollarSign },
        { name: 'Paystubs', href: '/dashboard/paystubs', icon: FileText },
        { name: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
      ]
    : [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Schedules', href: '/dashboard/schedules', icon: CalendarDays },
        { name: 'Leave Requests', href: '/dashboard/leave', icon: Calendar },
        { name: 'Attendance', href: '/dashboard/attendance', icon: Clock },
        { name: 'Settings', href: '/dashboard/settings', icon: Settings },
      ]

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const { data: notifications = [] } = useQuery({
    queryKey: ['web-notifications'],
    queryFn: async () => {
      const response = await api.get('/notifications?limit=12')
      return response.data
    },
    enabled: Boolean(user),
    refetchInterval: 30000,
  })

  const markReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await api.put(`/notifications/${notificationId}/read`)
      return notificationId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-notifications'] })
    },
  })

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const unreadCount = notifications.filter((notification) => !notification.read).length

  const openNotification = (notification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-100">
            <img src="/emplora-wordmark.svg" alt="Emplora" className="h-10 w-auto" />
            <button
              className="ml-auto lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/dashboard'}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {user?.first_name} {user?.last_name}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
          <div className="flex items-center justify-between px-4 py-4 sm:px-6">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-900">
                {hrUser ? 'HR Control Center' : 'Manager Control Center'}
              </p>
              <p className="text-xs text-slate-500">
                {hrUser
                  ? 'Employees, payroll, paystubs, leave, and backups in one place.'
                  : 'Live team visibility, attendance, and leave approvals.'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-semibold">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-3 w-[360px] max-w-[90vw] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">Notifications</p>
                        <p className="text-xs text-gray-500">Recent updates from your workspace</p>
                      </div>
                      {unreadCount > 0 && (
                        <span className="text-xs font-medium text-primary-600">{unreadCount} unread</span>
                      )}
                    </div>
                    <div className="max-h-[420px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-10 text-center">
                          <Bell className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                          <p className="font-medium text-gray-700">No notifications yet</p>
                          <p className="text-sm text-gray-500 mt-1">We’ll show payroll, leave, and workflow updates here.</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => openNotification(notification)}
                            className={`w-full text-left px-4 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                              notification.read ? 'bg-white' : 'bg-blue-50/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-gray-900">{notification.title}</p>
                                <p className="text-sm text-gray-600 mt-1 break-words">{notification.message}</p>
                                <p className="text-xs text-gray-400 mt-2">
                                  {notification.created_at ? new Date(notification.created_at).toLocaleString() : ''}
                                </p>
                              </div>
                              {!notification.read && <span className="mt-1 w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0" />}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-semibold text-sm">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">
                    {user?.role?.replace('_', ' ')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
