import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = 8000;
const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 === 0 ? '00' : '30';
  return `${`${hour}`.padStart(2, '0')}:${minute}`;
});
const WEEKDAYS = [
  { value: 0, label: 'Mon' },
  { value: 1, label: 'Tue' },
  { value: 2, label: 'Wed' },
  { value: 3, label: 'Thu' },
  { value: 4, label: 'Fri' },
  { value: 5, label: 'Sat' },
  { value: 6, label: 'Sun' },
];

type EmployeeOption = {
  id: string;
  first_name: string;
  last_name: string;
  employee_id?: string;
  department_name?: string;
};

type DepartmentOption = {
  id: string;
  name: string;
};

type ScheduleRow = {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  total_hours?: number;
  notes?: string | null;
};

type PickerMode = 'employee' | 'department' | 'start' | 'end' | null;

function getWeekStart(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function formatIso(date: Date) {
  return date.toISOString().split('T')[0];
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function hoursBetween(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const total = (eh * 60 + em - (sh * 60 + sm)) / 60;
  return total > 0 ? total : 0;
}

export default function ManagerSchedulesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [mode, setMode] = useState<'employee' | 'department'>('employee');
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([0, 1, 2, 3, 4]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [notes, setNotes] = useState('');

  const weekStart = useMemo(() => getWeekStart(weekOffset), [weekOffset]);
  const weekStartIso = useMemo(() => formatIso(weekStart), [weekStart]);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        return {
          index,
          iso: formatIso(date),
          label: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        };
      }),
    [weekStart]
  );

  const selectedEmployee = employees.find((item) => item.id === selectedEmployeeId);
  const selectedDepartment = departments.find((item) => item.id === selectedDepartmentId);

  const groupedSchedules = useMemo(() => {
    const grouped = new Map<string, { name: string; total: number; items: ScheduleRow[] }>();
    schedules.forEach((row) => {
      const current = grouped.get(row.employee_id) || {
        name: row.employee_name || 'Employee',
        total: 0,
        items: [],
      };
      current.total += Number(row.total_hours || 0);
      current.items.push(row);
      grouped.set(row.employee_id, current);
    });
    return Array.from(grouped.entries()).map(([employeeId, value]) => ({
      employeeId,
      ...value,
      items: value.items.sort((left, right) => left.date.localeCompare(right.date)),
    }));
  }, [schedules]);

  const getToken = useCallback(async () => {
    const authToken = await AsyncStorage.getItem('auth_token');
    return authToken || (await AsyncStorage.getItem('token'));
  }, []);

  const apiRequest = useCallback(async (endpoint: string, method = 'GET', body?: any) => {
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
      const data = raw ? JSON.parse(raw) : null;
      if (!response.ok) throw new Error(data?.detail || 'Request failed');
      return data;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new Error('Request timed out');
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }, [getToken]);

  const loadData = useCallback(async () => {
    try {
      const [employeeData, departmentData, scheduleData] = await Promise.all([
        apiRequest('/api/employees?status=active'),
        apiRequest('/api/departments'),
        apiRequest(`/api/schedule/week/${weekStartIso}`),
      ]);
      const nextEmployees = Array.isArray(employeeData) ? employeeData : [];
      const nextDepartments = Array.isArray(departmentData) ? departmentData : [];
      setEmployees(nextEmployees);
      setDepartments(nextDepartments);
      setSchedules(Array.isArray(scheduleData) ? scheduleData : []);
      if (!selectedEmployeeId && nextEmployees[0]?.id) setSelectedEmployeeId(nextEmployees[0].id);
      if (!selectedDepartmentId && nextDepartments[0]?.id) setSelectedDepartmentId(nextDepartments[0].id);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to load schedule data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiRequest, selectedDepartmentId, selectedEmployeeId, weekStartIso]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const saveEmployeeSchedule = async () => {
    if (!selectedEmployeeId) {
      Alert.alert('Missing Employee', 'Choose an employee first.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/api/schedule/create', 'POST', {
        employee_id: selectedEmployeeId,
        date: weekDays[selectedDayIndex].iso,
        start_time: startTime,
        end_time: endTime,
        notes: notes.trim() || undefined,
      });
      await loadData();
      Alert.alert('Schedule Sent', 'This shift is now available in the employee schedule tab.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to save employee schedule');
    } finally {
      setSaving(false);
    }
  };

  const applyDepartmentSchedule = async () => {
    if (!selectedDepartmentId) {
      Alert.alert('Missing Department', 'Choose a department first.');
      return;
    }
    if (!selectedWeekdays.length) {
      Alert.alert('Missing Days', 'Choose at least one weekday.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/api/schedule/department/apply', 'POST', {
        department_id: selectedDepartmentId,
        week_start_date: weekStartIso,
        start_time: startTime,
        end_time: endTime,
        weekdays: selectedWeekdays,
        notes: notes.trim() || undefined,
      });
      await loadData();
      Alert.alert('Department Schedule Sent', 'The team schedule was applied for this week.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to apply department schedule');
    } finally {
      setSaving(false);
    }
  };

  const copyPreviousWeek = async () => {
    setCopying(true);
    try {
      const previousWeek = formatIso(addDays(weekStart, -7));
      const previousRows = await apiRequest(`/api/schedule/week/${previousWeek}`);
      if (!Array.isArray(previousRows) || !previousRows.length) {
        Alert.alert('Nothing to Copy', 'There are no schedule rows in the previous week.');
        return;
      }
      for (const row of previousRows) {
        await apiRequest('/api/schedule/create', 'POST', {
          employee_id: row.employee_id,
          date: formatIso(addDays(new Date(`${row.date}T00:00:00`), 7)),
          start_time: row.start_time,
          end_time: row.end_time,
          notes: row.notes || undefined,
        });
      }
      await loadData();
      Alert.alert('Copied', 'Last week was copied into this week.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Unable to copy the previous week');
    } finally {
      setCopying(false);
    }
  };

  const loadScheduleIntoEditor = (row: ScheduleRow) => {
    const dayIndex = weekDays.findIndex((item) => item.iso === row.date);
    setMode('employee');
    setSelectedEmployeeId(row.employee_id);
    setSelectedDayIndex(dayIndex >= 0 ? dayIndex : 0);
    setStartTime(row.start_time || '09:00');
    setEndTime(row.end_time || '17:00');
    setNotes(row.notes || '');
  };

  const renderPickerOptions = () => {
    const list =
      pickerMode === 'employee'
        ? employees.map((item) => ({
            key: item.id,
            title: `${item.first_name} ${item.last_name}`,
            subtitle: `${item.employee_id || 'No ID'}${item.department_name ? `  |  ${item.department_name}` : ''}`,
            onPress: () => setSelectedEmployeeId(item.id),
          }))
        : pickerMode === 'department'
          ? departments.map((item) => ({
              key: item.id,
              title: item.name,
              subtitle: '',
              onPress: () => setSelectedDepartmentId(item.id),
            }))
          : TIME_OPTIONS.map((item) => ({
              key: item,
              title: item,
              subtitle: '',
              onPress: () => (pickerMode === 'start' ? setStartTime(item) : setEndTime(item)),
            }));

    return (
      <ScrollView>
        <View style={pickerMode === 'start' || pickerMode === 'end' ? styles.timeGrid : undefined}>
          {list.map((item) => (
            <TouchableOpacity
              key={item.key}
              style={pickerMode === 'start' || pickerMode === 'end' ? styles.timeOption : styles.optionRow}
              onPress={() => {
                item.onPress();
                setPickerMode(null);
              }}
            >
              <Text style={styles.optionTitle}>{item.title}</Text>
              {!!item.subtitle && <Text style={styles.optionSubtitle}>{item.subtitle}</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}><ActivityIndicator size="large" color="#2563EB" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title}>Schedule Team</Text>
            <Text style={styles.subtitle}>Assign shifts to one employee or your whole department.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>Week Starting</Text>
          <Text style={styles.weekValue}>{weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
          <View style={styles.weekActions}>
            <TouchableOpacity style={styles.weekButton} onPress={() => setWeekOffset((value) => value - 1)}><Text style={styles.weekButtonText}>Prev</Text></TouchableOpacity>
            <TouchableOpacity style={styles.weekButton} onPress={() => setWeekOffset((value) => value + 1)}><Text style={styles.weekButtonText}>Next</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.copyButton, copying && styles.disabled]} onPress={copyPreviousWeek} disabled={copying}>
              <Text style={styles.copyButtonText}>{copying ? 'Copying...' : 'Copy Last Week'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modeRow}>
          <TouchableOpacity style={[styles.modeButton, mode === 'employee' && styles.modeButtonActive]} onPress={() => setMode('employee')}><Text style={[styles.modeText, mode === 'employee' && styles.modeTextActive]}>Single Employee</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modeButton, mode === 'department' && styles.modeButtonActive]} onPress={() => setMode('department')}><Text style={[styles.modeText, mode === 'department' && styles.modeTextActive]}>Department</Text></TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{mode === 'employee' ? 'Send one employee shift' : 'Send department pattern'}</Text>

          {mode === 'employee' ? (
            <>
              <Text style={styles.label}>Employee</Text>
              <TouchableOpacity style={styles.select} onPress={() => setPickerMode('employee')}>
                <View>
                  <Text style={styles.selectTitle}>{selectedEmployee ? `${selectedEmployee.first_name} ${selectedEmployee.last_name}` : 'Choose employee'}</Text>
                  {!!selectedEmployee && <Text style={styles.selectSubtitle}>{selectedEmployee.employee_id || 'No ID'}{selectedEmployee.department_name ? `  |  ${selectedEmployee.department_name}` : ''}</Text>}
                </View>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>

              <Text style={styles.label}>Day</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayRow}>
                {weekDays.map((day) => (
                  <TouchableOpacity key={day.iso} style={[styles.dayChip, selectedDayIndex === day.index && styles.dayChipActive]} onPress={() => setSelectedDayIndex(day.index)}>
                    <Text style={[styles.dayChipText, selectedDayIndex === day.index && styles.dayChipTextActive]}>{day.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : (
            <>
              <Text style={styles.label}>Department</Text>
              <TouchableOpacity style={styles.select} onPress={() => setPickerMode('department')}>
                <Text style={styles.selectTitle}>{selectedDepartment?.name || 'Choose department'}</Text>
                <Ionicons name="chevron-down" size={18} color="#64748B" />
              </TouchableOpacity>

              <Text style={styles.label}>Repeat On</Text>
              <View style={styles.weekdayWrap}>
                {WEEKDAYS.map((day) => {
                  const selected = selectedWeekdays.includes(day.value);
                  return (
                    <TouchableOpacity key={day.value} style={[styles.weekdayChip, selected && styles.weekdayChipActive]} onPress={() => setSelectedWeekdays((current) => current.includes(day.value) ? current.filter((item) => item !== day.value) : [...current, day.value].sort((a, b) => a - b))}>
                      <Text style={[styles.weekdayText, selected && styles.weekdayTextActive]}>{day.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>Start</Text>
              <TouchableOpacity style={styles.select} onPress={() => setPickerMode('start')}>
                <Text style={styles.selectTitle}>{startTime}</Text>
                <Ionicons name="time-outline" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>End</Text>
              <TouchableOpacity style={styles.select} onPress={() => setPickerMode('end')}>
                <Text style={styles.selectTitle}>{endTime}</Text>
                <Ionicons name="time-outline" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.banner}>
            <Text style={styles.bannerLabel}>Hours</Text>
            <Text style={styles.bannerValue}>{hoursBetween(startTime, endTime).toFixed(1)}h</Text>
          </View>

          <Text style={styles.label}>Note</Text>
          <TextInput style={styles.notes} placeholder="Optional shift note" placeholderTextColor="#94A3B8" value={notes} onChangeText={setNotes} multiline />

          <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} disabled={saving} onPress={mode === 'employee' ? saveEmployeeSchedule : applyDepartmentSchedule}>
            <Text style={styles.primaryButtonText}>{saving ? 'Saving...' : mode === 'employee' ? 'Send to Employee' : 'Send to Department'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Current Week Schedule</Text>
          {groupedSchedules.length === 0 ? (
            <Text style={styles.emptyText}>No schedules have been assigned for this week yet.</Text>
          ) : (
            groupedSchedules.map((group) => (
              <View key={group.employeeId} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupHours}>{group.total.toFixed(1)}h</Text>
                </View>
                {group.items.map((item) => (
                  <TouchableOpacity key={item.id} style={styles.groupRow} activeOpacity={0.82} onPress={() => loadScheduleIntoEditor(item)}>
                    <View>
                      <Text style={styles.groupDate}>{new Date(`${item.date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</Text>
                      {!!item.notes && <Text style={styles.groupNote}>{item.notes}</Text>}
                      <Text style={styles.groupEditHint}>Tap to edit this shift</Text>
                    </View>
                    <Text style={styles.groupTime}>{item.start_time || 'Off'}{item.end_time ? ` - ${item.end_time}` : ''}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Modal visible={pickerMode !== null} animationType="slide" transparent onRequestClose={() => setPickerMode(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerMode === 'employee' ? 'Choose Employee' : pickerMode === 'department' ? 'Choose Department' : 'Choose Time'}</Text>
              <TouchableOpacity onPress={() => setPickerMode(null)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            {renderPickerOptions()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 36 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  headerTextWrap: { flex: 1 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { marginTop: 4, fontSize: 14, color: '#64748B' },
  card: { backgroundColor: '#FFF', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 18, marginBottom: 18 },
  eyebrow: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  weekValue: { marginTop: 6, fontSize: 22, fontWeight: '800', color: '#0F172A' },
  weekActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 16 },
  weekButton: { backgroundColor: '#DBEAFE', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  weekButtonText: { color: '#1D4ED8', fontWeight: '700' },
  copyButton: { backgroundColor: '#2563EB', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  copyButtonText: { color: '#FFF', fontWeight: '700' },
  disabled: { opacity: 0.7 },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  modeButton: { flex: 1, backgroundColor: '#E2E8F0', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
  modeButtonActive: { backgroundColor: '#DBEAFE' },
  modeText: { color: '#475569', fontWeight: '700' },
  modeTextActive: { color: '#1D4ED8' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  select: { minHeight: 56, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  selectTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  selectSubtitle: { marginTop: 4, fontSize: 12, color: '#64748B' },
  dayRow: { gap: 10, paddingBottom: 8 },
  dayChip: { borderRadius: 16, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#FFF' },
  dayChipActive: { borderColor: '#2563EB', backgroundColor: '#DBEAFE' },
  dayChipText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  dayChipTextActive: { color: '#1D4ED8' },
  weekdayWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  weekdayChip: { minWidth: 70, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' },
  weekdayChipActive: { borderColor: '#2563EB', backgroundColor: '#DBEAFE' },
  weekdayText: { color: '#475569', fontWeight: '700', fontSize: 13 },
  weekdayTextActive: { color: '#1D4ED8' },
  timeRow: { flexDirection: 'row', gap: 12 },
  timeField: { flex: 1 },
  banner: { marginBottom: 16, borderRadius: 16, backgroundColor: '#EFF6FF', paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between' },
  bannerLabel: { color: '#475569', fontWeight: '700' },
  bannerValue: { color: '#1D4ED8', fontSize: 18, fontWeight: '800' },
  notes: { minHeight: 96, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#0F172A', textAlignVertical: 'top', marginBottom: 16 },
  primaryButton: { minHeight: 56, borderRadius: 16, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  emptyText: { fontSize: 14, color: '#64748B' },
  groupCard: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 18, padding: 14, marginBottom: 12 },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  groupName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  groupHours: { fontSize: 14, fontWeight: '700', color: '#2563EB' },
  groupRow: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  groupDate: { fontSize: 14, fontWeight: '700', color: '#334155' },
  groupNote: { marginTop: 4, fontSize: 12, color: '#64748B' },
  groupEditHint: { marginTop: 4, fontSize: 11, color: '#94A3B8', fontWeight: '700' },
  groupTime: { fontSize: 14, fontWeight: '700', color: '#1D4ED8' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '72%', backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  optionRow: { minHeight: 68, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', justifyContent: 'center' },
  optionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  optionSubtitle: { marginTop: 4, fontSize: 12, color: '#64748B' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingTop: 10 },
  timeOption: { width: '31%', margin: '1.15%', minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
});
