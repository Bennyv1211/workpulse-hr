import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

interface Department {
  id: string;
  name: string;
}

interface LeaveType {
  id: string;
  name: string;
  days_per_year: number;
}

type EmployeeRole = 'employee' | 'manager' | 'hr_admin';

type PayType = 'hourly' | 'salary';

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
  required?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  returnKeyType?: 'done' | 'next' | 'go' | 'search' | 'send';
  onFocus?: () => void;
};

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  required = false,
  autoCapitalize,
  returnKeyType = 'next',
  onFocus,
}: InputFieldProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        autoCapitalize={
          autoCapitalize ?? (keyboardType === 'email-address' ? 'none' : 'sentences')
        }
        autoCorrect={false}
        blurOnSubmit={false}
        returnKeyType={returnKeyType}
        onFocus={onFocus}
      />
    </View>
  );
}

export default function HREmployeeNewScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isImportingEmployees, setIsImportingEmployees] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [selectedRole, setSelectedRole] = useState<EmployeeRole>('employee');

  const [employeeId, setEmployeeId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [regularStartTime, setRegularStartTime] = useState('09:00');
  const [regularEndTime, setRegularEndTime] = useState('17:00');
  const [hourlyRate, setHourlyRate] = useState('');
  const [salary, setSalary] = useState('');
  const [payType, setPayType] = useState<PayType>('hourly');
  const [annualLeaveBalance, setAnnualLeaveBalance] = useState('10');
  const [sickLeaveBalance, setSickLeaveBalance] = useState('10');
  const [maternityLeaveBalance, setMaternityLeaveBalance] = useState('0');
  const [paternityLeaveBalance, setPaternityLeaveBalance] = useState('0');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showDateOfBirthPicker, setShowDateOfBirthPicker] = useState(false);

  const getToken = async () => {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (authToken) return authToken;
    return await AsyncStorage.getItem('token');
  };

  const apiRequest = useCallback(async (endpoint: string, method: string = 'GET', body?: any) => {
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
      data = { detail: raw || 'Request failed' };
    }

    if (!response.ok) {
      throw new Error(data?.detail || data?.message || 'Request failed');
    }

    return data;
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoadingDepartments(true);
      const data = await apiRequest('/api/departments');
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load departments');
    } finally {
      setLoadingDepartments(false);
    }
  }, [apiRequest]);

  const fetchLeaveTypes = useCallback(async () => {
    try {
      const data = await apiRequest('/api/leave-types');
      setLeaveTypes(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load leave types');
    }
  }, [apiRequest]);

  useEffect(() => {
    fetchDepartments();
    fetchLeaveTypes();
  }, [fetchDepartments, fetchLeaveTypes]);

  const isValidDateString = (value: string) => {
    if (!value.trim()) return true;
    return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
  };

  const formatDateForApi = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateForDisplay = (value: string) => {
    if (!value || !isValidDateString(value)) return 'Select date';
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    setStartDate(formatDateForApi(selectedDate));
  };

  const handleDateOfBirthChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDateOfBirthPicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    setDateOfBirth(formatDateForApi(selectedDate));
  };

  const parseBalanceInput = (value: string, fallback: number) => {
    if (!value.trim()) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : NaN;
  };

  const buildLeaveBalancePayload = () => {
    const annual = parseBalanceInput(annualLeaveBalance, 10);
    const sick = parseBalanceInput(sickLeaveBalance, 10);
    const maternity = parseBalanceInput(maternityLeaveBalance, 0);
    const paternity = parseBalanceInput(paternityLeaveBalance, 0);

    if ([annual, sick, maternity, paternity].some((value) => Number.isNaN(value))) {
      return null;
    }

    const leaveTypeMap = new Map(leaveTypes.map((type) => [type.name, type.id]));
    const leaveBalance: Record<string, number> = {};

    const annualId = leaveTypeMap.get('Annual Leave');
    const sickId = leaveTypeMap.get('Sick Leave');
    const maternityId = leaveTypeMap.get('Maternity Leave');
    const paternityId = leaveTypeMap.get('Paternity Leave');

    if (annualId) leaveBalance[annualId] = annual;
    if (sickId) leaveBalance[sickId] = sick;
    if (maternityId) leaveBalance[maternityId] = maternity;
    if (paternityId) leaveBalance[paternityId] = paternity;

    return leaveBalance;
  };

  const findDepartmentIdByName = (name: string) => {
    const normalized = name.trim().toLowerCase();
    return (
      departments.find((dept) => dept.name.trim().toLowerCase() === normalized)?.id || null
    );
  };

  const normalizeImportedRole = (value?: string): EmployeeRole => {
    const normalized = (value || 'employee').trim().toLowerCase();
    if (normalized === 'manager') return 'manager';
    if (normalized === 'hr_admin' || normalized === 'hr admin' || normalized === 'hr') {
      return 'hr_admin';
    }
    return 'employee';
  };

  const normalizeImportedPayType = (value?: string): PayType => {
    const normalized = (value || 'hourly').trim().toLowerCase();
    if (normalized === 'salary' || normalized === 'salaried' || normalized === 'annual') {
      return 'salary';
    }
    return 'hourly';
  };

  const getTemplateWorkbook = () => {
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
        pay_type: 'hourly',
        hourly_rate: 25,
        annual_salary: '',
        regular_start_time: '09:00',
        regular_end_time: '17:00',
        temporary_password: 'Temp123!',
        annual_leave_days: 10,
        sick_leave_days: 10,
        maternity_leave_days: 0,
        paternity_leave_days: 0,
      },
    ];

    const instructionsRows = [
      {
        field: 'employee_id',
        required: 'yes',
        description: 'Unique employee number like EMP001',
      },
      {
        field: 'department',
        required: 'yes',
        description: 'Must match an existing department name in the app',
      },
      {
        field: 'role',
        required: 'no',
        description: 'employee, manager, or hr_admin',
      },
      {
        field: 'pay_type',
        required: 'yes',
        description: 'hourly or salary',
      },
      {
        field: 'hourly_rate',
        required: 'conditional',
        description: 'Required when pay_type is hourly',
      },
      {
        field: 'annual_salary',
        required: 'conditional',
        description: 'Required when pay_type is salary',
      },
      {
        field: 'temporary_password',
        required: 'yes',
        description: 'At least 8 characters with uppercase, number, and special character',
      },
      {
        field: 'regular_start_time / regular_end_time',
        required: 'no',
        description: 'Use HH:MM 24-hour format like 09:00 and 17:00',
      },
      {
        field: 'start_date / date_of_birth',
        required: 'start_date yes',
        description: 'Use YYYY-MM-DD format',
      },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(templateRows),
      'Employees Template'
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(instructionsRows),
      'Instructions'
    );

    return workbook;
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      const workbook = getTemplateWorkbook();
      const wbout = XLSX.write(workbook, {
        type: 'base64',
        bookType: 'xlsx',
      });

      const cacheDirectory = FileSystemLegacy.cacheDirectory;
      if (!cacheDirectory) {
        throw new Error('Temporary file storage is not available on this device.');
      }

      const fileUri = `${cacheDirectory}employee-import-template.xlsx`;
      await FileSystemLegacy.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Template Saved', `Template saved to:\n${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Download Employee Import Template',
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });
    } catch (error: any) {
      Alert.alert('Template Error', error.message || 'Failed to create template');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleImportEmployees = async () => {
    if (!departments.length) {
      Alert.alert('Departments Missing', 'Load departments before importing employees.');
      return;
    }

    try {
      setIsImportingEmployees(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      const base64 = await FileSystemLegacy.readAsStringAsync(asset.uri, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });

      const workbook = XLSX.read(base64, { type: 'base64' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('No worksheet found in the selected file.');
      }

      const worksheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: '',
      });

      if (!rows.length) {
        throw new Error('The selected template is empty.');
      }

      const created: string[] = [];
      const failed: string[] = [];

      for (const [index, row] of rows.entries()) {
        const employeeNumber = String(row.employee_id || '').trim();
        const first = String(row.first_name || '').trim();
        const last = String(row.last_name || '').trim();
        const emailValue = String(row.email || '').trim().toLowerCase();
        const job = String(row.job_title || '').trim();
        const departmentValue = String(row.department || '').trim();
        const start = String(row.start_date || '').trim();
        const tempPassword = String(row.temporary_password || '').trim();
        const regularStart = String(row.regular_start_time || '09:00').trim();
        const regularEnd = String(row.regular_end_time || '17:00').trim();
        const payTypeValue = normalizeImportedPayType(String(row.pay_type || 'hourly'));
        const departmentLookupId = findDepartmentIdByName(departmentValue);

        if (
          !employeeNumber ||
          !first ||
          !last ||
          !emailValue ||
          !job ||
          !departmentLookupId ||
          !start ||
          !tempPassword
        ) {
          failed.push(`Row ${index + 2}: missing required fields or unknown department`);
          continue;
        }

        const hourlyRateValue = String(row.hourly_rate || '').trim();
        const annualSalaryValue = String(row.annual_salary || '').trim();

        if (payTypeValue === 'hourly' && (!hourlyRateValue || Number(hourlyRateValue) <= 0)) {
          failed.push(`Row ${index + 2}: invalid hourly rate`);
          continue;
        }

        if (payTypeValue === 'salary' && (!annualSalaryValue || Number(annualSalaryValue) <= 0)) {
          failed.push(`Row ${index + 2}: invalid annual salary`);
          continue;
        }

        const leaveTypeMap = new Map(leaveTypes.map((type) => [type.name, type.id]));
        const leaveBalance: Record<string, number> = {};
        const annualId = leaveTypeMap.get('Annual Leave');
        const sickId = leaveTypeMap.get('Sick Leave');
        const maternityId = leaveTypeMap.get('Maternity Leave');
        const paternityId = leaveTypeMap.get('Paternity Leave');

        if (annualId) leaveBalance[annualId] = Number(row.annual_leave_days || 10);
        if (sickId) leaveBalance[sickId] = Number(row.sick_leave_days || 10);
        if (maternityId) leaveBalance[maternityId] = Number(row.maternity_leave_days || 0);
        if (paternityId) leaveBalance[paternityId] = Number(row.paternity_leave_days || 0);

        const payload = {
          employee_id: employeeNumber,
          first_name: first,
          last_name: last,
          email: emailValue,
          role: normalizeImportedRole(String(row.role || 'employee')),
          temporary_password: tempPassword,
          phone: String(row.phone || '').trim() || null,
          job_title: job,
          department_id: departmentLookupId,
          employment_type: String(row.employment_type || 'Full-time').trim() || 'Full-time',
          start_date: start,
          date_of_birth: String(row.date_of_birth || '').trim() || null,
          regular_start_time: regularStart || null,
          regular_end_time: regularEnd || null,
          hourly_rate: payTypeValue === 'hourly' ? Number(hourlyRateValue) : null,
          salary: payTypeValue === 'salary' ? Number(annualSalaryValue) : null,
          work_location: 'Office',
          country: 'USA',
          leave_balance: leaveBalance,
        };

        try {
          await apiRequest('/api/employees', 'POST', payload);
          created.push(`${employeeNumber} - ${first} ${last}`);
        } catch (error: any) {
          failed.push(`Row ${index + 2}: ${error.message || 'failed to create employee'}`);
        }
      }

      Alert.alert(
        'Import Complete',
        `Created: ${created.length}\nFailed: ${failed.length}${
          failed.length ? `\n\n${failed.slice(0, 6).join('\n')}` : ''
        }`
      );
    } catch (error: any) {
      Alert.alert('Import Error', error.message || 'Failed to import employee workbook');
    } finally {
      setIsImportingEmployees(false);
    }
  };

  const handleSaveEmployee = async () => {
    Keyboard.dismiss();
    setShowDepartmentDropdown(false);

    if (
      !employeeId.trim() ||
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !jobTitle.trim() ||
      !departmentId ||
      !startDate.trim()
    ) {
      Alert.alert('Missing Information', 'Please fill in all required fields.');
      return;
    }

    if (!isValidDateString(startDate)) {
      Alert.alert('Invalid Start Date', 'Please use YYYY-MM-DD for the start date.');
      return;
    }

    if (!isValidDateString(dateOfBirth)) {
      Alert.alert('Invalid Date of Birth', 'Please use YYYY-MM-DD for the date of birth.');
      return;
    }

    if (payType === 'hourly') {
      if (!hourlyRate.trim()) {
        Alert.alert('Missing Hourly Rate', 'Please enter an hourly rate.');
        return;
      }

      if (Number.isNaN(Number(hourlyRate)) || Number(hourlyRate) <= 0) {
        Alert.alert('Invalid Hourly Rate', 'Please enter a valid hourly rate.');
        return;
      }
    }

    if (payType === 'salary') {
      if (!salary.trim()) {
        Alert.alert('Missing Salary', 'Please enter a salary.');
        return;
      }

      if (Number.isNaN(Number(salary)) || Number(salary) <= 0) {
        Alert.alert('Invalid Salary', 'Please enter a valid annual salary.');
        return;
      }
    }

    if (!temporaryPassword.trim()) {
      Alert.alert('Missing Temporary Password', 'Please assign a temporary password for this account.');
      return;
    }

    if (temporaryPassword.trim().length < 8) {
      Alert.alert('Weak Temporary Password', 'Temporary password must be at least 8 characters.');
      return;
    }

    const leaveBalance = buildLeaveBalancePayload();
    if (!leaveBalance) {
      Alert.alert('Invalid Leave Balance', 'Please enter valid leave balance amounts.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        employee_id: employeeId.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        role: selectedRole,
        temporary_password: temporaryPassword.trim(),
        phone: phone.trim() || null,
        job_title: jobTitle.trim(),
        department_id: departmentId,
        employment_type: employmentType,
        start_date: startDate.trim(),
        date_of_birth: dateOfBirth.trim() || null,
        regular_start_time: regularStartTime.trim() || null,
        regular_end_time: regularEndTime.trim() || null,
        hourly_rate: payType === 'hourly' ? Number(hourlyRate) : null,
        salary: payType === 'salary' ? Number(salary) : null,
        work_location: 'Office',
        country: 'USA',
        leave_balance: leaveBalance,
      };

      await apiRequest('/api/employees', 'POST', payload);

      Alert.alert('Success', 'Employee created successfully.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create employee');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDepartment = (dept: Department) => {
    setDepartmentId(dept.id);
    setDepartmentName(dept.name);
    setShowDepartmentDropdown(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.flex}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Employee</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            onScrollBeginDrag={() => {
              Keyboard.dismiss();
              setShowDepartmentDropdown(false);
            }}
          >
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Bulk Employee Import</Text>
              <Text style={styles.bulkHelperText}>
                Download the Excel template, fill one employee per row, then upload it here to create multiple employees at once.
              </Text>

              <View style={styles.bulkActions}>
                <TouchableOpacity
                  style={[styles.bulkButton, isDownloadingTemplate && styles.saveButtonDisabled]}
                  onPress={handleDownloadTemplate}
                  disabled={isDownloadingTemplate || isImportingEmployees}
                >
                  {isDownloadingTemplate ? (
                    <ActivityIndicator color="#1D4ED8" />
                  ) : (
                    <>
                      <Ionicons name="download-outline" size={18} color="#1D4ED8" />
                      <Text style={styles.bulkButtonText}>Download Template</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.bulkPrimaryButton, isImportingEmployees && styles.saveButtonDisabled]}
                  onPress={handleImportEmployees}
                  disabled={isImportingEmployees || isDownloadingTemplate}
                >
                  {isImportingEmployees ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.bulkPrimaryButtonText}>Upload Excel</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Basic Information</Text>

              <InputField
                label="Employee Number"
                value={employeeId}
                onChangeText={setEmployeeId}
                placeholder="EMP001"
                required
                onFocus={() => setShowDepartmentDropdown(false)}
              />

                <InputField
                  label="First Name"
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  required
                  onFocus={() => setShowDepartmentDropdown(false)}
                />

                <InputField
                  label="Last Name"
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Smith"
                  required
                  onFocus={() => setShowDepartmentDropdown(false)}
                />

                <InputField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="john.smith@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  required
                  onFocus={() => setShowDepartmentDropdown(false)}
                />

                <InputField
                  label="Phone Number"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 555 123 4567"
                  keyboardType="phone-pad"
                  onFocus={() => setShowDepartmentDropdown(false)}
                />

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Date of Birth</Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowDepartmentDropdown(false);
                      setShowDateOfBirthPicker(true);
                    }}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#64748B" />
                    <Text style={[styles.dateButtonText, !dateOfBirth && styles.placeholderText]}>
                      {dateOfBirth ? formatDateForDisplay(dateOfBirth) : 'Select date of birth'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Start Date <Text style={styles.required}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.dateButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowDepartmentDropdown(false);
                      setShowStartDatePicker(true);
                    }}
                  >
                    <Ionicons name="calendar-outline" size={18} color="#64748B" />
                    <Text style={[styles.dateButtonText, !startDate && styles.placeholderText]}>
                      {startDate ? formatDateForDisplay(startDate) : 'Select start date'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.card, styles.dropdownSection]}>
                <Text style={styles.sectionTitle}>Work Information</Text>

                <InputField
                  label="Job Title"
                  value={jobTitle}
                  onChangeText={setJobTitle}
                  placeholder="Frontend Developer"
                  required
                  onFocus={() => setShowDepartmentDropdown(false)}
                />

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Department <Text style={styles.required}>*</Text>
                  </Text>

                  {loadingDepartments ? (
                    <View style={styles.dropdownButton}>
                      <ActivityIndicator size="small" color="#3B82F6" />
                    </View>
                  ) : (
                    <View style={styles.dropdownWrap}>
                      <TouchableOpacity
                        style={styles.dropdownButton}
                        activeOpacity={0.8}
                        onPress={() => {
                          Keyboard.dismiss();
                          setShowDepartmentDropdown((prev) => !prev);
                        }}
                      >
                        <Text
                          style={[
                            styles.dropdownText,
                            !departmentName && styles.placeholderText,
                          ]}
                        >
                          {departmentName || 'Select department'}
                        </Text>
                        <Ionicons
                          name={showDepartmentDropdown ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color="#64748B"
                        />
                      </TouchableOpacity>

                      {showDepartmentDropdown && (
                        <View style={styles.dropdownMenu}>
                          {departments.length === 0 ? (
                            <View style={styles.dropdownItem}>
                              <Text style={styles.placeholderText}>No departments found</Text>
                            </View>
                          ) : (
                            departments.map((dept, index) => (
                              <TouchableOpacity
                                key={dept.id}
                                style={[
                                  styles.dropdownItem,
                                  index === departments.length - 1 && styles.dropdownItemLast,
                                ]}
                                onPress={() => handleSelectDepartment(dept)}
                              >
                                <Text style={styles.dropdownItemText}>{dept.name}</Text>
                              </TouchableOpacity>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Account Role</Text>
                  <View style={styles.rowButtons}>
                    {[
                      { id: 'employee', label: 'Employee' },
                      { id: 'manager', label: 'Manager' },
                      { id: 'hr_admin', label: 'HR Admin' },
                    ].map((role) => (
                      <TouchableOpacity
                        key={role.id}
                        style={[
                          styles.optionButton,
                          selectedRole === role.id && styles.optionButtonActive,
                        ]}
                        onPress={() => setSelectedRole(role.id as EmployeeRole)}
                      >
                        <Text
                          style={[
                            styles.optionButtonText,
                            selectedRole === role.id && styles.optionButtonTextActive,
                          ]}
                        >
                          {role.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Employment Type</Text>
                  <View style={styles.rowButtons}>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        employmentType === 'Full-time' && styles.optionButtonActive,
                      ]}
                      onPress={() => setEmploymentType('Full-time')}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          employmentType === 'Full-time' && styles.optionButtonTextActive,
                        ]}
                      >
                        Full-time
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        employmentType === 'Part-time' && styles.optionButtonActive,
                      ]}
                      onPress={() => setEmploymentType('Part-time')}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          employmentType === 'Part-time' && styles.optionButtonTextActive,
                        ]}
                      >
                        Part-time
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <InputField
                  label="Regular Start Time"
                  value={regularStartTime}
                  onChangeText={setRegularStartTime}
                  placeholder="09:00"
                  onFocus={() => setShowDepartmentDropdown(false)}
                />

                <InputField
                  label="Regular End Time"
                  value={regularEndTime}
                  onChangeText={setRegularEndTime}
                  placeholder="17:00"
                  onFocus={() => setShowDepartmentDropdown(false)}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Pay Information</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Pay Type</Text>
                  <View style={styles.rowButtons}>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        payType === 'hourly' && styles.optionButtonActive,
                      ]}
                      onPress={() => setPayType('hourly')}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          payType === 'hourly' && styles.optionButtonTextActive,
                        ]}
                      >
                        Hourly
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        payType === 'salary' && styles.optionButtonActive,
                      ]}
                      onPress={() => setPayType('salary')}
                    >
                      <Text
                        style={[
                          styles.optionButtonText,
                          payType === 'salary' && styles.optionButtonTextActive,
                        ]}
                      >
                        Salaried
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {payType === 'hourly' ? (
                  <InputField
                    label="Hourly Rate"
                    value={hourlyRate}
                    onChangeText={setHourlyRate}
                    placeholder="25"
                    keyboardType="numeric"
                    required
                    returnKeyType="done"
                    onFocus={() => setShowDepartmentDropdown(false)}
                  />
                ) : (
                  <InputField
                    label="Annual Salary"
                    value={salary}
                    onChangeText={setSalary}
                    placeholder="60000"
                    keyboardType="numeric"
                    required
                    returnKeyType="done"
                    onFocus={() => setShowDepartmentDropdown(false)}
                  />
                )}
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Leave Balances</Text>

                <InputField
                  label="Annual Leave Days"
                  value={annualLeaveBalance}
                  onChangeText={setAnnualLeaveBalance}
                  placeholder="10"
                  keyboardType="numeric"
                  onFocus={() => setShowDepartmentDropdown(false)}
                />

                <InputField
                  label="Sick Leave Days"
                  value={sickLeaveBalance}
                  onChangeText={setSickLeaveBalance}
                  placeholder="10"
                  keyboardType="numeric"
                  onFocus={() => setShowDepartmentDropdown(false)}
                />

                <InputField
                  label="Maternity Leave Days"
                  value={maternityLeaveBalance}
                  onChangeText={setMaternityLeaveBalance}
                  placeholder="0"
                  keyboardType="numeric"
                  onFocus={() => setShowDepartmentDropdown(false)}
                />

                <InputField
                  label="Paternity Leave Days"
                  value={paternityLeaveBalance}
                  onChangeText={setPaternityLeaveBalance}
                  placeholder="0"
                  keyboardType="numeric"
                  onFocus={() => setShowDepartmentDropdown(false)}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Account Setup</Text>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>
                    Temporary Password <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      value={temporaryPassword}
                      onChangeText={setTemporaryPassword}
                      placeholder="Set a temporary password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showTemporaryPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity onPress={() => setShowTemporaryPassword((current) => !current)}>
                      <Ionicons
                        name={showTemporaryPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={20}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.helperText}>
                    The employee can change this password later from the profile dashboard.
                  </Text>
                </View>
              </View>

            <TouchableOpacity
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
              onPress={handleSaveEmployee}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="save-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Save Employee</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 30 }} />
          </ScrollView>

          {showStartDatePicker && (
            <DateTimePicker
              value={startDate ? new Date(`${startDate}T00:00:00`) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleStartDateChange}
            />
          )}

          {showDateOfBirthPicker && (
            <DateTimePicker
              value={dateOfBirth ? new Date(`${dateOfBirth}T00:00:00`) : new Date()}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleDateOfBirthChange}
              maximumDate={new Date()}
            />
          )}
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    zIndex: 20,
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
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  bulkHelperText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 14,
  },
  bulkActions: {
    gap: 12,
  },
  bulkButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bulkButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  bulkPrimaryButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#1D4ED8',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bulkPrimaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dropdownSection: {
    zIndex: 50,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1E293B',
  },
  dateButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#1E293B',
    marginLeft: 10,
  },
  dropdownWrap: {
    position: 'relative',
    zIndex: 100,
  },
  dropdownButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    fontSize: 16,
    color: '#1E293B',
    flex: 1,
    paddingRight: 8,
  },
  placeholderText: {
    color: '#94A3B8',
  },
  dropdownMenu: {
    marginTop: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#1E293B',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  optionButtonTextActive: {
    color: '#1D4ED8',
  },
  passwordContainer: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#1E293B',
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  saveButton: {
    marginTop: 8,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
