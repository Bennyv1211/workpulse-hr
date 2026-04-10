import React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { isHrRole } from '../lib/roles'
import {
  Users,
  UserCheck,
  UserPlus,
  Plane,
  Clock,
  AlertCircle,
  Calendar,
  Gift,
  MapPin,
  Coffee,
  LogOut,
  Check,
  X,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

function formatLocation(location) {
  if (!location || typeof location !== 'object') return 'No GPS captured'
  const latitude = typeof location.latitude === 'number' ? location.latitude.toFixed(4) : null
  const longitude = typeof location.longitude === 'number' ? location.longitude.toFixed(4) : null
  if (!latitude || !longitude) return 'No GPS captured'
  return `${latitude}, ${longitude}`
}

function formatDateLabel(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').replace('Z', '')
}

function HrDashboard({ stats, user }) {
  const statCards = [
    {
      title: 'Total Employees',
      value: stats?.total_employees || 0,
      icon: Users,
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Active',
      value: stats?.active_employees || 0,
      icon: UserCheck,
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
    },
    {
      title: 'New This Month',
      value: stats?.new_hires_this_month || 0,
      icon: UserPlus,
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: 'On Leave',
      value: stats?.employees_on_leave || 0,
      icon: Plane,
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-600',
    },
  ]

  const attendanceData = stats?.attendance_today || { present: 0, late: 0, absent: 0, on_leave: 0 }
  const pieData = [
    { name: 'Present', value: attendanceData.present },
    { name: 'Late', value: attendanceData.late },
    { name: 'Absent', value: attendanceData.absent },
    { name: 'On Leave', value: attendanceData.on_leave },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {user?.first_name}! Here&apos;s what&apos;s happening.</p>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Today&apos;s Attendance</h2>
          <div className="flex items-center gap-8">
            <div className="w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
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
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <span className="font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Actions</h2>
          <div className="space-y-4">
            {stats?.pending_leave_requests > 0 && (
              <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-xl">
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-amber-900">{stats.pending_leave_requests} Pending Leave Requests</p>
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
                  <p className="font-medium text-blue-900">{stats.pending_timesheet_approvals} Timesheet Approvals</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                    <p className="text-sm text-gray-500">{person.days_until === 0 ? 'Today!' : `In ${person.days_until} days`}</p>
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

function ManagerDashboard({ dashboard, user }) {
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await api.put(`/leave-requests/${id}`, { status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager-dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] })
      queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })

  const summary = dashboard?.summary || {}
  const employees = dashboard?.employees || []
  const lateEmployees = employees.filter((employee) => employee.is_late_today)
  const pendingLeaveRequests = dashboard?.pending_leave_requests || []

  const statCards = [
    { title: 'Team Members', value: summary.total_employees || 0, icon: Users, bgColor: 'bg-blue-50', textColor: 'text-blue-600' },
    { title: 'Working', value: summary.working || 0, icon: UserCheck, bgColor: 'bg-green-50', textColor: 'text-green-600' },
    { title: 'On Break', value: summary.on_break || 0, icon: Coffee, bgColor: 'bg-amber-50', textColor: 'text-amber-600' },
    { title: 'Late Today', value: summary.late || 0, icon: AlertCircle, bgColor: 'bg-rose-50', textColor: 'text-rose-600' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Manager Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Welcome back, {user?.first_name}. Team visibility, leave approvals, and clock-in locations for {dashboard?.date || 'today'}.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Team Status</h2>
              <p className="text-sm text-gray-500">See who is working, on break, clocked out, or late.</p>
            </div>
          </div>
          {employees.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p>No team members found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Clock In</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600 text-sm">Location</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600 text-sm">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-4">
                        <div>
                          <p className="font-medium text-gray-900">{employee.name}</p>
                          <p className="text-sm text-gray-500">{employee.job_title || employee.employee_id}</p>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <div className="space-y-1">
                          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium capitalize ${
                            employee.status === 'working'
                              ? 'bg-green-100 text-green-700'
                              : employee.status === 'on_break'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}>
                            {employee.status.replace('_', ' ')}
                          </span>
                          {employee.is_late_today && (
                            <div className="text-xs font-semibold text-rose-600">Late arrival</div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">{formatDateLabel(employee.clock_in_local)}</td>
                      <td className="py-4 px-4">
                        <div className="text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary-500" />
                            <span>{formatLocation(employee.clock_in_location)}</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{employee.assigned_work_location || 'No assigned site'}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right font-medium text-gray-900">{Number(employee.today_hours || 0).toFixed(2)}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Leave Requests</h2>
            {pendingLeaveRequests.length === 0 ? (
              <p className="text-sm text-gray-500">No requests awaiting review right now.</p>
            ) : (
              <div className="space-y-4">
                {pendingLeaveRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="rounded-2xl border border-gray-200 p-4">
                    <p className="font-semibold text-gray-900">{request.employee_name}</p>
                    <p className="text-sm text-gray-500">{request.leave_type_name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {request.start_date} to {request.end_date}
                    </p>
                    {request.reason && <p className="text-sm text-gray-600 mt-2">{request.reason}</p>}
                    <div className="flex gap-2 mt-4">
                      <button
                        onClick={() => updateMutation.mutate({ id: request.id, status: 'approved' })}
                        disabled={updateMutation.isPending}
                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => updateMutation.mutate({ id: request.id, status: 'rejected' })}
                        disabled={updateMutation.isPending}
                        className="flex-1 btn-secondary flex items-center justify-center gap-2 text-rose-600 hover:bg-rose-50"
                      >
                        <X className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Late Arrivals</h2>
            {lateEmployees.length === 0 ? (
              <p className="text-sm text-gray-500">Nobody is late today.</p>
            ) : (
              <div className="space-y-3">
                {lateEmployees.map((employee) => (
                  <div key={employee.id} className="rounded-2xl bg-rose-50 px-4 py-3">
                    <p className="font-semibold text-rose-900">{employee.name}</p>
                    <p className="text-sm text-rose-700">{employee.clock_in_local || 'No clock-in time recorded'}</p>
                    <p className="text-xs text-rose-600 mt-1">{formatLocation(employee.clock_in_location)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const hrUser = isHrRole(user?.role)

  const { data, isLoading } = useQuery({
    queryKey: [hrUser ? 'dashboard-stats' : 'manager-dashboard'],
    queryFn: async () => {
      const response = await api.get(hrUser ? '/dashboard/stats' : '/manager/dashboard')
      return response.data
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return hrUser ? <HrDashboard stats={data} user={user} /> : <ManagerDashboard dashboard={data} user={user} />
}
