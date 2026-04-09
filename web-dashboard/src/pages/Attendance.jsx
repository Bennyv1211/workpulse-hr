import React, { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday } from 'date-fns'
import {
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  Users,
  UserCheck,
  UserX,
  Plane
} from 'lucide-react'

function downloadBlob(data, fileName) {
  const url = window.URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.URL.revokeObjectURL(url)
}

export default function Attendance() {
  const [currentDate, setCurrentDate] = useState(new Date())

  const { data: attendance = [], isLoading } = useQuery({
    queryKey: ['attendance'],
    queryFn: async () => {
      const response = await api.get('/attendance')
      return response.data
    }
  })

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/dashboard/stats')
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
    onSuccess: (data) => {
      downloadBlob(data, 'attendance.csv')
    }
  })

  const todayStats = stats?.attendance_today || { present: 0, late: 0, absent: 0, on_leave: 0 }

  const getStatusColor = (status) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-700'
      case 'late': return 'bg-amber-100 text-amber-700'
      case 'absent': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const statCards = [
    { title: 'Present', value: todayStats.present, icon: UserCheck, color: 'text-green-600', bgColor: 'bg-green-50' },
    { title: 'Late', value: todayStats.late, icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { title: 'Absent', value: todayStats.absent, icon: UserX, color: 'text-red-600', bgColor: 'bg-red-50' },
    { title: 'On Leave', value: todayStats.on_leave, icon: Plane, color: 'text-purple-600', bgColor: 'bg-purple-50' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
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

      {/* Today's stats */}
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

      {/* Attendance records */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Attendance Records</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : attendance.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No attendance records found</p>
          </div>
        ) : (
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
                {attendance.slice(0, 20).map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-semibold text-xs">
                            {record.employee_name?.split(' ').map(n => n[0]).join('') || '?'}
                          </span>
                        </div>
                        <span className="font-medium text-gray-900">{record.employee_name}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      {format(parseISO(record.date), 'MMM d, yyyy')}
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      {record.clock_in ? format(new Date(record.clock_in), 'HH:mm') : '-'}
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      {record.clock_out ? format(new Date(record.clock_out), 'HH:mm') : '-'}
                    </td>
                    <td className="py-4 px-6 text-gray-700">
                      {record.total_hours ? `${record.total_hours.toFixed(1)}h` : '-'}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
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
