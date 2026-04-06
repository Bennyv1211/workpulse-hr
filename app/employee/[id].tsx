import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useHRStore } from '../../src/store/hrStore';
import { useAuth } from '../../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { format, parseISO, isValid } from 'date-fns';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

interface LeaveTypeMap {
  [key: string]: string;
}

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { fetchEmployee } = useHRStore();

  const [employee, setEmployee] = useState<any>(null);
  const [leaveTypeMap, setLeaveTypeMap] = useState<LeaveTypeMap>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canViewEmployeeDetails =
    user?.role === 'super_admin' ||
    user?.role === 'hr_admin' ||
    user?.role === 'manager';

  useEffect(() => {
    if (!user) return;

    if (!canViewEmployeeDetails) {
      Alert.alert('Access Denied', 'You do not have permission to view employee details.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }

    loadEmployeeData();
  }, [id, user]);

  const apiRequest = async (endpoint: string) => {
    const token = await AsyncStorage.getItem('auth_token');

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const raw = await response.text();

    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.detail || 'Request failed');
    }

    return data;
  };

  const loadLeaveTypes = async () => {
    try {
      const leaveTypes = await apiRequest('/api/leave-types');
      const map: LeaveTypeMap = {};

      if (Array.isArray(leaveTypes)) {
        leaveTypes.forEach((type: any) => {
          if (type?.id && type?.name) {
            map[type.id] = type.name;
          }
        });
      }

      setLeaveTypeMap(map);
    } catch (error) {
      console.log('Error loading leave types:', error);
      setLeaveTypeMap({});
    }
  };

  const loadEmployee = async () => {
    const emp = await fetchEmployee(id!);
    setEmployee(emp);
  };

  const loadEmployeeData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadEmployee(), loadLeaveTypes()]);
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEmployeeData();
    setRefreshing(false);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return '#10B981';
      case 'on_leave':
        return '#F59E0B';
      case 'terminated':
        return '#EF4444';
      default:
        return '#64748B';
    }
  };

  const safeFormatDate = (dateString?: string) => {
    if (!dateString) return undefined;

    try {
      const parsed = parseISO(dateString);
      if (!isValid(parsed)) return dateString;
      return format(parsed, 'MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const buildAddress = () => {
    if (!employee) return undefined;

    const parts = [
      employee.address,
      employee.city,
      employee.state,
      employee.zip_code,
    ].filter(Boolean);

    return parts.length ? parts.join(', ') : undefined;
  };

  const getInitials = () => {
    const first = employee?.first_name?.[0] || '';
    const last = employee?.last_name?.[0] || '';
    return `${first}${last}` || '?';
  };

  const InfoRow = ({
    label,
    value,
    icon,
  }: {
    label: string;
    value?: string | number | null;
    icon?: string;
  }) =>
    value !== undefined && value !== null && value !== '' ? (
      <View style={styles.infoRow}>
        {icon && <Ionicons name={icon as any} size={18} color="#64748B" style={styles.infoIcon} />}
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{String(value)}</Text>
      </View>
    ) : null;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!employee) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Employee</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Employee not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const leaveEntries = employee.leave_balance
    ? Object.entries(employee.leave_balance)
    : [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Employee Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </View>

          <Text style={styles.employeeName}>
            {employee.first_name || ''} {employee.last_name || ''}
          </Text>

          <Text style={styles.jobTitle}>{employee.job_title || 'No job title'}</Text>

          <View
            style={[
              styles.statusChip,
              { backgroundColor: `${getStatusColor(employee.status)}20` },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(employee.status) },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: getStatusColor(employee.status) },
              ]}
            >
              {employee.status || 'unknown'}
            </Text>
          </View>

          <Text style={styles.employeeId}>ID: {employee.employee_id || 'N/A'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Work Information</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="business-outline" label="Department" value={employee.department_name} />
            <InfoRow icon="person-outline" label="Reports To" value={employee.manager_name} />
            <InfoRow icon="location-outline" label="Work Location" value={employee.work_location} />
            <InfoRow icon="briefcase-outline" label="Employment Type" value={employee.employment_type} />
            <InfoRow
              icon="calendar-outline"
              label="Start Date"
              value={safeFormatDate(employee.start_date)}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <InfoRow icon="mail-outline" label="Email" value={employee.email} />
            <InfoRow icon="call-outline" label="Phone" value={employee.phone} />
            <InfoRow icon="home-outline" label="Address" value={buildAddress()} />
            <InfoRow icon="globe-outline" label="Country" value={employee.country} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.infoCard}>
            <InfoRow
              icon="gift-outline"
              label="Date of Birth"
              value={safeFormatDate(employee.date_of_birth)}
            />
          </View>
        </View>

        {employee.emergency_contact && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            <View style={styles.infoCard}>
              <InfoRow icon="person-outline" label="Name" value={employee.emergency_contact.name} />
              <InfoRow
                icon="heart-outline"
                label="Relationship"
                value={employee.emergency_contact.relationship}
              />
              <InfoRow icon="call-outline" label="Phone" value={employee.emergency_contact.phone} />
            </View>
          </View>
        )}

        {employee.skills && employee.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillsContainer}>
              {employee.skills.map((skill: string, index: number) => (
                <View key={index} style={styles.skillChip}>
                  <Text style={styles.skillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {leaveEntries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Leave Balance</Text>
            <View style={styles.leaveGrid}>
              {leaveEntries.map(([typeId, balance]) => (
                <View key={typeId} style={styles.leaveCard}>
                  <Text style={styles.leaveBalance}>{String(balance)}</Text>
                  <Text style={styles.leaveLabel}>
                    {leaveTypeMap[typeId] || 'Leave'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  employeeName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  jobTitle: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  employeeId: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 8,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoIcon: {
    marginRight: 12,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
    maxWidth: '50%',
    textAlign: 'right',
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  skillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  leaveGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  leaveCard: {
    width: '30%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  leaveBalance: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  leaveLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },
});