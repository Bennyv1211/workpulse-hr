import React from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import api from '../lib/api'
import {
  BarChart3,
  Download,
  FileText,
  Users,
  Calendar,
  DollarSign,
  Clock,
  TrendingUp,
  Loader2
} from 'lucide-react'

export default function Reports() {
  const exportMutation = useMutation({
    mutationFn: async ({ entity, format }) => {
      const response = await api.get(`/export/${entity}?format=${format}`, {
        responseType: 'blob'
      })
      return { data: response.data, entity, format }
    },
    onSuccess: ({ data, entity, format }) => {
      const url = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${entity}-report.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    }
  })

  const reports = [
    {
      title: 'Employee Report',
      description: 'Complete employee directory with details',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      entity: 'employees'
    },
    {
      title: 'Attendance Report',
      description: 'Daily attendance records and statistics',
      icon: Clock,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      entity: 'attendance'
    },
    {
      title: 'Leave Report',
      description: 'Leave requests and balances',
      icon: Calendar,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      entity: 'leave'
    },
    {
      title: 'Payroll Report',
      description: 'Compensation and payment records',
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      entity: 'payroll'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500">Generate and export HR reports</p>
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {reports.map((report) => (
          <div key={report.entity} className="card">
            <div className="flex items-start gap-4">
              <div className={`p-4 rounded-xl ${report.bgColor}`}>
                <report.icon className={`w-6 h-6 ${report.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{report.title}</h3>
                <p className="text-gray-500 text-sm mt-1">{report.description}</p>
                
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={() => exportMutation.mutate({ entity: report.entity, format: 'csv' })}
                    disabled={exportMutation.isPending}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    {exportMutation.isPending && exportMutation.variables?.entity === report.entity && exportMutation.variables?.format === 'csv' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    CSV
                  </button>
                  <button
                    onClick={() => exportMutation.mutate({ entity: report.entity, format: 'xlsx' })}
                    disabled={exportMutation.isPending}
                    className="btn-secondary flex items-center gap-2 text-sm"
                  >
                    {exportMutation.isPending && exportMutation.variables?.entity === report.entity && exportMutation.variables?.format === 'xlsx' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileText className="w-4 h-4" />
                    )}
                    Excel
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Report Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <TrendingUp className="w-8 h-8 text-primary-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">4</p>
            <p className="text-sm text-gray-500">Report Types</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <FileText className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">CSV</p>
            <p className="text-sm text-gray-500">Format Available</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <FileText className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">Excel</p>
            <p className="text-sm text-gray-500">Format Available</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl text-center">
            <Download className="w-8 h-8 text-purple-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">Instant</p>
            <p className="text-sm text-gray-500">Download</p>
          </div>
        </div>
      </div>
    </div>
  )
}