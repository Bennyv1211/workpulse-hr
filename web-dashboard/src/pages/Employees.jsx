import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import * as XLSX from 'xlsx'
import {
  Search,
  Plus,
  Mail,
  Phone,
  Eye,
  Download,
  X,
  Loader2,
  Upload
} from 'lucide-react'

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function getPaySummary(employee) {
  if (employee.hourly_rate && Number(employee.hourly_rate) > 0) {
    return {
      label: 'Hourly',
      value: `${formatMoney(employee.hourly_rate)}/hr`,
    }
  }

  if (employee.salary && Number(employee.salary) > 0) {
    return {
      label: 'Salary',
      value: `${formatMoney(employee.salary)}/yr`,
    }
  }

  return {
    label: 'Unassigned',
    value: '-',
  }
}

function getLeaveSummary(employee) {
  return {
    annual: Number(employee.vacation_balance_hours || 0),
    sick: Number(employee.sick_balance_hours || 0),
    total: Number(employee.leave_balance_hours || 0),
  }
}

function normalizeImportedRole(value) {
  const normalized = String(value || 'employee').trim().toLowerCase()
  if (normalized === 'manager') return 'manager'
  if (normalized === 'hr_admin' || normalized === 'hr admin' || normalized === 'hr') return 'hr_admin'
  return 'employee'
}

function normalizeImportedPayType(value) {
  const normalized = String(value || 'hourly').trim().toLowerCase()
  if (normalized === 'salary' || normalized === 'salaried' || normalized === 'annual') return 'salary'
  return 'hourly'
}

export default function Employees() {
  const defaultFormData = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    department_name: '',
    job_title: '',
    employee_id: '',
    start_date: '',
    date_of_birth: '',
    regular_start_time: '09:00',
    regular_end_time: '17:00',
    employment_type: 'Full-time',
    role: 'employee',
    temporary_password: '',
    pay_type: 'hourly',
    hourly_rate: '',
    salary: '',
    annual_leave_days: '10',
    sick_leave_days: '10',
    maternity_leave_days: '0',
    paternity_leave_days: '0',
  }
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState(defaultFormData)
  const [formError, setFormError] = useState('')
  const [importing, setImporting] = useState(false)
  const queryClient = useQueryClient()

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees', search, departmentFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (departmentFilter) params.append('department_id', departmentFilter)
      const response = await api.get(`/employees?${params}`)
      return response.data
    }
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.get('/departments')
      return response.data
    }
  })

  const { data: leaveTypes = [] } = useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const response = await api.get('/leave-types')
      return response.data
    }
  })

  const employeeCountLabel = useMemo(() => `${employees.length} total employees`, [employees.length])

  const addEmployeeMutation = useMutation({
    mutationFn: async (data) => {
      const payload = {
        employee_id: data.employee_id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        role: data.role,
        temporary_password: data.temporary_password,
        phone: data.phone || null,
        job_title: data.job_title,
        department_name: data.department_name,
        employment_type: data.employment_type || 'Full-time',
        start_date: data.start_date,
        date_of_birth: data.date_of_birth || null,
        regular_start_time: data.regular_start_time || null,
        regular_end_time: data.regular_end_time || null,
        hourly_rate: data.pay_type === 'hourly' ? Number(data.hourly_rate) : null,
        salary: data.pay_type === 'salary' ? Number(data.salary) : null,
        leave_balance: buildLeaveBalancePayload(data)
      }

      const response = await api.post('/employees', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      setShowAddModal(false)
      setFormData(defaultFormData)
      setFormError('')
    },
    onError: (error) => {
      setFormError(error.response?.data?.detail || 'Failed to add employee')
    }
  })

  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await api.get('/export/employees?format=csv', {
        responseType: 'blob'
      })
      return response.data
    },
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'employees.csv'
      a.click()
      window.URL.revokeObjectURL(url)
    }
  })

  const downloadTemplate = () => {
    const templateRows = [
      {
        employee_id: 'EMP001',
        first_name: 'John',
        last_name: 'Smith',
        email: 'john.smith@company.com',
        phone: '+1 555 123 4567',
        job_title: 'Sales Associate',
        department: 'Sales',
        role: 'employee',
        employment_type: 'Full-time',
        start_date: '2026-04-08',
        date_of_birth: '1995-02-14',
        regular_start_time: '09:00',
        regular_end_time: '17:00',
        pay_type: 'hourly',
        hourly_rate: 25,
        annual_salary: '',
        temporary_password: 'Temp123!',
        annual_leave_days: 10,
        sick_leave_days: 10,
        maternity_leave_days: 0,
        paternity_leave_days: 0,
      }
    ]

    const instructionsRows = [
      { field: 'department', required: 'yes', description: 'Enter any department name. If it does not exist yet, it will be created automatically.' },
      { field: 'role', required: 'no', description: 'employee, manager, or hr_admin' },
      { field: 'pay_type', required: 'yes', description: 'hourly or salary' },
      { field: 'hourly_rate', required: 'conditional', description: 'Required when pay_type is hourly' },
      { field: 'annual_salary', required: 'conditional', description: 'Required when pay_type is salary' },
      { field: 'temporary_password', required: 'yes', description: 'At least 8 characters with uppercase, number, and special character' },
      { field: 'regular_start_time / regular_end_time', required: 'no', description: 'Use HH:MM 24-hour format like 09:00 and 17:00' },
      { field: 'start_date / date_of_birth', required: 'start_date yes', description: 'Use YYYY-MM-DD format' },
    ]

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(templateRows), 'Employees Template')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(instructionsRows), 'Instructions')
    XLSX.writeFile(workbook, 'employee-import-template.xlsx')
  }

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) return

    setImporting(true)
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        throw new Error('No worksheet found in the selected file.')
      }

      const worksheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' })
      if (!rows.length) {
        throw new Error('The selected template is empty.')
      }

      const leaveTypeMap = new Map(leaveTypes.map((type) => [type.name, type.id]))
      const created = []
      const failed = []

      for (const [index, row] of rows.entries()) {
        const employeeNumber = String(row.employee_id || '').trim()
        const first = String(row.first_name || '').trim()
        const last = String(row.last_name || '').trim()
        const emailValue = String(row.email || '').trim().toLowerCase()
        const job = String(row.job_title || '').trim()
        const departmentValue = String(row.department || '').trim()
        const start = String(row.start_date || '').trim()
        const tempPassword = String(row.temporary_password || '').trim()
        const payType = normalizeImportedPayType(row.pay_type)

        if (!employeeNumber || !first || !last || !emailValue || !job || !departmentValue || !start || !tempPassword) {
          failed.push(`Row ${index + 2}: missing required fields`)
          continue
        }

        const hourlyRate = String(row.hourly_rate || '').trim()
        const annualSalary = String(row.annual_salary || '').trim()
        if (payType === 'hourly' && (!hourlyRate || Number(hourlyRate) <= 0)) {
          failed.push(`Row ${index + 2}: invalid hourly rate`)
          continue
        }
        if (payType === 'salary' && (!annualSalary || Number(annualSalary) <= 0)) {
          failed.push(`Row ${index + 2}: invalid annual salary`)
          continue
        }

        const leaveBalance = {}
        const annualId = leaveTypeMap.get('Annual Leave')
        const sickId = leaveTypeMap.get('Sick Leave')
        const maternityId = leaveTypeMap.get('Maternity Leave')
        const paternityId = leaveTypeMap.get('Paternity Leave')
        if (annualId) leaveBalance[annualId] = Number(row.annual_leave_days || 10)
        if (sickId) leaveBalance[sickId] = Number(row.sick_leave_days || 10)
        if (maternityId) leaveBalance[maternityId] = Number(row.maternity_leave_days || 0)
        if (paternityId) leaveBalance[paternityId] = Number(row.paternity_leave_days || 0)

        const payload = {
          employee_id: employeeNumber,
          first_name: first,
          last_name: last,
          email: emailValue,
          role: normalizeImportedRole(row.role),
          temporary_password: tempPassword,
          phone: String(row.phone || '').trim() || null,
          job_title: job,
          department_name: departmentValue,
          employment_type: String(row.employment_type || 'Full-time').trim() || 'Full-time',
          start_date: start,
          date_of_birth: String(row.date_of_birth || '').trim() || null,
          regular_start_time: String(row.regular_start_time || '09:00').trim() || null,
          regular_end_time: String(row.regular_end_time || '17:00').trim() || null,
          hourly_rate: payType === 'hourly' ? Number(hourlyRate) : null,
          salary: payType === 'salary' ? Number(annualSalary) : null,
          leave_balance: leaveBalance,
        }

        try {
          await api.post('/employees', payload)
          created.push(`${employeeNumber} - ${first} ${last}`)
        } catch (error) {
          failed.push(`Row ${index + 2}: ${error.response?.data?.detail || error.message || 'failed to create employee'}`)
        }
      }

      queryClient.invalidateQueries({ queryKey: ['employees'] })
      window.alert(`Import complete\nCreated: ${created.length}\nFailed: ${failed.length}${failed.length ? `\n\n${failed.slice(0, 6).join('\n')}` : ''}`)
    } catch (error) {
      window.alert(error.message || 'Failed to import employee workbook')
    } finally {
      setImporting(false)
    }
  }

  const handleAddEmployee = (event) => {
    event.preventDefault()
    setFormError('')

    if (
      !formData.employee_id ||
      !formData.first_name ||
      !formData.last_name ||
      !formData.email ||
      !formData.job_title ||
      !formData.department_name ||
      !formData.start_date
    ) {
      setFormError('Employee ID, first name, last name, email, job title, department, and start date are required')
      return
    }

    if (!formData.temporary_password || formData.temporary_password.trim().length < 8) {
      setFormError('Temporary password is required and must be at least 8 characters.')
      return
    }

    if (formData.pay_type === 'hourly' && (!formData.hourly_rate || Number(formData.hourly_rate) <= 0)) {
      setFormError('Please enter a valid hourly rate.')
      return
    }

    if (formData.pay_type === 'salary' && (!formData.salary || Number(formData.salary) <= 0)) {
      setFormError('Please enter a valid annual salary.')
      return
    }

    addEmployeeMutation.mutate(formData)
  }

  const buildLeaveBalancePayload = (data) => {
    const leaveTypeMap = new Map(leaveTypes.map((type) => [type.name, type.id]))
    const leaveBalance = {}
    const annualId = leaveTypeMap.get('Annual Leave')
    const sickId = leaveTypeMap.get('Sick Leave')
    const maternityId = leaveTypeMap.get('Maternity Leave')
    const paternityId = leaveTypeMap.get('Paternity Leave')

    if (annualId) leaveBalance[annualId] = Number(data.annual_leave_days || 10)
    if (sickId) leaveBalance[sickId] = Number(data.sick_leave_days || 10)
    if (maternityId) leaveBalance[maternityId] = Number(data.maternity_leave_days || 0)
    if (paternityId) leaveBalance[paternityId] = Number(data.paternity_leave_days || 0)

    return leaveBalance
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700'
      case 'on_leave': return 'bg-amber-100 text-amber-700'
      case 'terminated': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500">{employeeCountLabel}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={downloadTemplate} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Download Template
          </button>
          <label className={`btn-secondary flex items-center gap-2 cursor-pointer ${importing ? 'opacity-70 pointer-events-none' : ''}`}>
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Upload Excel
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          </label>
          <button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input type="text" placeholder="Search by name, email, ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" />
          </div>
          <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="input w-full sm:w-48">
            <option value="">All Departments</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
          </div>
        ) : employees.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No employees found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Employee</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Department</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Job Title</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Pay</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Leave Balances</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Contact</th>
                  <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map((employee) => {
                  const pay = getPaySummary(employee)
                  const leave = getLeaveSummary(employee)

                  return (
                    <tr key={employee.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-primary-600 font-semibold">
                              {employee.first_name[0]}{employee.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {employee.first_name} {employee.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{employee.employee_id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-700">{employee.department_name || '-'}</td>
                      <td className="py-4 px-6 text-gray-700">{employee.job_title}</td>
                      <td className="py-4 px-6">
                        <p className="font-medium text-gray-900">{pay.value}</p>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">{pay.label}</p>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-700">Annual: <span className="font-medium">{leave.annual.toFixed(1)}h</span></p>
                          <p className="text-gray-700">Sick: <span className="font-medium">{leave.sick.toFixed(1)}h</span></p>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(employee.status)}`}>
                          {employee.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Mail className="w-3.5 h-3.5" />
                            <span className="truncate max-w-[150px]">{employee.email}</span>
                          </div>
                          {employee.phone && (
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <Phone className="w-3.5 h-3.5" />
                              <span>{employee.phone}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => setSelectedEmployee(employee)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Add New Employee</h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="p-6 space-y-5">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input type="text" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input type="text" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} className="input" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="input" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Role *</label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} className="input" required>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="hr_admin">HR Admin</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID *</label>
                  <input type="text" value={formData.employee_id} onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })} className="input" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Job Title *</label>
                  <input type="text" value={formData.job_title} onChange={(e) => setFormData({ ...formData, job_title: e.target.value })} className="input" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                  <input
                    type="text"
                    value={formData.department_name}
                    onChange={(e) => setFormData({ ...formData, department_name: e.target.value })}
                    className="input"
                    placeholder="Sales"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employment Type *</label>
                  <select value={formData.employment_type} onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })} className="input" required>
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Casual">Casual</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="input" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Regular Start Time</label>
                  <input type="time" value={formData.regular_start_time} onChange={(e) => setFormData({ ...formData, regular_start_time: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Regular End Time</label>
                  <input type="time" value={formData.regular_end_time} onChange={(e) => setFormData({ ...formData, regular_end_time: e.target.value })} className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pay Type *</label>
                  <select value={formData.pay_type} onChange={(e) => setFormData({ ...formData, pay_type: e.target.value })} className="input" required>
                    <option value="hourly">Hourly</option>
                    <option value="salary">Salaried</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {formData.pay_type === 'hourly' ? 'Hourly Rate *' : 'Annual Salary *'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.pay_type === 'hourly' ? formData.hourly_rate : formData.salary}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        [formData.pay_type === 'hourly' ? 'hourly_rate' : 'salary']: e.target.value,
                      })
                    }
                    className="input"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
                <input
                  type="text"
                  value={formData.temporary_password}
                  onChange={(e) => setFormData({ ...formData, temporary_password: e.target.value })}
                  className="input"
                  placeholder="Set a temporary password"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Use at least 8 characters with an uppercase letter, number, and special character. The employee can change this later from their profile.</p>
              </div>

              <div className="card bg-slate-50 border-slate-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Leave Balances</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Annual Leave Days</label>
                    <input type="number" min="0" step="0.5" value={formData.annual_leave_days} onChange={(e) => setFormData({ ...formData, annual_leave_days: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sick Leave Days</label>
                    <input type="number" min="0" step="0.5" value={formData.sick_leave_days} onChange={(e) => setFormData({ ...formData, sick_leave_days: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Maternity Leave Days</label>
                    <input type="number" min="0" step="0.5" value={formData.maternity_leave_days} onChange={(e) => setFormData({ ...formData, maternity_leave_days: e.target.value })} className="input" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paternity Leave Days</label>
                    <input type="number" min="0" step="0.5" value={formData.paternity_leave_days} onChange={(e) => setFormData({ ...formData, paternity_leave_days: e.target.value })} className="input" />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={addEmployeeMutation.isPending} className="flex-1 btn-primary flex items-center justify-center gap-2">
                  {addEmployeeMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    'Add Employee'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Employee Details</h2>
              <button onClick={() => setSelectedEmployee(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center">
                  <span className="text-primary-600 font-bold text-2xl">
                    {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </h3>
                  <p className="text-gray-500">{selectedEmployee.job_title}</p>
                  <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(selectedEmployee.status)}`}>
                    {selectedEmployee.status}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="card bg-slate-50 border-slate-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Core Details</h3>
                  <div className="space-y-3 text-sm">
                    <DetailRow label="Employee ID" value={selectedEmployee.employee_id} />
                    <DetailRow label="Department" value={selectedEmployee.department_name || '-'} />
                    <DetailRow label="Employment Type" value={selectedEmployee.employment_type} />
                    <DetailRow label="Start Date" value={selectedEmployee.start_date || '-'} />
                    <DetailRow label="Email" value={selectedEmployee.email} />
                    <DetailRow label="Phone" value={selectedEmployee.phone || '-'} />
                  </div>
                </div>

                <div className="card bg-slate-50 border-slate-200">
                  <h3 className="font-semibold text-gray-900 mb-4">Pay & Leave</h3>
                  <div className="space-y-3 text-sm">
                    <DetailRow label="Pay Type" value={getPaySummary(selectedEmployee).label} />
                    <DetailRow label="Pay Rate" value={getPaySummary(selectedEmployee).value} />
                    <DetailRow label="Annual Leave" value={`${Number(selectedEmployee.vacation_balance_hours || 0).toFixed(1)}h`} />
                    <DetailRow label="Sick Leave" value={`${Number(selectedEmployee.sick_balance_hours || 0).toFixed(1)}h`} />
                    <DetailRow label="Total Leave" value={`${Number(selectedEmployee.leave_balance_hours || 0).toFixed(1)}h`} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900 text-right">{value}</span>
    </div>
  )
}
