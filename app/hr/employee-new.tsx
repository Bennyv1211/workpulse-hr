import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
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

interface Department {
  id: string;
  name: string;
}

export default function HREmployeeNewScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [employmentType, setEmploymentType] = useState('Full-time');

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
  const [hourlyRate, setHourlyRate] = useState('');
  const [salary, setSalary] = useState('');
  const [payType, setPayType] = useState<'hourly' | 'salary'>('hourly');

  useEffect(() => {
    fetchDepartments();
  }, []);

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
      data = { detail: raw || 'Request failed' };
    }

    if (!response.ok) {
      throw new Error(data?.detail || 'Request failed');
    }

    return data;
  };

  const fetchDepartments = async () => {
    try {
      const data = await apiRequest('/api/departments');
      setDepartments(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load departments');
    } finally {
      setLoadingDepartments(false);
    }
  };

  const handleSaveEmployee = async () => {
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

    if (payType === 'hourly' && !hourlyRate.trim()) {
      Alert.alert('Missing Hourly Rate', 'Please enter an hourly rate.');
      return;
    }

    if (payType === 'salary' && !salary.trim()) {
      Alert.alert('Missing Salary', 'Please enter a salary.');
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        employee_id: employeeId.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        job_title: jobTitle.trim(),
        department_id: departmentId,
        employment_type: employmentType,
        start_date: startDate.trim(),
        date_of_birth: dateOfBirth.trim() || null,
        hourly_rate: payType === 'hourly' ? Number(hourlyRate) : null,
        salary: payType === 'salary' ? Number(salary) : null,
        work_location: 'Office',
        country: 'USA',
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

  const InputField = ({
    label,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    required = false,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    placeholder: string;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    required?: boolean;
  }) => (
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
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Employee</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <InputField
            label="Employee Number"
            value={employeeId}
            onChangeText={setEmployeeId}
            placeholder="EMP001"
            required
          />

          <InputField
            label="First Name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="John"
            required
          />

          <InputField
            label="Last Name"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Smith"
            required
          />

          <InputField
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="john.smith@company.com"
            keyboardType="email-address"
            required
          />

          <InputField
            label="Phone Number"
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 555 123 4567"
            keyboardType="phone-pad"
          />

          <InputField
            label="Date of Birth"
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD"
          />

          <InputField
            label="Start Date"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            required
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Work Information</Text>

          <InputField
            label="Job Title"
            value={jobTitle}
            onChangeText={setJobTitle}
            placeholder="Frontend Developer"
            required
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
              <>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowDepartmentDropdown(!showDepartmentDropdown)}
                >
                  <Text style={[styles.dropdownText, !departmentName && styles.placeholderText]}>
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
                    {departments.map((dept) => (
                      <TouchableOpacity
                        key={dept.id}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setDepartmentId(dept.id);
                          setDepartmentName(dept.name);
                          setShowDepartmentDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{dept.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Employment Type</Text>
            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.optionButton, employmentType === 'Full-time' && styles.optionButtonActive]}
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
                style={[styles.optionButton, employmentType === 'Part-time' && styles.optionButtonActive]}
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
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pay Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pay Type</Text>
            <View style={styles.rowButtons}>
              <TouchableOpacity
                style={[styles.optionButton, payType === 'hourly' && styles.optionButtonActive]}
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
                style={[styles.optionButton, payType === 'salary' && styles.optionButtonActive]}
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
            />
          ) : (
            <InputField
              label="Annual Salary"
              value={salary}
              onChangeText={setSalary}
              placeholder="60000"
              keyboardType="numeric"
              required
            />
          )}
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSaveEmployee}
          disabled={isLoading}
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