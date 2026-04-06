import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 
  'https://workpulse-hr.onrender.com';

interface Employee {
  id: string;
  user_id?: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  job_title: string;
  department_id: string;
  department_name?: string;
  manager_id?: string;
  manager_name?: string;
  work_location?: string;
  employment_type: string;
  start_date: string;
  status: string;
  date_of_birth?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  emergency_contact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  bank_info?: {
    bank_name?: string;
    account_number?: string;
    routing_number?: string;
  };
  tax_id?: string;
  salary?: number;
  hourly_rate?: number;
  skills?: string[];
  notes?: string;
  leave_balance?: Record<string, number>;
  created_at: string;
}

interface Department {
  id: string;
  name: string;
  description?: string;
  manager_id?: string;
  manager_name?: string;
  budget?: number;
  employee_count: number;
  created_at: string;
}

interface LeaveType {
  id: string;
  name: string;
  description?: string;
  days_per_year: number;
  is_paid: boolean;
  requires_approval: boolean;
  color: string;
  created_at: string;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name?: string;
  leave_type_id: string;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string;
  status: string;
  half_day: boolean;
  approved_by?: string;
  approved_at?: string;
  manager_comment?: string;
  created_at: string;
}

interface Attendance {
  id: string;
  employee_id: string;
  employee_name?: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  total_hours?: number;
  status: string;
  notes?: string;
  created_at: string;
}

interface Payroll {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  job_title?: string;
  pay_period_start: string;
  pay_period_end: string;
  basic_salary: number;
  overtime_hours: number;
  overtime_rate: number;
  overtime_pay: number;
  bonus: number;
  gross_pay: number;
  deductions: number;
  tax: number;
  benefits_deduction: number;
  net_pay: number;
  status: string;
  notes?: string;
  created_at: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: string;
  department_id?: string;
  priority: string;
  author_id: string;
  author_name?: string;
  expires_at?: string;
  is_active: boolean;
  created_at: string;
}

interface DashboardStats {
  total_employees: number;
  active_employees: number;
  new_hires_this_month: number;
  employees_on_leave: number;
  pending_leave_requests: number;
  pending_timesheet_approvals: number;
  upcoming_birthdays: Array<{ employee_id: string; name: string; date: string; days_until: number }>;
  upcoming_anniversaries: Array<{ employee_id: string; name: string; date: string; years: number; days_until: number }>;
  department_breakdown: Array<{ department_id: string; name: string; employee_count: number }>;
  attendance_today: { present: number; late: number; absent: number; on_leave: number };
  recent_activities: Array<{ id: string; action: string; description: string; created_at: string }>;
}

interface HRStore {
  // Data
  employees: Employee[];
  departments: Department[];
  leaveTypes: LeaveType[];
  leaveRequests: LeaveRequest[];
  attendance: Attendance[];
  payroll: Payroll[];
  announcements: Announcement[];
  dashboardStats: DashboardStats | null;
  todayAttendance: Attendance | null;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setToken: (token: string | null) => void;
  fetchDashboardStats: () => Promise<void>;
  fetchEmployees: (params?: { status?: string; department_id?: string; search?: string }) => Promise<void>;
  fetchEmployee: (id: string) => Promise<Employee>;
  createEmployee: (data: Partial<Employee>) => Promise<void>;
  updateEmployee: (id: string, data: Partial<Employee>) => Promise<void>;
  fetchDepartments: () => Promise<void>;
  createDepartment: (data: Partial<Department>) => Promise<void>;
  fetchLeaveTypes: () => Promise<void>;
  fetchLeaveRequests: (params?: { status?: string; employee_id?: string }) => Promise<void>;
  createLeaveRequest: (data: { leave_type_id: string; start_date: string; end_date: string; reason?: string; half_day?: boolean }) => Promise<void>;
  updateLeaveRequest: (id: string, status: string, comment?: string) => Promise<void>;
  fetchTodayAttendance: () => Promise<void>;
  clockIn: (notes?: string, latitude?: number, longitude?: number, localTime?: string, timezone?: string) => Promise<void>;
  clockOut: (notes?: string, latitude?: number, longitude?: number, localTime?: string, timezone?: string) => Promise<void>;
  fetchAttendance: (params?: { employee_id?: string; start_date?: string; end_date?: string }) => Promise<void>;
  fetchPayroll: (params?: { employee_id?: string; status?: string }) => Promise<void>;
  fetchAnnouncements: () => Promise<void>;
  seedData: () => Promise<void>;
  clearError: () => void;
}

let authToken: string | null = null;

const getAuthToken = async (): Promise<string | null> => {
  // First check module-level variable
  if (authToken) {
    return authToken;
  }
  
  // Fall back to AsyncStorage
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      authToken = token;
      return token;
    }
  } catch (e) {
    console.log('Error getting token from storage:', e);
  }
  
  return null;
};

const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getAuthToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  
  return response.json();
};

export const useHRStore = create<HRStore>((set, get) => ({
  employees: [],
  departments: [],
  leaveTypes: [],
  leaveRequests: [],
  attendance: [],
  payroll: [],
  announcements: [],
  dashboardStats: null,
  todayAttendance: null,
  isLoading: false,
  error: null,

  setToken: (token) => {
    authToken = token;
  },

  fetchDashboardStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const stats = await apiRequest('/api/dashboard/stats');
      set({ dashboardStats: stats });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEmployees: async (params) => {
    set({ isLoading: true, error: null });
    try {
      let url = '/api/employees';
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.department_id) queryParams.append('department_id', params.department_id);
      if (params?.search) queryParams.append('search', params.search);
      if (queryParams.toString()) url += `?${queryParams.toString()}`;
      
      const employees = await apiRequest(url);
      set({ employees });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchEmployee: async (id) => {
    const employee = await apiRequest(`/api/employees/${id}`);
    return employee;
  },

  createEmployee: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest('/api/employees', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await get().fetchEmployees();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateEmployee: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest(`/api/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      await get().fetchEmployees();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchDepartments: async () => {
    set({ isLoading: true, error: null });
    try {
      const departments = await apiRequest('/api/departments');
      set({ departments });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createDepartment: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest('/api/departments', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await get().fetchDepartments();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLeaveTypes: async () => {
    set({ isLoading: true, error: null });
    try {
      const leaveTypes = await apiRequest('/api/leave-types');
      set({ leaveTypes });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLeaveRequests: async (params) => {
    set({ isLoading: true, error: null });
    try {
      let url = '/api/leave-requests';
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.employee_id) queryParams.append('employee_id', params.employee_id);
      if (queryParams.toString()) url += `?${queryParams.toString()}`;
      
      const leaveRequests = await apiRequest(url);
      set({ leaveRequests });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  createLeaveRequest: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest('/api/leave-requests', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      await get().fetchLeaveRequests();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateLeaveRequest: async (id, status, comment) => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest(`/api/leave-requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, manager_comment: comment }),
      });
      await get().fetchLeaveRequests();
      await get().fetchDashboardStats();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchTodayAttendance: async () => {
    try {
      const attendance = await apiRequest('/api/attendance/today');
      set({ todayAttendance: attendance });
    } catch (error: any) {
      set({ todayAttendance: null });
    }
  },

  clockIn: async (notes, latitude, longitude, localTime, timezone) => {
    set({ isLoading: true, error: null });
    try {
      const attendance = await apiRequest('/api/attendance/clock-in', {
        method: 'POST',
        body: JSON.stringify({ notes, latitude, longitude, local_time: localTime, timezone }),
      });
      set({ todayAttendance: attendance });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clockOut: async (notes, latitude, longitude, localTime, timezone) => {
    set({ isLoading: true, error: null });
    try {
      const attendance = await apiRequest('/api/attendance/clock-out', {
        method: 'POST',
        body: JSON.stringify({ notes, latitude, longitude, local_time: localTime, timezone }),
      });
      set({ todayAttendance: attendance });
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAttendance: async (params) => {
    set({ isLoading: true, error: null });
    try {
      let url = '/api/attendance';
      const queryParams = new URLSearchParams();
      if (params?.employee_id) queryParams.append('employee_id', params.employee_id);
      if (params?.start_date) queryParams.append('start_date', params.start_date);
      if (params?.end_date) queryParams.append('end_date', params.end_date);
      if (queryParams.toString()) url += `?${queryParams.toString()}`;
      
      const attendance = await apiRequest(url);
      set({ attendance });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchPayroll: async (params) => {
    set({ isLoading: true, error: null });
    try {
      let url = '/api/payroll';
      const queryParams = new URLSearchParams();
      if (params?.employee_id) queryParams.append('employee_id', params.employee_id);
      if (params?.status) queryParams.append('status', params.status);
      if (queryParams.toString()) url += `?${queryParams.toString()}`;
      
      const payroll = await apiRequest(url);
      set({ payroll });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  fetchAnnouncements: async () => {
    set({ isLoading: true, error: null });
    try {
      const announcements = await apiRequest('/api/announcements');
      set({ announcements });
    } catch (error: any) {
      set({ error: error.message });
    } finally {
      set({ isLoading: false });
    }
  },

  seedData: async () => {
    set({ isLoading: true, error: null });
    try {
      await apiRequest('/api/seed-data', { method: 'POST' });
      await get().fetchDashboardStats();
      await get().fetchEmployees();
      await get().fetchDepartments();
      await get().fetchLeaveTypes();
    } catch (error: any) {
      set({ error: error.message });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
