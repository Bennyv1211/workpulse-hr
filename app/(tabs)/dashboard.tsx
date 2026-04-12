import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');
const DASHBOARD_CACHE_KEY = 'employee_dashboard_cache_v1';
const REQUEST_TIMEOUT_MS = 8000;

type ShiftStatus = 'clocked_out' | 'working' | 'on_break';

interface LeaveRequest {
  id: string;
  leave_type_id?: string;
  leave_type_name?: string;
  leave_type?: string;
  type?: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected' | string;
  reason?: string;
  note?: string;
  created_at?: string;
}

interface ShiftResponse {
  id?: string;
  status?: ShiftStatus;
  clock_in?: string;
  clock_in_local?: string;
  total_break_seconds?: number;
}

interface AttendanceRow {
  id: string;
  date: string;
  total_hours?: number | null;
}

interface LeaveBalanceMetric {
  days: number;
  hours: number;
}

interface DashboardData {
  status: ShiftStatus;
  hoursThisWeek: number;
  leaveBalanceHours: number;
  annualLeave: LeaveBalanceMetric;
  sickLeave: LeaveBalanceMetric;
  pendingLeaveCount: number;
  approvedLeaveCount: number;
  rejectedLeaveCount: number;
  weeklyHours: { day: string; hours: number }[];
  leaveRequests: LeaveRequest[];
  clockInLocal?: string | null;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CHART_BAR_MAX_HEIGHT = 140;

export default function EmployeeDashboardScreen() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dashboard, setDashboard] = useState<DashboardData>({
    status: 'clocked_out',
    hoursThisWeek: 0,
    leaveBalanceHours: 0,
    annualLeave: { days: 0, hours: 0 },
    sickLeave: { days: 0, hours: 0 },
    pendingLeaveCount: 0,
    approvedLeaveCount: 0,
    rejectedLeaveCount: 0,
    weeklyHours: WEEKDAY_LABELS.map((day) => ({ day, hours: 0 })),
    leaveRequests: [],
    clockInLocal: null,
  });

  const getToken = async () => {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (authToken) return authToken;
    return await AsyncStorage.getItem('token');
  };

  const apiRequest = async (endpoint: string) => {
    const token = await getToken();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
        const message =
          typeof data?.detail === 'string'
            ? data.detail
            : data?.message || `Request failed (${response.status})`;

        throw new Error(message);
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
  };

  const getStartOfWeek = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  const getEndOfWeek = () => {
    const monday = getStartOfWeek();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return sunday;
  };

  const formatISODate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const mapDateToWeekdayLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return labels[day];
  };

  const weekdayOrder = (label: string) => {
    return WEEKDAY_LABELS.indexOf(label);
  };

  const loadDashboard = useCallback(async () => {
    let hadCachedData = false;
    try {
      const cached = await AsyncStorage.getItem(DASHBOARD_CACHE_KEY);
      if (cached) {
        setDashboard(JSON.parse(cached));
        setLoading(false);
        hadCachedData = true;
      }

      const startDate = formatISODate(getStartOfWeek());
      const endDate = formatISODate(getEndOfWeek());

      const [shiftData, attendanceData, leaveData, leaveBalanceData] =
        await Promise.allSettled([
          apiRequest('/api/shifts/current'),
          apiRequest(`/api/attendance?start_date=${startDate}&end_date=${endDate}`),
          apiRequest('/api/time-off'),
          apiRequest('/api/leave-balance/me'),
        ]);

      let currentStatus: ShiftStatus = 'clocked_out';
      let clockInLocal: string | null = null;

      if (shiftData.status === 'fulfilled' && shiftData.value) {
        const shift = shiftData.value as ShiftResponse;
        currentStatus = shift?.status || 'clocked_out';
        clockInLocal = shift?.clock_in_local || shift?.clock_in || null;
      }

      const weeklySeed = WEEKDAY_LABELS.map((day) => ({ day, hours: 0 }));
      let hoursThisWeek = 0;

      if (attendanceData.status === 'fulfilled' && Array.isArray(attendanceData.value)) {
        const rows = attendanceData.value as AttendanceRow[];

        for (const row of rows) {
          const rowHours = Number(row.total_hours || 0);
          hoursThisWeek += rowHours;

          const label = mapDateToWeekdayLabel(row.date);
          const idx = weeklySeed.findIndex((x) => x.day === label);
          if (idx >= 0) {
            weeklySeed[idx].hours += rowHours;
          }
        }
      }

      let leaveRequests: LeaveRequest[] = [];
      let pendingLeaveCount = 0;
      let approvedLeaveCount = 0;
      let rejectedLeaveCount = 0;

      if (leaveData.status === 'fulfilled' && Array.isArray(leaveData.value)) {
        leaveRequests = (leaveData.value as LeaveRequest[]).map((request) => ({
          ...request,
          status: request.status === 'denied' ? 'rejected' : request.status,
          reason: request.reason || request.note,
        }));

        pendingLeaveCount = leaveRequests.filter((r) => r.status === 'pending').length;
        approvedLeaveCount = leaveRequests.filter((r) => r.status === 'approved').length;
        rejectedLeaveCount = leaveRequests.filter((r) => r.status === 'rejected').length;

        leaveRequests = [...leaveRequests]
          .filter(
            (request, index, allRequests) =>
              allRequests.findIndex((item) => item.id === request.id) === index
          )
          .sort((a, b) => {
            const aDate = new Date(a.created_at || a.start_date).getTime();
            const bDate = new Date(b.created_at || b.start_date).getTime();
            return bDate - aDate;
          });
      }

      let leaveBalanceHours = 0;
      let annualLeave: LeaveBalanceMetric = { days: 0, hours: 0 };
      let sickLeave: LeaveBalanceMetric = { days: 0, hours: 0 };
      if (leaveBalanceData.status === 'fulfilled' && leaveBalanceData.value) {
        const value = leaveBalanceData.value;
        leaveBalanceHours = Number(
          value?.leave_balance_hours ??
            value?.vacation_balance_hours ??
            value?.available_hours ??
            value?.balance_hours ??
            0
        );

        annualLeave = {
          days: Number(value?.details?.['Annual Leave']?.days ?? 0),
          hours: Number(value?.details?.['Annual Leave']?.hours ?? 0),
        };

        sickLeave = {
          days: Number(value?.details?.['Sick Leave']?.days ?? 0),
          hours: Number(value?.details?.['Sick Leave']?.hours ?? 0),
        };
      }

      const nextDashboard = {
        status: currentStatus,
        hoursThisWeek: Number(hoursThisWeek.toFixed(2)),
        leaveBalanceHours: Number(leaveBalanceHours.toFixed(2)),
        annualLeave: {
          days: Number(annualLeave.days.toFixed(2)),
          hours: Number(annualLeave.hours.toFixed(2)),
        },
        sickLeave: {
          days: Number(sickLeave.days.toFixed(2)),
          hours: Number(sickLeave.hours.toFixed(2)),
        },
        pendingLeaveCount,
        approvedLeaveCount,
        rejectedLeaveCount,
        weeklyHours: weeklySeed.sort(
          (a, b) => weekdayOrder(a.day) - weekdayOrder(b.day)
        ),
        leaveRequests,
        clockInLocal,
      };

      setDashboard(nextDashboard);
      await AsyncStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(nextDashboard));
    } catch (error: any) {
      if (!hadCachedData) {
        Alert.alert('Error', error.message || 'Failed to load dashboard');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();

      const intervalId = setInterval(() => {
        loadDashboard();
      }, 30000);

      return () => clearInterval(intervalId);
    }, [loadDashboard])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadDashboard();
      }
    });

    return () => subscription.remove();
  }, [loadDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
  }, [loadDashboard]);

  const maxHours = useMemo(() => {
    return Math.max(...dashboard.weeklyHours.map((d) => d.hours), 1);
  }, [dashboard.weeklyHours]);

  const weeklyGoalHours = 40;
  const weeklyGoalProgress = useMemo(
    () => Math.min(dashboard.hoursThisWeek / weeklyGoalHours, 1),
    [dashboard.hoursThisWeek]
  );
  const totalRequestCount = useMemo(
    () =>
      dashboard.pendingLeaveCount + dashboard.approvedLeaveCount + dashboard.rejectedLeaveCount,
    [dashboard.approvedLeaveCount, dashboard.pendingLeaveCount, dashboard.rejectedLeaveCount]
  );
  const annualVsSickMax = useMemo(
    () => Math.max(dashboard.annualLeave.hours, dashboard.sickLeave.hours, 1),
    [dashboard.annualLeave.hours, dashboard.sickLeave.hours]
  );

  const statusConfig = useMemo(() => {
    if (dashboard.status === 'working') {
      return {
        icon: 'play-circle' as const,
        color: '#10B981',
        label: 'Working',
      };
    }

    if (dashboard.status === 'on_break') {
      return {
        icon: 'cafe' as const,
        color: '#F59E0B',
        label: 'On Break',
      };
    }

    return {
      icon: 'pause-circle' as const,
      color: '#94A3B8',
      label: 'Clocked Out',
    };
  }, [dashboard.status]);

  const formatDate = (value: string) => {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatShortTime = (value?: string | null) => {
    if (!value) return '--:--';
    return new Date(value).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLeaveType = (item: LeaveRequest) => {
    return item.leave_type_name || item.leave_type || item.type || 'Leave';
  };

  const getStatusColors = (status: string) => {
    if (status === 'approved') {
      return { bg: '#DCFCE7', text: '#166534' };
    }
    if (status === 'pending') {
      return { bg: '#FEF3C7', text: '#92400E' };
    }
    if (status === 'rejected') {
      return { bg: '#FEE2E2', text: '#991B1B' };
    }
    return { bg: '#E2E8F0', text: '#334155' };
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
          <Text style={styles.greeting}>
            Hi, {user?.first_name || 'Employee'}
          </Text>
          <Text style={styles.headerSub}>Here’s your week at a glance</Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="time-outline" size={20} color="#2563EB" />
            </View>
            <Text style={styles.summaryValue}>{dashboard.hoursThisWeek.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Hours This Week</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name={statusConfig.icon} size={20} color={statusConfig.color} />
            </View>
            <Text style={[styles.summaryValue, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
            <Text style={styles.summaryLabel}>
              {dashboard.status === 'working'
                ? `Since ${formatShortTime(dashboard.clockInLocal)}`
                : 'Current Status'}
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="airplane-outline" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.summaryValue}>
              {dashboard.annualLeave.days.toFixed(1)}d
            </Text>
            <Text style={styles.summaryLabel}>
              Annual Leave ({dashboard.annualLeave.hours.toFixed(1)}h)
            </Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="medkit-outline" size={20} color="#EF4444" />
            </View>
            <Text style={styles.summaryValue}>
              {dashboard.sickLeave.days.toFixed(1)}d
            </Text>
            <Text style={styles.summaryLabel}>
              Sick Leave ({dashboard.sickLeave.hours.toFixed(1)}h)
            </Text>
          </View>
        </View>

        <View style={styles.totalLeaveCard}>
          <View>
            <Text style={styles.totalLeaveTitle}>Total Leave Balance</Text>
            <Text style={styles.totalLeaveSub}>
              Combined available leave across tracked balances
            </Text>
          </View>
          <Text style={styles.totalLeaveValue}>
            {dashboard.leaveBalanceHours.toFixed(1)}h
          </Text>
        </View>

        <View style={styles.spotlightCard}>
          <View style={styles.spotlightHeader}>
            <View>
              <Text style={styles.spotlightTitle}>Week Momentum</Text>
              <Text style={styles.spotlightSub}>
                {dashboard.hoursThisWeek.toFixed(1)} of {weeklyGoalHours} target hours logged
              </Text>
            </View>
            <Text style={styles.spotlightPercent}>
              {Math.round(weeklyGoalProgress * 100)}%
            </Text>
          </View>
          <View style={styles.spotlightTrack}>
            <View style={[styles.spotlightFill, { width: `${weeklyGoalProgress * 100}%` }]} />
          </View>
        </View>

        <View style={styles.dualInsightRow}>
          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>Request Snapshot</Text>
            <Text style={styles.insightSub}>{totalRequestCount} requests tracked</Text>

            <View style={styles.segmentBar}>
              <View
                style={[
                  styles.segmentSlice,
                  styles.segmentPending,
                  { flex: Math.max(dashboard.pendingLeaveCount, 0.4) },
                ]}
              />
              <View
                style={[
                  styles.segmentSlice,
                  styles.segmentApproved,
                  { flex: Math.max(dashboard.approvedLeaveCount, 0.4) },
                ]}
              />
              <View
                style={[
                  styles.segmentSlice,
                  styles.segmentRejected,
                  { flex: Math.max(dashboard.rejectedLeaveCount, 0.4) },
                ]}
              />
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.segmentPending]} />
                <Text style={styles.legendText}>Pending {dashboard.pendingLeaveCount}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.segmentApproved]} />
                <Text style={styles.legendText}>Approved {dashboard.approvedLeaveCount}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.segmentRejected]} />
                <Text style={styles.legendText}>Rejected {dashboard.rejectedLeaveCount}</Text>
              </View>
            </View>
          </View>

          <View style={styles.insightCard}>
            <Text style={styles.insightTitle}>Leave Balance Mix</Text>
            <Text style={styles.insightSub}>Your tracked balance split</Text>

            <View style={styles.balanceCompareWrap}>
              <View style={styles.balanceCompareColumn}>
                <View style={styles.balanceCompareTrack}>
                  <View
                    style={[
                      styles.balanceCompareFill,
                      styles.balanceCompareFillAnnual,
                      {
                        height: `${(dashboard.annualLeave.hours / annualVsSickMax) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.balanceCompareValue}>
                  {dashboard.annualLeave.hours.toFixed(1)}h
                </Text>
                <Text style={styles.balanceCompareLabel}>Annual</Text>
              </View>

              <View style={styles.balanceCompareColumn}>
                <View style={styles.balanceCompareTrack}>
                  <View
                    style={[
                      styles.balanceCompareFill,
                      styles.balanceCompareFillSick,
                      {
                        height: `${(dashboard.sickLeave.hours / annualVsSickMax) * 100}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.balanceCompareValue}>
                  {dashboard.sickLeave.hours.toFixed(1)}h
                </Text>
                <Text style={styles.balanceCompareLabel}>Sick</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Weekly Hours</Text>
            <Text style={styles.sectionSub}>Mon to Sun</Text>
          </View>

          <View style={styles.chartWrap}>
            {dashboard.weeklyHours.map((item) => {
              const barHeight = Math.max(
                (item.hours / maxHours) * CHART_BAR_MAX_HEIGHT,
                item.hours > 0 ? 10 : 2
              );

              return (
                <View key={item.day} style={styles.barColumn}>
                  <Text style={styles.barValue}>{item.hours.toFixed(1)}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { height: barHeight }]} />
                  </View>
                  <Text style={styles.barLabel}>{item.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.leaveStatusRow}>
          <View style={[styles.leaveStatusCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.leaveStatusValue, { color: '#92400E' }]}>
              {dashboard.pendingLeaveCount}
            </Text>
            <Text style={[styles.leaveStatusLabel, { color: '#92400E' }]}>
              Pending
            </Text>
          </View>

          <View style={[styles.leaveStatusCard, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.leaveStatusValue, { color: '#166534' }]}>
              {dashboard.approvedLeaveCount}
            </Text>
            <Text style={[styles.leaveStatusLabel, { color: '#166534' }]}>
              Approved
            </Text>
          </View>

          <View style={[styles.leaveStatusCard, { backgroundColor: '#FEE2E2' }]}>
            <Text style={[styles.leaveStatusValue, { color: '#991B1B' }]}>
              {dashboard.rejectedLeaveCount}
            </Text>
            <Text style={[styles.leaveStatusLabel, { color: '#991B1B' }]}>
              Rejected
            </Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Vacation / Leave Requests</Text>
            <Text style={styles.sectionSub}>
              {dashboard.leaveRequests.length} total
            </Text>
          </View>

          {dashboard.leaveRequests.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={34} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No leave requests yet</Text>
              <Text style={styles.emptyText}>
                Your vacation and leave requests will appear here.
              </Text>
            </View>
          ) : (
            dashboard.leaveRequests.slice(0, 5).map((item) => {
              const statusColors = getStatusColors(item.status);

              return (
                <View key={item.id} style={styles.requestCard}>
                  <View style={styles.requestTop}>
                    <View>
                      <Text style={styles.requestType}>{getLeaveType(item)}</Text>
                      <Text style={styles.requestDate}>
                        {formatDate(item.start_date)} - {formatDate(item.end_date)}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: statusColors.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusPillText,
                          { color: statusColors.text },
                        ]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  {!!item.reason && (
                    <Text style={styles.requestReason}>{item.reason}</Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
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
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSub: {
    marginTop: 4,
    fontSize: 15,
    color: '#64748B',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 12,
  },
  summaryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    minHeight: 122,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  summaryLabel: {
    marginTop: 6,
    fontSize: 13,
    color: '#64748B',
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
  totalLeaveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  totalLeaveTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  totalLeaveSub: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  totalLeaveValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#2563EB',
  },
  spotlightCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 18,
    marginBottom: 18,
  },
  spotlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  spotlightTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  spotlightSub: {
    marginTop: 4,
    fontSize: 13,
    color: '#BFDBFE',
  },
  spotlightPercent: {
    fontSize: 24,
    fontWeight: '800',
    color: '#38BDF8',
  },
  spotlightTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 16,
    overflow: 'hidden',
  },
  spotlightFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#38BDF8',
  },
  dualInsightRow: {
    gap: 12,
    marginBottom: 18,
  },
  insightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  insightSub: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  segmentBar: {
    marginTop: 16,
    height: 14,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
  },
  segmentSlice: {
    height: '100%',
  },
  segmentPending: {
    backgroundColor: '#F59E0B',
  },
  segmentApproved: {
    backgroundColor: '#10B981',
  },
  segmentRejected: {
    backgroundColor: '#EF4444',
  },
  legendRow: {
    marginTop: 14,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
  },
  balanceCompareWrap: {
    marginTop: 18,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    minHeight: 180,
  },
  balanceCompareColumn: {
    alignItems: 'center',
  },
  balanceCompareTrack: {
    width: 44,
    height: 116,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  balanceCompareFill: {
    width: '100%',
    borderRadius: 999,
    minHeight: 8,
  },
  balanceCompareFillAnnual: {
    backgroundColor: '#8B5CF6',
  },
  balanceCompareFillSick: {
    backgroundColor: '#EF4444',
  },
  balanceCompareValue: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  balanceCompareLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
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
  chartWrap: {
    height: 220,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 18,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 3,
  },
  barValue: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 8,
  },
  barTrack: {
    width: 26,
    height: CHART_BAR_MAX_HEIGHT,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 999,
    minHeight: 4,
  },
  barLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  leaveStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  leaveStatusCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveStatusValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  leaveStatusLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptyText: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 13,
    color: '#64748B',
  },
  requestCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  requestType: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  requestDate: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  requestReason: {
    marginTop: 10,
    fontSize: 13,
    color: '#475569',
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
    textTransform: 'capitalize',
  },
});
