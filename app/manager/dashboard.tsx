import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import AppIcon from '../../src/components/AppIcon';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');
const MANAGER_DASHBOARD_CACHE_KEY = 'manager_dashboard_cache_v1';
const REQUEST_TIMEOUT_MS = 8000;

type WorkforceStatus = 'working' | 'on_break' | 'clocked_out';

type ManagerEmployeeRow = {
  id: string;
  employee_id?: string;
  name: string;
  department_name?: string;
  job_title?: string;
  status: WorkforceStatus;
  is_late_today: boolean;
  today_hours: number;
  clock_in_local?: string | null;
  break_started_local?: string | null;
};

type ManagerLeaveRequest = {
  id: string;
  employee_id: string;
  employee_name: string;
  leave_type_name: string;
  start_date: string;
  end_date: string;
  status: string;
  reason?: string;
  created_at: string;
};

type ManagerDashboardResponse = {
  date: string;
  summary: {
    total_employees: number;
    working: number;
    on_break: number;
    clocked_out: number;
    late: number;
    pending_leave_requests: number;
  };
  employees: ManagerEmployeeRow[];
  pending_leave_requests: ManagerLeaveRequest[];
};

const emptyDashboard: ManagerDashboardResponse = {
  date: '',
  summary: {
    total_employees: 0,
    working: 0,
    on_break: 0,
    clocked_out: 0,
    late: 0,
    pending_leave_requests: 0,
  },
  employees: [],
  pending_leave_requests: [],
};

export default function ManagerDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const [dashboard, setDashboard] = useState<ManagerDashboardResponse>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingLeaveId, setProcessingLeaveId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'super_admin' || user.role === 'hr_admin' || user.role === 'hr') {
      router.replace('/hr/dashboard');
      return;
    }

    if (user.role !== 'manager') {
      router.replace('/(tabs)/dashboard');
    }
  }, [router, user]);

  const reportDate = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    const day = `${now.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const getToken = useCallback(async () => {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (authToken) return authToken;
    return await AsyncStorage.getItem('token');
  }, []);

  const apiRequest = useCallback(async (endpoint: string, method: string = 'GET', body?: any) => {
    const token = await getToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });

      const raw = await response.text();

      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = { detail: raw || `Request failed (${response.status})` };
      }

      if (!response.ok) {
        throw new Error(
          typeof data?.detail === 'string'
            ? data.detail
            : data?.message || `Request failed (${response.status})`
        );
      }

      return data;
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }, [getToken]);

  const loadDashboard = useCallback(async () => {
    let hadCachedData = false;
    try {
      const cached = await AsyncStorage.getItem(MANAGER_DASHBOARD_CACHE_KEY);
      if (cached) {
        setDashboard(JSON.parse(cached));
        setLoading(false);
        hadCachedData = true;
      }

      const data = await apiRequest(`/api/manager/dashboard?target_date=${reportDate}`);
      const nextDashboard = data || emptyDashboard;
      setDashboard(nextDashboard);
      await AsyncStorage.setItem(MANAGER_DASHBOARD_CACHE_KEY, JSON.stringify(nextDashboard));
    } catch (error: any) {
      if (!hadCachedData) {
        Alert.alert('Error', error.message || 'Failed to load manager dashboard');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiRequest, reportDate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
  }, [loadDashboard]);

  const updateLeaveStatus = async (
    requestId: string,
    status: 'approved' | 'rejected'
  ) => {
    try {
      setProcessingLeaveId(requestId);
      await apiRequest(`/api/leave-requests/${requestId}`, 'PUT', { status });
      await loadDashboard();
    } catch (error: any) {
      Alert.alert('Error', error.message || `Failed to ${status} leave request`);
    } finally {
      setProcessingLeaveId(null);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/hr-login');
        },
      },
    ]);
  };

  const formatShortTime = (value?: string | null) => {
    if (!value) return '--';
    return new Date(value).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(`${start}T00:00:00`);
    const endDate = new Date(`${end}T00:00:00`);

    return `${startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  };

  const getStatusColors = (status: WorkforceStatus) => {
    if (status === 'working') {
      return { bg: '#DCFCE7', text: '#166534', label: 'Working' };
    }
    if (status === 'on_break') {
      return { bg: '#FEF3C7', text: '#92400E', label: 'On Break' };
    }
    return { bg: '#E2E8F0', text: '#334155', label: 'Clocked Out' };
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Manager Dashboard</Text>
          <Text style={styles.subtitle}>
            Live team status for {user?.first_name || 'Manager'}
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCard label="Employees" value={dashboard.summary.total_employees} color="#2563EB" />
          <SummaryCard label="Working" value={dashboard.summary.working} color="#10B981" />
          <SummaryCard label="On Break" value={dashboard.summary.on_break} color="#F59E0B" />
          <SummaryCard label="Late Today" value={dashboard.summary.late} color="#EF4444" />
        </View>

        <TouchableOpacity
          style={styles.scheduleHeroCard}
          activeOpacity={0.88}
          onPress={() => router.push('/manager/schedules')}
        >
          <View style={styles.scheduleHeroIconWrap}>
            <AppIcon name="schedule" size={22} color="#2563EB" />
          </View>
          <View style={styles.scheduleHeroTextWrap}>
            <Text style={styles.scheduleHeroTitle}>Build Team Schedules</Text>
            <Text style={styles.scheduleHeroSub}>
              Assign one employee or push a weekly pattern to your whole department.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#2563EB" />
        </TouchableOpacity>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Pending Leave Requests</Text>
            <Text style={styles.sectionSub}>
              {dashboard.summary.pending_leave_requests} awaiting review
            </Text>
          </View>

          {dashboard.pending_leave_requests.length === 0 ? (
            <Text style={styles.emptyText}>No pending leave requests right now.</Text>
          ) : (
            dashboard.pending_leave_requests.map((item) => (
              <View key={item.id} style={styles.leaveCard}>
                <View style={styles.leaveCardTop}>
                  <View style={styles.leaveIconWrap}>
                    <AppIcon name="leave-requests" size={20} color="#8B5CF6" />
                  </View>
                  <View style={styles.leaveTextWrap}>
                    <Text style={styles.leaveEmployee}>{item.employee_name}</Text>
                    <Text style={styles.leaveType}>{item.leave_type_name}</Text>
                    <Text style={styles.leaveDates}>
                      {formatDateRange(item.start_date, item.end_date)}
                    </Text>
                  </View>
                </View>

                {!!item.reason && <Text style={styles.leaveReason}>{item.reason}</Text>}

                <View style={styles.leaveActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => updateLeaveStatus(item.id, 'approved')}
                    disabled={processingLeaveId === item.id}
                  >
                    <Text style={styles.actionButtonText}>
                      {processingLeaveId === item.id ? 'Working...' : 'Approve'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => updateLeaveStatus(item.id, 'rejected')}
                    disabled={processingLeaveId === item.id}
                  >
                    <Text style={styles.actionButtonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Team Status</Text>
            <Text style={styles.sectionSub}>Based on today&apos;s phone-time clock data</Text>
          </View>

          {dashboard.employees.length === 0 ? (
            <Text style={styles.emptyText}>No employees found.</Text>
          ) : (
            dashboard.employees.map((employee) => {
              const statusColors = getStatusColors(employee.status);

              return (
                <TouchableOpacity
                  key={employee.id}
                  style={styles.employeeCard}
                  activeOpacity={0.85}
                  onPress={() => router.push(`/employee/${employee.id}`)}
                >
                  <View style={styles.employeeTop}>
                    <View style={styles.employeeTextWrap}>
                      <Text style={styles.employeeName}>{employee.name}</Text>
                      <Text style={styles.employeeMeta}>
                        {employee.employee_id || 'No ID'}{employee.job_title ? `  |  ${employee.job_title}` : ''}
                      </Text>
                      {!!employee.department_name && (
                        <Text style={styles.employeeMeta}>{employee.department_name}</Text>
                      )}
                    </View>

                    <View style={[styles.statusPill, { backgroundColor: statusColors.bg }]}>
                      <Text style={[styles.statusPillText, { color: statusColors.text }]}>
                        {statusColors.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.employeeStatsRow}>
                    <Text style={styles.employeeStat}>
                      Hours today: <Text style={styles.employeeStatStrong}>{employee.today_hours.toFixed(2)}</Text>
                    </Text>
                    <Text style={styles.employeeStat}>
                      Clock in: <Text style={styles.employeeStatStrong}>{formatShortTime(employee.clock_in_local)}</Text>
                    </Text>
                  </View>

                  {employee.status === 'on_break' && (
                    <Text style={styles.employeeAlert}>
                      On break since {formatShortTime(employee.break_started_local)}
                    </Text>
                  )}

                  {employee.is_late_today && (
                    <Text style={styles.employeeAlertLate}>Late for 9:00 AM start</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <AppIcon name="logout" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.summaryCard}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#64748B',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  summaryLabel: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
  },
  scheduleHeroCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scheduleHeroIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleHeroTextWrap: {
    flex: 1,
  },
  scheduleHeroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  scheduleHeroSub: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSub: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  leaveCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  leaveCardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  leaveIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveTextWrap: {
    flex: 1,
  },
  leaveEmployee: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  leaveType: {
    marginTop: 2,
    fontSize: 14,
    color: '#64748B',
  },
  leaveDates: {
    marginTop: 4,
    fontSize: 13,
    color: '#94A3B8',
  },
  leaveReason: {
    marginTop: 10,
    fontSize: 13,
    color: '#475569',
  },
  leaveActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  employeeCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  employeeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  employeeTextWrap: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  employeeMeta: {
    marginTop: 3,
    fontSize: 13,
    color: '#64748B',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  employeeStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 12,
  },
  employeeStat: {
    fontSize: 13,
    color: '#475569',
  },
  employeeStatStrong: {
    fontWeight: '700',
    color: '#0F172A',
  },
  employeeAlert: {
    marginTop: 10,
    fontSize: 13,
    color: '#92400E',
    fontWeight: '600',
  },
  employeeAlertLate: {
    marginTop: 8,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 15,
  },
});
