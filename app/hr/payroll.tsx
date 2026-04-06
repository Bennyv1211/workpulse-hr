import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const RAW_API_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  job_title?: string;
  department_name?: string;
  hourly_rate?: number | null;
  salary?: number | null;
  employment_type?: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name?: string;
  date: string;
  clock_in?: string;
  clock_out?: string;
  total_hours?: number | null;
  status?: string;
}

interface PayrollPreview {
  employee: Employee;
  hoursWorked: number;
  baseRate: number;
  basicSalary: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimePay: number;
  bonus: number;
  deductions: number;
  tax: number;
  benefitsDeduction: number;
  grossPay: number;
  netPay: number;
}

type DraftMap = Record<
  string,
  {
    bonus: string;
    deductions: string;
    tax: string;
    benefits: string;
    overtimeRate: string;
  }
>;

export default function HRPayrollScreen() {
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [periodStart, setPeriodStart] = useState(getFirstDayOfCurrentMonth());
  const [periodEnd, setPeriodEnd] = useState(getToday());
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showPayrollModal, setShowPayrollModal] = useState(false);
  const [creatingPayroll, setCreatingPayroll] = useState(false);

  const [drafts, setDrafts] = useState<DraftMap>({});

  function getToday() {
    return new Date().toISOString().split('T')[0];
  }

  function getFirstDayOfCurrentMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
  }

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
  };

  const loadData = async () => {
    try {
      const [employeeData, attendanceData] = await Promise.all([
        apiRequest('/api/employees'),
        apiRequest(`/api/attendance?start_date=${periodStart}&end_date=${periodEnd}`),
      ]);

      setEmployees(Array.isArray(employeeData) ? employeeData : []);
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
    } catch (error: any) {
      console.log('Payroll page load error:', error);
      Alert.alert('Error', error.message || 'Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [periodStart, periodEnd]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [periodStart, periodEnd]);

  const attendanceByEmployee = useMemo(() => {
    const map: Record<string, AttendanceRecord[]> = {};
    for (const row of attendance) {
      if (!row.employee_id) continue;
      if (!map[row.employee_id]) map[row.employee_id] = [];
      map[row.employee_id].push(row);
    }
    return map;
  }, [attendance]);

  const payrollRows = useMemo(() => {
    return employees.map((emp) => {
      const rows = attendanceByEmployee[emp.id] || [];
      const totalHours = rows.reduce((sum, row) => sum + Number(row.total_hours || 0), 0);

      const hourlyRate = Number(emp.hourly_rate || 0);
      const monthlySalary = Number(emp.salary || 0);

      let baseRate = 0;
      let basicSalary = 0;

      if (hourlyRate > 0) {
        baseRate = hourlyRate;
        basicSalary = totalHours * hourlyRate;
      } else if (monthlySalary > 0) {
        baseRate = monthlySalary / 160;
        basicSalary = totalHours * baseRate;
      }

      const overtimeHours = Math.max(0, totalHours - 160);
      const defaultDraft = drafts[emp.id] || {
        bonus: '0',
        deductions: '0',
        tax: '0',
        benefits: '0',
        overtimeRate: '1.5',
      };

      const overtimeRate = Number(defaultDraft.overtimeRate || 1.5);
      const bonus = Number(defaultDraft.bonus || 0);
      const deductions = Number(defaultDraft.deductions || 0);
      const tax = Number(defaultDraft.tax || 0);
      const benefitsDeduction = Number(defaultDraft.benefits || 0);

      const overtimePay = overtimeHours * baseRate * overtimeRate;
      const grossPay = basicSalary + overtimePay + bonus;
      const netPay = grossPay - deductions - tax - benefitsDeduction;

      return {
        employee: emp,
        hoursWorked: Number(totalHours.toFixed(2)),
        baseRate: Number(baseRate.toFixed(2)),
        basicSalary: Number(basicSalary.toFixed(2)),
        overtimeHours: Number(overtimeHours.toFixed(2)),
        overtimeRate,
        overtimePay: Number(overtimePay.toFixed(2)),
        bonus: Number(bonus.toFixed(2)),
        deductions: Number(deductions.toFixed(2)),
        tax: Number(tax.toFixed(2)),
        benefitsDeduction: Number(benefitsDeduction.toFixed(2)),
        grossPay: Number(grossPay.toFixed(2)),
        netPay: Number(netPay.toFixed(2)),
      } as PayrollPreview;
    });
  }, [employees, attendanceByEmployee, drafts]);

  const openPayrollEditor = (employee: Employee) => {
    if (!drafts[employee.id]) {
      setDrafts((prev) => ({
        ...prev,
        [employee.id]: {
          bonus: '0',
          deductions: '0',
          tax: '0',
          benefits: '0',
          overtimeRate: '1.5',
        },
      }));
    }
    setSelectedEmployee(employee);
    setShowPayrollModal(true);
  };

  const updateDraft = (
    employeeId: string,
    field: keyof DraftMap[string],
    value: string
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [employeeId]: {
        bonus: prev[employeeId]?.bonus ?? '0',
        deductions: prev[employeeId]?.deductions ?? '0',
        tax: prev[employeeId]?.tax ?? '0',
        benefits: prev[employeeId]?.benefits ?? '0',
        overtimeRate: prev[employeeId]?.overtimeRate ?? '1.5',
        ...prev[employeeId],
        [field]: value,
      },
    }));
  };

  const selectedPreview = useMemo(() => {
    if (!selectedEmployee) return null;
    return payrollRows.find((r) => r.employee.id === selectedEmployee.id) || null;
  }, [selectedEmployee, payrollRows]);

  const handleCreatePayroll = async () => {
    if (!selectedEmployee || !selectedPreview) return;

    if (periodEnd < periodStart) {
      Alert.alert('Invalid Period', 'Pay period end must be after pay period start.');
      return;
    }

    setCreatingPayroll(true);
    try {
      await apiRequest('/api/payroll', 'POST', {
        employee_id: selectedEmployee.id,
        pay_period_start: periodStart,
        pay_period_end: periodEnd,
        basic_salary: selectedPreview.basicSalary,
        overtime_hours: selectedPreview.overtimeHours,
        overtime_rate: selectedPreview.overtimeRate,
        bonus: selectedPreview.bonus,
        deductions: selectedPreview.deductions,
        tax: selectedPreview.tax,
        benefits_deduction: selectedPreview.benefitsDeduction,
        notes: `Generated from attendance for ${periodStart} to ${periodEnd}`,
      });

      setShowPayrollModal(false);
      setSelectedEmployee(null);
      Alert.alert('Success', 'Payroll created successfully.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create payroll');
    } finally {
      setCreatingPayroll(false);
    }
  };

  const renderPayrollRow = ({ item }: { item: PayrollPreview }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => openPayrollEditor(item.employee)}
    >
      <View style={styles.cardTop}>
        <View>
          <Text style={styles.name}>
            {item.employee.first_name} {item.employee.last_name}
          </Text>
          <Text style={styles.subText}>{item.employee.employee_id}</Text>
          {!!item.employee.job_title && (
            <Text style={styles.subText}>{item.employee.job_title}</Text>
          )}
        </View>

        <View style={styles.netPill}>
          <Text style={styles.netPillLabel}>Net</Text>
          <Text style={styles.netPillValue}>${item.netPay.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.hoursWorked.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statValue}>${item.baseRate.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Rate</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statValue}>${item.grossPay.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Gross</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.editButton}
        onPress={() => openPayrollEditor(item.employee)}
      >
        <Ionicons name="create-outline" size={16} color="#3B82F6" />
        <Text style={styles.editButtonText}>Review Payroll</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Payroll</Text>

        <TouchableOpacity onPress={() => router.push('/hr/paystubs')} style={styles.headerBtn}>
          <Ionicons name="document-text-outline" size={22} color="#1E293B" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterWrap}>
        <View style={styles.dateCard}>
          <Text style={styles.label}>Period Start</Text>
          <TextInput
            value={periodStart}
            onChangeText={setPeriodStart}
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
          />
        </View>

        <View style={styles.dateCard}>
          <Text style={styles.label}>Period End</Text>
          <TextInput
            value={periodEnd}
            onChangeText={setPeriodEnd}
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#94A3B8"
          />
        </View>
      </View>

      {payrollRows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="cash-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No payroll data yet</Text>
          <Text style={styles.emptyText}>
            Add employees and attendance records first.
          </Text>
        </View>
      ) : (
        <FlatList
          data={payrollRows}
          keyExtractor={(item) => item.employee.id}
          renderItem={renderPayrollRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <Modal visible={showPayrollModal} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowPayrollModal(false);
                setSelectedEmployee(null);
              }}
              style={styles.headerBtn}
            >
              <Ionicons name="close" size={24} color="#1E293B" />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>Review Payroll</Text>
            <View style={styles.headerBtn} />
          </View>

          <ScrollView contentContainerStyle={styles.modalContent}>
            {selectedPreview && selectedEmployee && (
              <>
                <Text style={styles.modalEmployeeName}>
                  {selectedEmployee.first_name} {selectedEmployee.last_name}
                </Text>
                <Text style={styles.modalEmployeeSub}>
                  {selectedEmployee.employee_id}
                </Text>

                <View style={styles.summaryCard}>
                  <SummaryRow label="Hours Worked" value={selectedPreview.hoursWorked.toFixed(2)} />
                  <SummaryRow label="Base Rate" value={`$${selectedPreview.baseRate.toFixed(2)}`} />
                  <SummaryRow label="Basic Pay" value={`$${selectedPreview.basicSalary.toFixed(2)}`} />
                  <SummaryRow
                    label="Overtime Hours"
                    value={selectedPreview.overtimeHours.toFixed(2)}
                  />
                </View>

                <Field
                  label="Overtime Rate Multiplier"
                  value={drafts[selectedEmployee.id]?.overtimeRate ?? '1.5'}
                  onChangeText={(v) => updateDraft(selectedEmployee.id, 'overtimeRate', v)}
                />

                <Field
                  label="Bonus"
                  value={drafts[selectedEmployee.id]?.bonus ?? '0'}
                  onChangeText={(v) => updateDraft(selectedEmployee.id, 'bonus', v)}
                />

                <Field
                  label="Deductions"
                  value={drafts[selectedEmployee.id]?.deductions ?? '0'}
                  onChangeText={(v) => updateDraft(selectedEmployee.id, 'deductions', v)}
                />

                <Field
                  label="Tax"
                  value={drafts[selectedEmployee.id]?.tax ?? '0'}
                  onChangeText={(v) => updateDraft(selectedEmployee.id, 'tax', v)}
                />

                <Field
                  label="Benefits Deduction"
                  value={drafts[selectedEmployee.id]?.benefits ?? '0'}
                  onChangeText={(v) => updateDraft(selectedEmployee.id, 'benefits', v)}
                />

                <View style={styles.totalCard}>
                  <SummaryRow
                    label="Overtime Pay"
                    value={`$${selectedPreview.overtimePay.toFixed(2)}`}
                    bold
                  />
                  <SummaryRow
                    label="Gross Pay"
                    value={`$${selectedPreview.grossPay.toFixed(2)}`}
                    bold
                  />
                  <SummaryRow
                    label="Net Pay"
                    value={`$${selectedPreview.netPay.toFixed(2)}`}
                    bold
                    large
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryAction, creatingPayroll && styles.disabledButton]}
                  onPress={handleCreatePayroll}
                  disabled={creatingPayroll}
                >
                  {creatingPayroll ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryActionText}>Save Payroll</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function SummaryRow({
  label,
  value,
  bold = false,
  large = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  large?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text
        style={[
          styles.summaryLabel,
          bold && styles.summaryLabelBold,
          large && styles.summaryLabelLarge,
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          bold && styles.summaryValueBold,
          large && styles.summaryValueLarge,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        style={styles.fieldInput}
        placeholder="0"
        placeholderTextColor="#94A3B8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    height: 60,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  filterWrap: {
    padding: 16,
    gap: 12,
  },
  dateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#F8FAFC',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  subText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  netPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  netPillLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  netPillValue: {
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '700',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  editButton: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    height: 60,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalContent: {
    padding: 16,
    paddingBottom: 28,
  },
  modalEmployeeName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalEmployeeSub: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  totalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1E293B',
  },
  summaryLabelBold: {
    fontWeight: '700',
    color: '#334155',
  },
  summaryValueBold: {
    fontWeight: '700',
    color: '#1E293B',
  },
  summaryLabelLarge: {
    fontSize: 16,
  },
  summaryValueLarge: {
    fontSize: 18,
    color: '#2563EB',
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  fieldInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#1E293B',
  },
  primaryAction: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.7,
  },
});