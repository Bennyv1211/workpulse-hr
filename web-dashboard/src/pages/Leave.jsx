import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { format, parseISO } from 'date-fns'
import {
  Calendar,
  Clock,
  Check,
  X,
  Filter,
  Download,
  User,
  AlertCircle
} from 'lucide-react'

function downloadBlob(data, fileName, mimeType = 'text/csv;charset=utf-8;') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.URL.revokeObjectURL(url)
}

export default function Leave() {
  const [filter, setFilter] = useState('all')
  const queryClient = useQueryClient()

  const { data: leaveRequests = [], isLoading } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: async () => {
      const response = await api.get('/leave-requests')
      return response.data
    }
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const response = await api.put(`/leave-requests/${id}`, { status })
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['leave-requests'])
      queryClient.invalidateQueries(['dashboard-stats'])
    }
  })

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/export/leave?format=csv', {
        responseType: 'blob',
      })
      return response.data
    },
    onSuccess: (data) => {
      downloadBlob(data, 'leave-requests.csv')
    },
  })

  const filteredRequests = filter === 'all' 
    ? leaveRequests 
    : leaveRequests.filter(r => r.status === filter)

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700'
      case 'rejected': return 'bg-red-100 text-red-700'
      case 'pending': return 'bg-amber-100 text-amber-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const filters = [
    { id: 'all', label: 'All Requests' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
          <p className="text-gray-500">
            {leaveRequests.filter(r => r.status === 'pending').length} pending approvals
          </p>
        </div>
        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="btn-secondary flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.id
                ? 'bg-primary-500 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Requests list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500">No leave requests found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div key={request.id} className="card">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                {/* Employee info */}
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-600 font-semibold">
                      {request.employee_name?.split(' ').map(n => n[0]).join('') || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{request.employee_name}</p>
                    <p className="text-sm text-gray-500">{request.leave_type_name}</p>
                  </div>
                </div>

                {/* Status */}
                <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(request.status)}`}>
                  {request.status}
                </span>
              </div>

              {/* Details */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">
                    {format(parseISO(request.start_date), 'MMM d')} - {format(parseISO(request.end_date), 'MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4" />
                  <span className="text-sm">{request.days_count} day{request.days_count !== 1 ? 's' : ''}</span>
                </div>
                {request.half_day && (
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm">Half day</span>
                  </div>
                )}
              </div>

              {request.reason && (
                <p className="mt-3 text-sm text-gray-600 italic">"{request.reason}"</p>
              )}

              {/* Actions for pending */}
              {request.status === 'pending' && (
                <div className="mt-4 flex gap-3 pt-4 border-t border-gray-100">
                  <button
                    onClick={() => updateMutation.mutate({ id: request.id, status: 'rejected' })}
                    disabled={updateMutation.isPending}
                    className="flex-1 btn-secondary flex items-center justify-center gap-2 text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => updateMutation.mutate({ id: request.id, status: 'approved' })}
                    disabled={updateMutation.isPending}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Approve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
