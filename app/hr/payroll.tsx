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
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
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
  leave_balance?: Record<string, number> | null;
  leave_balance_hours?: number | null;
  vacation_balance_hours?: number | null;
  sick_balance_hours?: number | null;
}

interface LeaveTypeOption {
  id: string;
  name: string;
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
  vacationBalanceHours: number;
  sickBalanceHours: number;
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
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  const getToken = async () => {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (authToken) return authToken;
    return await AsyncStorage.getItem('token');
  };

  const apiRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
    const token = await getToken();

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

  const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const formatMoney = (value: number) => `$${value.toFixed(2)}`;

  const getBalanceHoursForType = useCallback(
    (employee: Employee, typeName: string) => {
      const directField =
        typeName === 'Annual Leave'
          ? employee.vacation_balance_hours
          : typeName === 'Sick Leave'
            ? employee.sick_balance_hours
            : null;

      if (typeof directField === 'number' && !Number.isNaN(directField)) {
        return directField;
      }

      const leaveType = leaveTypes.find((item) => item.name === typeName);
      const rawDays =
        leaveType && employee.leave_balance
          ? Number(employee.leave_balance[leaveType.id] ?? 0)
          : 0;

      if (!Number.isNaN(rawDays) && rawDays > 0) {
        return rawDays * 8;
      }

      if (typeName === 'Annual Leave' && typeof employee.leave_balance_hours === 'number') {
        return employee.leave_balance_hours;
      }

      return 0;
    },
    [leaveTypes]
  );

  const loadData = async () => {
    try {
      if (!isValidDate(periodStart) || !isValidDate(periodEnd)) {
        throw new Error('Please use YYYY-MM-DD for the pay period dates.');
      }

      const [employeeData, attendanceData, leaveTypeData] = await Promise.all([
        apiRequest('/api/employees'),
        apiRequest(`/api/attendance?start_date=${periodStart}&end_date=${periodEnd}`),
        apiRequest('/api/leave-types'),
      ]);

      setEmployees(Array.isArray(employeeData) ? employeeData : []);
      setAttendance(Array.isArray(attendanceData) ? attendanceData : []);
      setLeaveTypes(Array.isArray(leaveTypeData) ? leaveTypeData : []);
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
      const salaryValue = Number(emp.salary || 0);

      let baseRate = 0;
      let basicSalary = 0;

      if (hourlyRate > 0) {
        baseRate = hourlyRate;
        basicSalary = totalHours * hourlyRate;
      } else if (salaryValue > 0) {
        baseRate = salaryValue / 160;
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
        overtimeRate: Number(overtimeRate.toFixed(2)),
        overtimePay: Number(overtimePay.toFixed(2)),
        bonus: Number(bonus.toFixed(2)),
        deductions: Number(deductions.toFixed(2)),
        tax: Number(tax.toFixed(2)),
        benefitsDeduction: Number(benefitsDeduction.toFixed(2)),
        grossPay: Number(grossPay.toFixed(2)),
        netPay: Number(netPay.toFixed(2)),
        vacationBalanceHours: Number(getBalanceHoursForType(emp, 'Annual Leave')),
        sickBalanceHours: Number(getBalanceHoursForType(emp, 'Sick Leave')),
      } as PayrollPreview;
    });
  }, [employees, attendanceByEmployee, drafts, getBalanceHoursForType]);

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
    const sanitized = value.replace(/[^0-9.]/g, '');

    setDrafts((prev) => ({
      ...prev,
      [employeeId]: {
        ...(prev[employeeId] || {
          bonus: '0',
          deductions: '0',
          tax: '0',
          benefits: '0',
          overtimeRate: '1.5',
        }),
        [field]: sanitized,
      },
    }));
  };

  const selectedPreview = useMemo(() => {
    if (!selectedEmployee) return null;
    return payrollRows.find((r) => r.employee.id === selectedEmployee.id) || null;
  }, [selectedEmployee, payrollRows]);

  const handleCreatePayroll = async () => {
    if (!selectedEmployee || !selectedPreview) return;

    if (!isValidDate(periodStart) || !isValidDate(periodEnd)) {
      Alert.alert('Invalid Period', 'Please use YYYY-MM-DD for the pay period dates.');
      return;
    }

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

  const handleExportExcel = async () => {
    if (!isValidDate(periodStart) || !isValidDate(periodEnd)) {
      Alert.alert('Invalid Period', 'Please use YYYY-MM-DD for the pay period dates.');
      return;
    }

    if (payrollRows.length === 0) {
      Alert.alert('Nothing to Export', 'There is no payroll data to export yet.');
      return;
    }

    try {
      setExporting(true);

      const exportRows = payrollRows.map((item) => ({
        employee_id: item.employee.employee_id,
        employee_name: `${item.employee.first_name} ${item.employee.last_name}`.trim(),
        email: item.employee.email || '',
        department: item.employee.department_name || '',
        job_title: item.employee.job_title || '',
        employment_type: item.employee.employment_type || '',
        period_start: periodStart,
        period_end: periodEnd,
        total_hours: item.hoursWorked,
        base_rate: item.baseRate,
        basic_pay: item.basicSalary,
        overtime_hours: item.overtimeHours,
        overtime_rate: item.overtimeRate,
        overtime_pay: item.overtimePay,
        bonus: item.bonus,
        deductions: item.deductions,
        tax: item.tax,
        benefits_deduction: item.benefitsDeduction,
        gross_pay: item.grossPay,
        net_pay: item.netPay,
        vacation_balance_hours: item.vacationBalanceHours,
        sick_balance_hours: item.sickBalanceHours,
      }));

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportRows);

      const columnWidths = [
        { wch: 14 },
        { wch: 22 },
        { wch: 28 },
        { wch: 16 },
        { wch: 20 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 10 },
        { wch: 18 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 16 },
      ];
      worksheet['!cols'] = columnWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payroll Export');

      const wbout = XLSX.write(workbook, {
        type: 'base64',
        bookType: 'xlsx',
      });

      const fileName = `payroll-export-${periodStart}-to-${periodEnd}.xlsx`;
      const cacheDirectory = FileSystemLegacy.cacheDirectory;
      if (!cacheDirectory) {
        throw new Error('Temporary file storage is not available on this device.');
      }

      const fileUri = `${cacheDirectory}${fileName}`;

      await FileSystemLegacy.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Exported', `Excel file saved to:\n${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Payroll Excel',
        UTI:
          Platform.OS === 'ios'
            ? 'org.openxmlformats.spreadsheetml.sheet'
            : undefined,
      });
    } catch (error: any) {
      console.log('Excel export error:', error);
      Alert.alert('Export Failed', error.message || 'Failed to export Excel file');
    } finally {
      setExporting(false);
    }
  };

  const renderPayrollRow = ({ item }: { item: PayrollPreview }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => openPayrollEditor(item.employee)}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardTextWrap}>
          <Text style={styles.name}>
            {item.employee.first_name} {item.employee.last_name}
          </Text>
          <Text style={styles.subText}>{item.employee.employee_id}</Text>
          {!!item.employee.job_title && (
            <Text style={styles.subText}>{item.employee.job_title}</Text>
          )}
          {!!item.employee.department_name && (
            <Text style={styles.subText}>{item.employee.department_name}</Text>
          )}
        </View>

        <View style={styles.netPill}>
          <Text style={styles.netPillLabel}>Net</Text>
          <Text style={styles.netPillValue}>{formatMoney(item.netPay)}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.hoursWorked.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Hours</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatMoney(item.baseRate)}</Text>
          <Text style={styles.statLabel}>Rate</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatMoney(item.grossPay)}</Text>
          <Text style={styles.statLabel}>Gross</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.vacationBalanceHours.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Vacation</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.sickBalanceHours.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Sick</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.overtimeHours.toFixed(2)}</Text>
          <Text style={styles.statLabel}>OT Hours</Text>
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

        <TouchableOpacity
          onPress={() => router.push('/hr/paystubs')}
          style={styles.headerBtn}
        >
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
            autoCapitalize="none"
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
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity
          style={[styles.exportButton, exporting && styles.disabledButton]}
          onPress={handleExportExcel}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={styles.exportButtonText}>Export Excel</Text>
            </>
          )}
        </TouchableOpacity>
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
                  <SummaryRow
                    label="Hours Worked"
                    value={selectedPreview.hoursWorked.toFixed(2)}
                  />
                  <SummaryRow
                    label="Base Rate"
                    value={formatMoney(selectedPreview.baseRate)}
                  />
                  <SummaryRow
                    label="Basic Pay"
                    value={formatMoney(selectedPreview.basicSalary)}
                  />
                  <SummaryRow
                    label="Overtime Hours"
                    value={selectedPreview.overtimeHours.toFixed(2)}
                  />
                  <SummaryRow
                    label="Vacation Balance"
                    value={`${selectedPreview.vacationBalanceHours.toFixed(1)}h`}
                  />
                  <SummaryRow
                    label="Sick Balance"
                    value={`${selectedPreview.sickBalanceHours.toFixed(1)}h`}
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
                    value={formatMoney(selectedPreview.overtimePay)}
                    bold
                  />
                  <SummaryRow
                    label="Gross Pay"
                    value={formatMoney(selectedPreview.grossPay)}
                    bold
                  />
                  <SummaryRow
                    label="Net Pay"
                    value={formatMoney(selectedPreview.netPay)}
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
  exportButton: {
    marginTop: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
  cardTextWrap: {
    flex: 1,
    paddingRight: 8,
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
    textAlign: 'center',
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
    flex: 1,
  },
  summaryValue: {
    fontSize: 14,
    color: '#1E293B',
    textAlign: 'right',
    flexShrink: 1,
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
