import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import * as XLSX from 'xlsx'
import {
  Calendar,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Send,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import api from '../lib/api'

function downloadBlob(data, fileName, type = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.URL.revokeObjectURL(url)
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function toInputDate(value) {
  if (!value) return ''
  return value
}

function buildDefaultRange() {
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  const start = new Date(now)
  start.setDate(now.getDate() - 13)
  return {
    pay_period_start: start.toISOString().slice(0, 10),
    pay_period_end: end,
  }
}

function PayrollReviewModal({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  review,
  isReviewLoading,
  onGenerateReview,
  onDownloadPdf,
  onExportExcel,
  onSendPayroll,
  isSendingPayroll,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Payroll Review</h2>
            <p className="text-gray-500">Pick the payroll window, review the budget, then export or send.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Payroll Start Date</label>
              <input
                type="date"
                value={toInputDate(filters.pay_period_start)}
                onChange={(event) => onFilterChange('pay_period_start', event.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Payroll End Date</label>
              <input
                type="date"
                value={toInputDate(filters.pay_period_end)}
                onChange={(event) => onFilterChange('pay_period_end', event.target.value)}
                className="w-full border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="button"
              onClick={onGenerateReview}
              disabled={isReviewLoading || !filters.pay_period_start || !filters.pay_period_end}
              className="btn-primary flex items-center justify-center gap-2 h-[52px]"
            >
              <Calendar className="w-4 h-4" />
              {isReviewLoading ? 'Loading...' : 'Review Run'}
            </button>
          </div>

          {!review && !isReviewLoading && (
            <div className="rounded-3xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
              <DollarSign className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No payroll review loaded yet</h3>
              <p className="text-gray-500">Choose the payroll dates above and generate the review to see the total budget, hours, and employee breakdown.</p>
            </div>
          )}

          {isReviewLoading && (
            <div className="rounded-3xl bg-gray-50 p-12 flex items-center justify-center">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary-500"></div>
            </div>
          )}

          {review && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="rounded-3xl border border-gray-100 bg-slate-50 p-5">
                  <p className="text-sm text-gray-500">Budget Needed</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatMoney(review.total_budget)}</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-slate-50 p-5">
                  <p className="text-sm text-gray-500">Gross Pay</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatMoney(review.total_gross)}</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-slate-50 p-5">
                  <p className="text-sm text-gray-500">Total Hours</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{Number(review.total_hours || 0).toFixed(2)}h</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-slate-50 p-5">
                  <p className="text-sm text-gray-500">Employees</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{review.employee_count}</p>
                </div>
                <div className="rounded-3xl border border-gray-100 bg-slate-50 p-5">
                  <p className="text-sm text-gray-500">Deductions</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatMoney(review.total_deductions)}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onDownloadPdf} className="btn-secondary flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Download PDF Review
                </button>
                <button type="button" onClick={onExportExcel} className="btn-secondary flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  Export Excel
                </button>
                <button
                  type="button"
                  onClick={onSendPayroll}
                  disabled={isSendingPayroll}
                  className="btn-primary flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  {isSendingPayroll ? 'Sending Payroll...' : 'Send Payroll'}
                </button>
              </div>

              <div className="rounded-3xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">Employee Breakdown</h3>
                  <p className="text-sm text-gray-500">This is the payroll total that will be saved and sent for the selected range.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[940px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Employee</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Hours</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Base Rate</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Gross</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Deductions</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Net</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {review.rows.map((row) => (
                        <tr key={row.employee_id} className="hover:bg-gray-50">
                          <td className="px-5 py-4">
                            <div className="font-medium text-gray-900">{row.employee_name}</div>
                            <div className="text-xs text-gray-500">{row.employee_code || 'No ID'}{row.department_name ? ` • ${row.department_name}` : ''}</div>
                          </td>
                          <td className="px-5 py-4 text-gray-700">{Number(row.hours_worked || 0).toFixed(2)}h</td>
                          <td className="px-5 py-4 text-gray-700">{formatMoney(row.base_rate)}</td>
                          <td className="px-5 py-4 font-medium text-green-600">{formatMoney(row.gross_pay)}</td>
                          <td className="px-5 py-4 text-red-600">{formatMoney(row.total_deductions)}</td>
                          <td className="px-5 py-4 font-bold text-gray-900">{formatMoney(row.net_pay)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Payroll() {
  const queryClient = useQueryClient()
  const [reviewOpen, setReviewOpen] = useState(false)
  const [filters, setFilters] = useState(buildDefaultRange)
  const [review, setReview] = useState(null)

  const { data: payroll = [], isLoading } = useQuery({
    queryKey: ['payroll'],
    queryFn: async () => {
      const response = await api.get('/payroll')
      return response.data
    },
  })

  const reviewMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/payroll/review', payload)
      return response.data
    },
    onSuccess: (data) => {
      setReview(data)
    },
  })

  const reviewPdfMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/payroll/review/pdf', payload, { responseType: 'blob' })
      return response.data
    },
    onSuccess: (data) => {
      downloadBlob(data, `payroll-review-${filters.pay_period_start}-to-${filters.pay_period_end}.pdf`, 'application/pdf')
    },
  })

  const runPayrollMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/payroll/run', payload)
      return response.data
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payroll'] }),
        queryClient.invalidateQueries({ queryKey: ['payroll-for-paystubs'] }),
      ])
      setReviewOpen(false)
    },
  })

  const totalGross = useMemo(() => payroll.reduce((sum, p) => sum + (p.gross_pay || 0), 0), [payroll])
  const totalNet = useMemo(() => payroll.reduce((sum, p) => sum + (p.net_pay || 0), 0), [payroll])
  const totalTax = useMemo(() => payroll.reduce((sum, p) => sum + (p.tax || 0), 0), [payroll])

  const statCards = [
    {
      title: 'Total Gross',
      value: formatMoney(totalGross),
      icon: TrendingUp,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Net',
      value: formatMoney(totalNet),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Tax',
      value: formatMoney(totalTax),
      icon: FileText,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      title: 'Records',
      value: payroll.length,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ]

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent':
      case 'paid':
        return 'bg-green-100 text-green-700'
      case 'pending':
        return 'bg-amber-100 text-amber-700'
      case 'processing':
        return 'bg-blue-100 text-blue-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const handleFilterChange = (field, value) => {
    setFilters((current) => ({ ...current, [field]: value }))
  }

  const handleGenerateReview = () => {
    reviewMutation.mutate(filters)
  }

  const handleExportExcel = () => {
    if (!review) return

    const employeeRows = review.rows.map((row) => ({
      Employee: row.employee_name,
      'Employee ID': row.employee_code || '',
      Department: row.department_name || '',
      'Job Title': row.job_title || '',
      'Hours Worked': Number(row.hours_worked || 0),
      'Base Rate': Number(row.base_rate || 0),
      'Basic Salary': Number(row.basic_salary || 0),
      'Overtime Hours': Number(row.overtime_hours || 0),
      'Overtime Pay': Number(row.overtime_pay || 0),
      Bonus: Number(row.bonus || 0),
      Tax: Number(row.tax || 0),
      'Other Deductions': Number(row.deductions || 0),
      Insurance: Number(row.insurance_deduction || 0),
      Pension: Number(row.pension_deduction || 0),
      Benefits: Number(row.benefits_deduction || 0),
      'Total Deductions': Number(row.total_deductions || 0),
      'Gross Pay': Number(row.gross_pay || 0),
      'Net Pay': Number(row.net_pay || 0),
    }))

    const summaryRows = [
      { Metric: 'Payroll Start', Value: review.pay_period_start },
      { Metric: 'Payroll End', Value: review.pay_period_end },
      { Metric: 'Employees', Value: review.employee_count },
      { Metric: 'Total Hours', Value: review.total_hours },
      { Metric: 'Total Gross', Value: review.total_gross },
      { Metric: 'Total Deductions', Value: review.total_deductions },
      { Metric: 'Total Net', Value: review.total_net },
      { Metric: 'Budget Needed', Value: review.total_budget },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Payroll Summary')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(employeeRows), 'Employee Breakdown')

    const arrayBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
    downloadBlob(
      new Blob([arrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `payroll-review-${review.pay_period_start}-to-${review.pay_period_end}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payroll</h1>
          <p className="text-gray-500">Manage employee compensation</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setReviewOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <DollarSign className="w-4 h-4" />
            Payroll Review
          </button>
        </div>
      </div>

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
                            {record.employee_name?.split(' ').map((name) => name[0]).join('') || '?'}
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
                    <td className="py-4 px-6 text-right text-green-600 font-medium">{formatMoney(record.gross_pay)}</td>
                    <td className="py-4 px-6 text-right text-red-600 font-medium">
                      {formatMoney((record.tax || 0) + (record.deductions || 0) + (record.insurance_deduction || 0) + (record.pension_deduction || 0) + (record.benefits_deduction || 0))}
                    </td>
                    <td className="py-4 px-6 text-right font-bold text-gray-900">{formatMoney(record.net_pay)}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(record.status)}`}>
                        {record.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={() => setReviewOpen(true)}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                      >
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

      <PayrollReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        filters={filters}
        onFilterChange={handleFilterChange}
        review={review}
        isReviewLoading={reviewMutation.isPending}
        onGenerateReview={handleGenerateReview}
        onDownloadPdf={() => reviewPdfMutation.mutate(filters)}
        onExportExcel={handleExportExcel}
        onSendPayroll={() => runPayrollMutation.mutate({ ...filters, send_paystubs: true })}
        isSendingPayroll={runPayrollMutation.isPending}
      />
    </div>
  )
}
