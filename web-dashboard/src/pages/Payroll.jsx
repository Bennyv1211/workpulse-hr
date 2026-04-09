import React from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { format, parseISO } from 'date-fns'
import {
  DollarSign,
  Download,
  TrendingUp,
  Users,
  Calendar,
  FileText,
  Eye
} from 'lucide-react'

function downloadBlob(data, fileName) {
  const url = window.URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'text/csv;charset=utf-8;' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.URL.revokeObjectURL(url)
}

export default function Payroll() {
  const { data: payroll = [], isLoading } = useQuery({
    queryKey: ['payroll'],
    queryFn: async () => {
      const response = await api.get('/payroll')
      return response.data
    }
  })

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/export/payroll?format=csv', {
        responseType: 'blob'
      })
      return response.data
    },
    onSuccess: (data) => {
      downloadBlob(data, 'payroll.csv')
    }
  })

  const totalGross = payroll.reduce((sum, p) => sum + (p.gross_pay || 0), 0)
  const totalNet = payroll.reduce((sum, p) => sum + (p.net_pay || 0), 0)
  const totalTax = payroll.reduce((sum, p) => sum + (p.tax || 0), 0)

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700'
      case 'pending': return 'bg-amber-100 text-amber-700'
      case 'processing': return 'bg-blue-100 text-blue-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const statCards = [
    {
      title: 'Total Gross',
      value: `$${totalGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Net',
      value: `$${totalNet.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Total Tax',
      value: `$${totalTax.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: FileText,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    {
      title: 'Records',
      value: payroll.length,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-500">Manage employee compensation</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button type="button" className="btn-primary flex items-center gap-2 opacity-80 cursor-default">
            <DollarSign className="w-4 h-4" />
            Payroll Review
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.title} className="card">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.title}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Payroll records */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Payroll Records</h2>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : payroll.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No payroll records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Employee</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Period</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Gross Pay</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Deductions</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Net Pay</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Status</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payroll.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-semibold text-xs">
                            {record.employee_name?.split(' ').map(n => n[0]).join('') || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{record.employee_name}</p>
                          <p className="text-xs text-gray-500">{record.employee_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-700 text-sm">
                      {format(parseISO(record.pay_period_start), 'MMM d')} - {format(parseISO(record.pay_period_end), 'MMM d')}
                    </td>
                    <td className="py-4 px-6 text-right text-green-600 font-medium">
                      ${record.gross_pay?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-right text-red-600 font-medium">
                      -${(record.tax + record.benefits_deduction + record.deductions)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-gray-900">
                      ${record.net_pay?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                        <Eye className="w-4 h-4" />
                      </button>
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
