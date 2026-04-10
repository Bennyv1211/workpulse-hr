import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
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

interface DepartmentOption {
  id: string;
  name: string;
}

export default function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { fetchEmployee } = useHRStore();

  const [employee, setEmployee] = useState<any>(null);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [leaveTypeMap, setLeaveTypeMap] = useState<LeaveTypeMap>({});
  const [editableLeaveBalance, setEditableLeaveBalance] = useState<Record<string, string>>({});
  const [editingLeaveBalance, setEditingLeaveBalance] = useState(false);
  const [editingEmployment, setEditingEmployment] = useState(false);
  const [savingLeaveBalance, setSavingLeaveBalance] = useState(false);
  const [savingEmployment, setSavingEmployment] = useState(false);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'employee' | 'manager' | 'hr_admin'>('employee');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const canViewEmployeeDetails =
    user?.role === 'super_admin' ||
    user?.role === 'hr_admin' ||
    user?.role === 'hr' ||
    user?.role === 'manager';
  const canEditLeaveBalance =
    user?.role === 'super_admin' ||
    user?.role === 'hr_admin' ||
    user?.role === 'hr';

  const apiRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
    const token = await AsyncStorage.getItem('auth_token');

    const response = await fetch(`${API_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
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

  const loadLeaveTypes = useCallback(async () => {
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
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const data = await apiRequest('/api/departments');
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.log('Error loading departments:', error);
      setDepartments([]);
    }
  }, []);

  const loadEmployee = useCallback(async () => {
    const emp = await fetchEmployee(id!);
    setEmployee(emp);
    setSelectedDepartmentId(emp?.department_id || '');
    setSelectedRole((emp?.role || 'employee') as 'employee' | 'manager' | 'hr_admin');
    setTemporaryPassword('');
    setEditableLeaveBalance(
      Object.fromEntries(
        Object.entries(emp?.leave_balance || {}).map(([leaveTypeId, balance]) => [
          leaveTypeId,
          String(balance ?? 0),
        ])
      )
    );
  }, [fetchEmployee, id]);

  const loadEmployeeData = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([loadEmployee(), loadLeaveTypes(), loadDepartments()]);
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      setLoading(false);
    }
  }, [loadDepartments, loadEmployee, loadLeaveTypes]);

  useEffect(() => {
    if (!user) return;

    if (!canViewEmployeeDetails) {
      Alert.alert('Access Denied', 'You do not have permission to view employee details.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }

    loadEmployeeData();
  }, [canViewEmployeeDetails, loadEmployeeData, router, user]);

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

  const handleSaveLeaveBalance = async () => {
    const normalizedBalance: Record<string, number> = {};

    for (const [leaveTypeId, value] of Object.entries(editableLeaveBalance)) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed < 0) {
        Alert.alert('Invalid Balance', 'Leave balances must be 0 or greater.');
        return;
      }
      normalizedBalance[leaveTypeId] = parsed;
    }

    try {
      setSavingLeaveBalance(true);
      const updatedEmployee = await apiRequest(
        `/api/employees/${id}/leave-balance`,
        'PUT',
        { leave_balance: normalizedBalance }
      );
      setEmployee(updatedEmployee);
      setEditableLeaveBalance(
        Object.fromEntries(
          Object.entries(updatedEmployee?.leave_balance || {}).map(([leaveTypeId, balance]) => [
            leaveTypeId,
            String(balance ?? 0),
          ])
        )
      );
      setEditingLeaveBalance(false);
      Alert.alert('Saved', 'Leave balances updated successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update leave balance');
    } finally {
      setSavingLeaveBalance(false);
    }
  };

  const handleSaveEmploymentSettings = async () => {
    try {
      setSavingEmployment(true);
      const payload: Record<string, string> = {
        department_id: selectedDepartmentId,
        role: selectedRole,
      };

      if (temporaryPassword.trim()) {
        payload.temporary_password = temporaryPassword.trim();
      }

      const updatedEmployee = await apiRequest(
        `/api/employees/${id}`,
        'PUT',
        payload
      );

      setEmployee(updatedEmployee);
      setSelectedDepartmentId(updatedEmployee.department_id || '');
      setSelectedRole((updatedEmployee.role || 'employee') as 'employee' | 'manager' | 'hr_admin');
      setTemporaryPassword('');
      setEditingEmployment(false);
      setShowDepartmentDropdown(false);
      Alert.alert('Saved', 'Department, role, and account settings updated.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update employee settings');
    } finally {
      setSavingEmployment(false);
    }
  };

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
            <InfoRow icon="shield-outline" label="Account Role" value={employee.role || 'employee'} />
            <InfoRow
              icon="calendar-outline"
              label="Start Date"
              value={safeFormatDate(employee.start_date)}
            />
          </View>
        </View>

        {canEditLeaveBalance && (
          <View style={styles.section}>
            <View style={styles.leaveHeaderRow}>
              <Text style={styles.sectionTitle}>Admin Settings</Text>
              <TouchableOpacity
                style={styles.editBalanceButton}
                onPress={() => {
                  setEditingEmployment((current) => !current);
                  setShowDepartmentDropdown(false);
                  setTemporaryPassword('');
                }}
              >
                <Text style={styles.editBalanceButtonText}>
                  {editingEmployment ? 'Cancel' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>

            {editingEmployment ? (
              <View style={styles.infoCard}>
                <View style={styles.balanceInputRow}>
                  <Text style={styles.balanceInputLabel}>Department</Text>
                  <TouchableOpacity
                    style={styles.selectButton}
                    onPress={() => setShowDepartmentDropdown((current) => !current)}
                  >
                    <Text style={styles.selectButtonText}>
                      {departments.find((department) => department.id === selectedDepartmentId)?.name || 'Select department'}
                    </Text>
                    <Ionicons
                      name={showDepartmentDropdown ? 'chevron-up' : 'chevron-down'}
                      size={18}
                      color="#64748B"
                    />
                  </TouchableOpacity>

                  {showDepartmentDropdown && (
                    <View style={styles.dropdownMenu}>
                      {departments.map((department) => (
                        <TouchableOpacity
                          key={department.id}
                          style={styles.dropdownItemRow}
                          onPress={() => {
                            setSelectedDepartmentId(department.id);
                            setShowDepartmentDropdown(false);
                          }}
                        >
                          <Text style={styles.dropdownItemLabel}>{department.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                <View style={styles.balanceInputRow}>
                  <Text style={styles.balanceInputLabel}>Role</Text>
                  <View style={styles.roleRow}>
                    {[
                      { id: 'employee', label: 'Employee' },
                      { id: 'manager', label: 'Manager' },
                      { id: 'hr_admin', label: 'HR Admin' },
                    ].map((role) => (
                      <TouchableOpacity
                        key={role.id}
                        style={[
                          styles.roleButton,
                          selectedRole === role.id && styles.roleButtonActive,
                        ]}
                        onPress={() => setSelectedRole(role.id as 'employee' | 'manager' | 'hr_admin')}
                      >
                        <Text
                          style={[
                            styles.roleButtonText,
                            selectedRole === role.id && styles.roleButtonTextActive,
                          ]}
                        >
                          {role.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.balanceInputRow}>
                  <Text style={styles.balanceInputLabel}>Reset Temporary Password</Text>
                  <View style={styles.selectButton}>
                    <TextInput
                      style={styles.passwordField}
                      value={temporaryPassword}
                      onChangeText={setTemporaryPassword}
                      secureTextEntry={!showTemporaryPassword}
                      placeholder="Optional new temporary password"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => setShowTemporaryPassword((current) => !current)}>
                      <Ionicons
                        name={showTemporaryPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveBalanceButton, savingEmployment && styles.saveBalanceButtonDisabled]}
                  onPress={handleSaveEmploymentSettings}
                  disabled={savingEmployment}
                >
                  <Text style={styles.saveBalanceButtonText}>
                    {savingEmployment ? 'Saving...' : 'Save Admin Settings'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.infoCard}>
                <InfoRow icon="business-outline" label="Department" value={employee.department_name} />
                <InfoRow icon="shield-outline" label="Role" value={employee.role || 'employee'} />
              </View>
            )}
          </View>
        )}

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
            <View style={styles.leaveHeaderRow}>
              <Text style={styles.sectionTitle}>Leave Balance</Text>
              {canEditLeaveBalance && (
                <TouchableOpacity
                  style={styles.editBalanceButton}
                  onPress={() => {
                    setEditingLeaveBalance((current) => !current);
                    setEditableLeaveBalance(
                      Object.fromEntries(
                        leaveEntries.map(([typeId, balance]) => [typeId, String(balance)])
                      )
                    );
                  }}
                >
                  <Text style={styles.editBalanceButtonText}>
                    {editingLeaveBalance ? 'Cancel' : 'Edit'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {editingLeaveBalance ? (
              <View style={styles.infoCard}>
                {leaveEntries.map(([typeId]) => (
                  <View key={typeId} style={styles.balanceInputRow}>
                    <Text style={styles.balanceInputLabel}>{leaveTypeMap[typeId] || 'Leave'}</Text>
                    <TextInput
                      style={styles.balanceInput}
                      value={editableLeaveBalance[typeId] ?? '0'}
                      onChangeText={(value) =>
                        setEditableLeaveBalance((current) => ({
                          ...current,
                          [typeId]: value,
                        }))
                      }
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.saveBalanceButton, savingLeaveBalance && styles.saveBalanceButtonDisabled]}
                  onPress={handleSaveLeaveBalance}
                  disabled={savingLeaveBalance}
                >
                  <Text style={styles.saveBalanceButtonText}>
                    {savingLeaveBalance ? 'Saving...' : 'Save Leave Balance'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
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
            )}
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
  leaveHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  editBalanceButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
  },
  editBalanceButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
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
  balanceInputRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  balanceInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  balanceInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  selectButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectButtonText: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingRight: 8,
  },
  dropdownMenu: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  dropdownItemRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemLabel: {
    fontSize: 14,
    color: '#1E293B',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  roleButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  roleButtonActive: {
    backgroundColor: '#2563EB',
  },
  roleButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
  },
  passwordField: {
    flex: 1,
    minHeight: 46,
    fontSize: 15,
    color: '#1E293B',
  },
  saveBalanceButton: {
    margin: 12,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    paddingVertical: 13,
  },
  saveBalanceButtonDisabled: {
    opacity: 0.7,
  },
  saveBalanceButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
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
