import React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import {
  Download,
  Clock,
  UserCheck,
  UserX,
  Plane,
  Coffee,
  MapPin,
} from 'lucide-react'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { isHrRole } from '../lib/roles'

function downloadBlob(data, fileName) {
  const url = window.URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function formatLocation(location) {
  if (!location || typeof location !== 'object') return '-'
  const latitude = typeof location.latitude === 'number' ? location.latitude.toFixed(4) : null
  const longitude = typeof location.longitude === 'number' ? location.longitude.toFixed(4) : null
  if (!latitude || !longitude) return '-'
  return `${latitude}, ${longitude}`
}

export default function Attendance() {
  const { user } = useAuth()
  const hrUser = isHrRole(user?.role)

  const { data, isLoading } = useQuery({
    queryKey: [hrUser ? 'attendance' : 'manager-dashboard-attendance'],
    queryFn: async () => {
      const response = await api.get(hrUser ? '/attendance' : '/manager/dashboard')
      return response.data
    }
  })

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/export/attendance?format=csv', {
        responseType: 'blob'
      })
      return response.data
    },
    onSuccess: (blob) => {
      downloadBlob(blob, 'attendance.csv')
    }
  })

  const stats = hrUser
    ? data?.attendance_today || { present: 0, late: 0, absent: 0, on_leave: 0 }
    : {
        present: data?.summary?.working || 0,
        late: data?.summary?.late || 0,
        absent: data?.summary?.clocked_out || 0,
        on_leave: data?.summary?.pending_leave_requests || 0,
      }

  const rows = hrUser ? data || [] : data?.employees || []

  const statCards = hrUser
    ? [
        { title: 'Present', value: stats.present, icon: UserCheck, color: 'text-green-600', bgColor: 'bg-green-50' },
        { title: 'Late', value: stats.late, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
        { title: 'Absent', value: stats.absent, icon: UserX, color: 'text-red-600', bgColor: 'bg-red-50' },
        { title: 'On Leave', value: stats.on_leave, icon: Plane, color: 'text-purple-600', bgColor: 'bg-purple-50' },
      ]
    : [
        { title: 'Working', value: stats.present, icon: UserCheck, color: 'text-green-600', bgColor: 'bg-green-50' },
        { title: 'On Break', value: data?.summary?.on_break || 0, icon: Coffee, color: 'text-amber-600', bgColor: 'bg-amber-50' },
        { title: 'Clocked Out', value: stats.absent, icon: UserX, color: 'text-slate-600', bgColor: 'bg-slate-100' },
        { title: 'Late', value: stats.late, icon: Clock, color: 'text-rose-600', bgColor: 'bg-rose-50' },
      ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{hrUser ? 'Attendance' : 'Team Attendance'}</h1>
          <p className="text-gray-500">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.title} className="card">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.title}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{hrUser ? 'Recent Attendance Records' : 'Today\'s Team Activity'}</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No attendance records found</p>
          </div>
        ) : hrUser ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Employee</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Date</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Clock In</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Clock Out</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Hours</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.slice(0, 20).map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6 font-medium text-gray-900">{record.employee_name}</td>
                    <td className="py-4 px-6 text-gray-700">{format(parseISO(record.date), 'MMM d, yyyy')}</td>
                    <td className="py-4 px-6 text-gray-700">{record.clock_in ? format(new Date(record.clock_in), 'HH:mm') : '-'}</td>
                    <td className="py-4 px-6 text-gray-700">{record.clock_out ? format(new Date(record.clock_out), 'HH:mm') : '-'}</td>
                    <td className="py-4 px-6 text-gray-700">{record.total_hours ? `${record.total_hours.toFixed(1)}h` : '-'}</td>
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 rounded-full text-xs font-medium capitalize bg-gray-100 text-gray-700">{record.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Employee</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Clock In</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Location</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-gray-900">{record.name}</p>
                        <p className="text-xs text-gray-500">{record.department_name || '-'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="space-y-1">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium capitalize ${
                          record.status === 'working'
                            ? 'bg-green-100 text-green-700'
                            : record.status === 'on_break'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-700'
                        }`}>
                          {record.status.replace('_', ' ')}
                        </span>
                        {record.is_late_today && <div className="text-xs font-semibold text-rose-600">Late</div>}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-700">{record.clock_in_local || '-'}</td>
                    <td className="py-4 px-6 text-gray-700">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-primary-500" />
                        <span>{formatLocation(record.clock_in_location)}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right text-gray-900 font-medium">{Number(record.today_hours || 0).toFixed(2)}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
