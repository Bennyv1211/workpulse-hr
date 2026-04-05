import React from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import {
  Users,
  UserCheck,
  UserPlus,
  Plane,
  Clock,
  AlertCircle,
  Calendar,
  Gift,
  TrendingUp,
  TrendingDown
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function Dashboard() {
  const { user } = useAuth()
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/dashboard/stats')
      return response.data
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Total Employees',
      value: stats?.total_employees || 0,
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Active',
      value: stats?.active_employees || 0,
      icon: UserCheck,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      title: 'New This Month',
      value: stats?.new_hires_this_month || 0,
      icon: UserPlus,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      title: 'On Leave',
      value: stats?.employees_on_leave || 0,
      icon: Plane,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600'
    }
  ]

  const attendanceData = stats?.attendance_today || { present: 0, late: 0, absent: 0, on_leave: 0 }
  const pieData = [
    { name: 'Present', value: attendanceData.present },
    { name: 'Late', value: attendanceData.late },
    { name: 'Absent', value: attendanceData.absent },
    { name: 'On Leave', value: attendanceData.on_leave }
  ]

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {user?.first_name}! Here's what's happening.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.title} className="card">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.textColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Attendance */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today's Attendance</h2>
          <div className="flex items-center gap-8">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-3">
              {pieData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index] }}
                    />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pending Actions */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Actions</h2>
          <div className="space-y-4">
            {stats?.pending_leave_requests > 0 && (
              <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-amber-900">
                    {stats.pending_leave_requests} Pending Leave Requests
                  </p>
                  <p className="text-sm text-amber-700">Awaiting your approval</p>
                </div>
              </div>
            )}
            {stats?.pending_timesheet_approvals > 0 && (
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-blue-900">
                    {stats.pending_timesheet_approvals} Timesheet Approvals
                  </p>
                  <p className="text-sm text-blue-700">Pending review</p>
                </div>
              </div>
            )}
            {!stats?.pending_leave_requests && !stats?.pending_timesheet_approvals && (
              <div className="text-center py-8 text-gray-500">
                <UserCheck className="w-12 h-12 mx-auto text-green-500 mb-2" />
                <p>All caught up! No pending actions.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Department breakdown & Birthdays */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Departments */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Departments</h2>
          <div className="space-y-3">
            {stats?.department_breakdown?.map((dept) => (
              <div key={dept.department_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-700">{dept.name}</span>
                <span className="px-3 py-1 bg-primary-50 text-primary-600 rounded-full text-sm font-medium">
                  {dept.employee_count} employees
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Birthdays */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Birthdays</h2>
          <div className="space-y-3">
            {stats?.upcoming_birthdays?.length > 0 ? (
              stats.upcoming_birthdays.map((person) => (
                <div key={person.employee_id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center">
                    <Gift className="w-5 h-5 text-pink-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{person.name}</p>
                    <p className="text-sm text-gray-500">
                      {person.days_until === 0 ? 'Today!' : `In ${person.days_until} days`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-gray-500">
                <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p>No upcoming birthdays</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}