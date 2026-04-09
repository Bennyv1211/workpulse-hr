import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { Download, Eye, FileText, Send, Loader2 } from 'lucide-react'
import api from '../lib/api'

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm ${strong ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>{label}</span>
      <span className={`text-sm ${strong ? 'font-bold text-emerald-600' : 'font-medium text-slate-900'}`}>{value}</span>
    </div>
  )
}

export default function Paystubs() {
  const [selectedRecord, setSelectedRecord] = useState(null)
  const queryClient = useQueryClient()

  const { data: payroll = [], isLoading } = useQuery({
    queryKey: ['payroll-for-paystubs'],
    queryFn: async () => {
      const response = await api.get('/payroll')
      return response.data
    }
  })

  const readyCount = useMemo(
    () => payroll.filter((item) => item.status !== 'sent').length,
    [payroll]
  )

  const createPaystubMutation = useMutation({
    mutationFn: async (record) => {
      const response = await api.post('/paystubs', {
        employee_id: record.employee_id,
        payroll_id: record.id,
        pay_period_start: record.pay_period_start,
        pay_period_end: record.pay_period_end,
        gross_pay: record.gross_pay,
        deductions: record.deductions || 0,
        tax: record.tax || 0,
        benefits_deduction: record.benefits_deduction || 0,
        bonus: record.bonus || 0,
        net_pay: record.net_pay,
        pay_date: record.pay_period_end,
        published: true,
        file_name: `paystub-${record.employee_code || record.employee_id}-${record.pay_period_end}.pdf`,
      })
      return response.data
    }
  })

  const publishMutation = useMutation({
    mutationFn: async (record) => {
      await api.post('/paystubs/send', {
        payroll_ids: [record.id],
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll-for-paystubs'] })
      queryClient.invalidateQueries({ queryKey: ['payroll'] })
      setSelectedRecord(null)
    }
  })

  const downloadPaystub = async (paystubId, fileName) => {
    const response = await api.get(`/paystubs/${paystubId}/download`, {
      responseType: 'blob'
    })

    const url = window.URL.createObjectURL(response.data)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName || 'paystub.pdf'
    anchor.click()
    window.URL.revokeObjectURL(url)
  }

  const handlePreview = async (record) => {
    const created = await createPaystubMutation.mutateAsync(record)
    await downloadPaystub(
      created.id,
      created.pdf_filename || `paystub-${record.employee_code || record.employee_id}.pdf`
    )
  }

  const currency = (value) =>
    `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paystubs</h1>
          <p className="text-gray-500">{readyCount} payroll records ready to turn into employee paystubs</p>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : payroll.length === 0 ? (
          <div className="text-center py-14">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No payroll entries found yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Employee</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Pay Period</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Gross</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Net</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Status</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payroll.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-gray-900">{record.employee_name}</p>
                        <p className="text-sm text-gray-500">{record.employee_code || record.employee_id}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-700">
                      {format(parseISO(record.pay_period_start), 'MMM d, yyyy')} - {format(parseISO(record.pay_period_end), 'MMM d, yyyy')}
                    </td>
                    <td className="py-4 px-6 text-right font-medium text-gray-900">{currency(record.gross_pay)}</td>
                    <td className="py-4 px-6 text-right font-semibold text-emerald-600">{currency(record.net_pay)}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${
                        record.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {record.status || 'pending'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setSelectedRecord(record)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handlePreview(record)} disabled={createPaystubMutation.isPending} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                          {createPaystubMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Paystub Review</h2>
                <p className="text-sm text-gray-500">{selectedRecord.employee_name}</p>
              </div>
              <button onClick={() => setSelectedRecord(null)} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                Close
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="card bg-slate-50 border-slate-200">
                <div className="space-y-3">
                  <SummaryRow label="Pay period" value={`${format(parseISO(selectedRecord.pay_period_start), 'MMM d, yyyy')} - ${format(parseISO(selectedRecord.pay_period_end), 'MMM d, yyyy')}`} />
                  <SummaryRow label="Basic pay" value={currency(selectedRecord.basic_salary)} />
                  <SummaryRow label="Tax" value={currency(selectedRecord.tax)} />
                  <SummaryRow label="Deductions" value={currency(selectedRecord.deductions)} />
                  <SummaryRow label="Net pay" value={currency(selectedRecord.net_pay)} strong />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={() => handlePreview(selectedRecord)} disabled={createPaystubMutation.isPending || publishMutation.isPending} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                  {createPaystubMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Preview / Download PDF
                </button>
                <button onClick={() => publishMutation.mutate(selectedRecord)} disabled={createPaystubMutation.isPending || publishMutation.isPending} className="flex-1 btn-primary flex items-center justify-center gap-2">
                  {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Publish to Employee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
