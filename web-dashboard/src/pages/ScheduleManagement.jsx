import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { isHrRole } from '../lib/roles'
import { CalendarDays, Copy, Loader2, Send, Users } from 'lucide-react'

function getWeekStart(date = new Date()) {
  const value = new Date(date)
  const day = value.getDay()
  const diff = value.getDate() - day + (day === 0 ? -6 : 1)
  value.setDate(diff)
  return value.toISOString().split('T')[0]
}

function addDays(dateString, days) {
  const value = new Date(`${dateString}T00:00:00`)
  value.setDate(value.getDate() + days)
  return value.toISOString().split('T')[0]
}

function formatDayLabel(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function calculateHours(start, end) {
  if (!start || !end) return '0.0'
  const [startHour, startMinute] = start.split(':').map(Number)
  const [endHour, endMinute] = end.split(':').map(Number)
  const total = (endHour * 60 + endMinute - (startHour * 60 + startMinute)) / 60
  return total > 0 ? total.toFixed(1) : '0.0'
}

export default function ScheduleManagement() {
  const { user } = useAuth()
  const hrUser = isHrRole(user?.role)
  const queryClient = useQueryClient()
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [scheduleDate, setScheduleDate] = useState(getWeekStart())
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('17:00')
  const [note, setNote] = useState('')
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('')
  const [departmentWeekdays, setDepartmentWeekdays] = useState([0, 1, 2, 3, 4])

  const { data: employees = [] } = useQuery({
    queryKey: ['schedule-employees'],
    queryFn: async () => {
      const response = await api.get('/employees')
      return response.data
    },
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['schedule-departments'],
    queryFn: async () => {
      const response = await api.get('/departments')
      return response.data
    },
  })

  const { data: weekEntries = [], isLoading } = useQuery({
    queryKey: ['schedule-week', weekStart],
    queryFn: async () => {
      const response = await api.get(`/schedule/week/${weekStart}`)
      return response.data
    },
  })

  const groupedEntries = useMemo(() => {
    const grouped = new Map()
    weekEntries.forEach((entry) => {
      if (!grouped.has(entry.employee_id)) {
        grouped.set(entry.employee_id, {
          employee_id: entry.employee_id,
          employee_name: entry.employee_name || 'Employee',
          items: [],
        })
      }
      grouped.get(entry.employee_id).items.push(entry)
    })
    return Array.from(grouped.values())
  }, [weekEntries])

  const createScheduleMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/schedule/create', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-week'] })
      setNote('')
    },
  })

  const applyDepartmentMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post('/schedule/department/apply', payload)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-week'] })
    },
  })

  const copyPreviousWeekMutation = useMutation({
    mutationFn: async () => {
      const previousWeekStart = addDays(weekStart, -7)
      const response = await api.get(`/schedule/week/${previousWeekStart}`)
      const previousEntries = response.data || []

      await Promise.all(
        previousEntries.map((entry) =>
          api.post('/schedule/create', {
            employee_id: entry.employee_id,
            date: addDays(entry.date, 7),
            start_time: entry.start_time,
            end_time: entry.end_time,
            notes: entry.notes || null,
          })
        )
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-week'] })
    },
  })

  const departmentOptions = departments

  const handleCreateSchedule = (event) => {
    event.preventDefault()

    if (!selectedEmployeeId || !scheduleDate || !startTime || !endTime) {
      window.alert('Choose an employee, date, start time, and end time.')
      return
    }

    createScheduleMutation.mutate({
      employee_id: selectedEmployeeId,
      date: scheduleDate,
      start_time: startTime,
      end_time: endTime,
      notes: note.trim() || null,
    })
  }

  const handleApplyDepartmentSchedule = (event) => {
    event.preventDefault()

    if (!selectedDepartmentId || !weekStart || !startTime || !endTime || !departmentWeekdays.length) {
      window.alert('Choose a department, week start, times, and at least one weekday.')
      return
    }

    applyDepartmentMutation.mutate({
      department_id: selectedDepartmentId,
      week_start_date: weekStart,
      start_time: startTime,
      end_time: endTime,
      weekdays: departmentWeekdays,
      notes: note.trim() || null,
    })
  }

  const toggleWeekday = (value) => {
    setDepartmentWeekdays((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort()
    )
  }

  const weekdays = [
    { value: 0, label: 'Mon' },
    { value: 1, label: 'Tue' },
    { value: 2, label: 'Wed' },
    { value: 3, label: 'Thu' },
    { value: 4, label: 'Fri' },
    { value: 5, label: 'Sat' },
    { value: 6, label: 'Sun' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Schedule Management</h1>
          <p className="text-gray-500 mt-1">
            Assign weekly shifts to individual employees or send one schedule pattern to an entire department. Employees will see the results in their schedule tab.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">
            Week Starting
            <input
              type="date"
              value={weekStart}
              onChange={(event) => {
                setWeekStart(event.target.value)
                setScheduleDate(event.target.value)
              }}
              className="input mt-1"
            />
          </label>
          <button
            onClick={() => copyPreviousWeekMutation.mutate()}
            disabled={copyPreviousWeekMutation.isPending}
            className="btn-secondary flex items-center gap-2 self-end"
          >
            {copyPreviousWeekMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Copy Previous Week
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <CalendarDays className="w-5 h-5 text-primary-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Assign Single Employee</h2>
              <p className="text-sm text-gray-500">Create or update one shift for one person.</p>
            </div>
          </div>

          <form onSubmit={handleCreateSchedule} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
              <select value={selectedEmployeeId} onChange={(event) => setSelectedEmployeeId(event.target.value)} className="input" required>
                <option value="">Select employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.first_name} {employee.last_name} {employee.department_name ? `- ${employee.department_name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={scheduleDate} onChange={(event) => setScheduleDate(event.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="input" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea value={note} onChange={(event) => setNote(event.target.value)} className="input min-h-[96px]" placeholder="Optional note for this shift" />
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <span className="text-gray-500">Scheduled hours</span>
              <span className="font-semibold text-gray-900">{calculateHours(startTime, endTime)}h</span>
            </div>

            <button type="submit" disabled={createScheduleMutation.isPending} className="btn-primary w-full flex items-center justify-center gap-2">
              {createScheduleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Save Employee Schedule
            </button>
          </form>
        </div>

        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-5 h-5 text-primary-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Apply to Department</h2>
              <p className="text-sm text-gray-500">Push one weekly pattern to every employee in the selected department.</p>
            </div>
          </div>

          <form onSubmit={handleApplyDepartmentSchedule} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select value={selectedDepartmentId} onChange={(event) => setSelectedDepartmentId(event.target.value)} className="input" required>
                <option value="">Select department</option>
                {departmentOptions.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Week Start</label>
                <input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End</label>
                <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="input" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Repeat On</label>
              <div className="flex flex-wrap gap-2">
                {weekdays.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={`px-3 py-2 rounded-xl border text-sm font-medium ${departmentWeekdays.includes(day.value) ? 'bg-primary-50 border-primary-400 text-primary-700' : 'bg-white border-gray-300 text-gray-600'}`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" disabled={applyDepartmentMutation.isPending} className="btn-primary w-full flex items-center justify-center gap-2">
              {applyDepartmentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Apply Department Schedule
            </button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Current Week Schedule</h2>
            <p className="text-sm text-gray-500">Week of {formatDayLabel(weekStart)}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : groupedEntries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <CalendarDays className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p>No schedules have been assigned for this week yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedEntries.map((group) => (
              <div key={group.employee_id} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{group.employee_name}</h3>
                  <span className="text-sm text-gray-500">
                    {group.items.reduce((total, item) => total + Number(item.total_hours || 0), 0).toFixed(1)} scheduled hours
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {group.items.map((item) => (
                    <div key={item.id} className="rounded-xl bg-slate-50 px-4 py-3">
                      <p className="font-medium text-gray-900">{formatDayLabel(item.date)}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {item.start_time || 'Off'} {item.end_time ? `- ${item.end_time}` : ''}
                      </p>
                      {item.notes && <p className="text-xs text-gray-500 mt-2">{item.notes}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
