import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

const LEAVE_TYPES = [
  'Sick Leave',
  'Annual Vacation',
  'Time Off',
  'Unpaid Leave',
  'Personal Leave',
];

interface TimeOffRequest {
  id: string;
  start_date: string;
  end_date: string;
  note?: string;
  status: 'pending' | 'approved' | 'denied';
  days_count: number;
  created_at: string;
  review_note?: string;
}

export default function TimeOffScreen() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showLeaveTypeDropdown, setShowLeaveTypeDropdown] = useState(false);

  const todayDate = new Date();
  const today = formatDateForApi(todayDate);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState('');
  const [leaveType, setLeaveType] = useState('Time Off');

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [startDateObj, setStartDateObj] = useState<Date>(todayDate);
  const [endDateObj, setEndDateObj] = useState<Date>(todayDate);

  useEffect(() => {
    fetchRequests();
  }, []);

  function formatDateForApi(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDateForDisplay(date: Date) {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  function parseApiDate(dateStr: string) {
    return new Date(`${dateStr}T00:00:00`);
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
      data = { detail: raw || 'Request failed' };
    }

    if (!response.ok) {
      throw new Error(data?.detail || 'Request failed');
    }

    return data;
  };

  const fetchRequests = async () => {
    try {
      const data = await apiRequest('/api/time-off');
      setRequests(data);
    } catch (error) {
      console.log('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchRequests();
    setRefreshing(false);
  }, []);

  const resetForm = () => {
    const newToday = new Date();
    const formatted = formatDateForApi(newToday);
    setStartDate(formatted);
    setEndDate(formatted);
    setStartDateObj(newToday);
    setEndDateObj(newToday);
    setNote('');
    setLeaveType('Time Off');
    setShowLeaveTypeDropdown(false);
    setShowStartPicker(false);
    setShowEndPicker(false);
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) {
      Alert.alert('Error', 'Please select both start and end dates.');
      return;
    }

    if (endDate < startDate) {
      Alert.alert('Invalid Dates', 'End date must be after start date.');
      return;
    }

    setSubmitting(true);
    try {
      const formattedNote = note.trim()
        ? `Leave Type: ${leaveType}\n${note.trim()}`
        : `Leave Type: ${leaveType}`;

      await apiRequest('/api/time-off', 'POST', {
        start_date: startDate,
        end_date: endDate,
        note: formattedNote,
      });

      setShowModal(false);
      resetForm();
      await fetchRequests();
      Alert.alert('Request Submitted', 'Your time off request has been submitted for approval.');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    Alert.alert('Cancel Request', 'Are you sure you want to cancel this request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiRequest(`/api/time-off/${id}`, 'DELETE');
            await fetchRequests();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleStartDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    setStartDateObj(selectedDate);
    const formatted = formatDateForApi(selectedDate);
    setStartDate(formatted);

    if (formatted > endDate) {
      setEndDate(formatted);
      setEndDateObj(selectedDate);
    }
  };

  const handleEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }

    if (event.type === 'dismissed' || !selectedDate) {
      return;
    }

    const formatted = formatDateForApi(selectedDate);

    if (formatted < startDate) {
      Alert.alert('Invalid Date', 'End date cannot be before start date.');
      return;
    }

    setEndDateObj(selectedDate);
    setEndDate(formatted);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#10B981';
      case 'denied':
        return '#EF4444';
      case 'pending':
        return '#F59E0B';
      default:
        return '#64748B';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'approved':
        return '#D1FAE5';
      case 'denied':
        return '#FEE2E2';
      case 'pending':
        return '#FEF3C7';
      default:
        return '#F1F5F9';
    }
  };

  const formatDateRange = (start: string, end: string) => {
    const startDateObj = new Date(start + 'T00:00:00');
    const endDateObj = new Date(end + 'T00:00:00');
    const startStr = startDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const endStr = endDateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    if (start === end) {
      return startDateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }

    return `${startStr} - ${endStr}`;
  };

  const renderRequest = ({ item }: { item: TimeOffRequest }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar" size={20} color="#3B82F6" />
          <Text style={styles.dateText}>{formatDateRange(item.start_date, item.end_date)}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: getStatusBg(item.status) }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </Text>
        </View>
      </View>

      <Text style={styles.daysCount}>
        {item.days_count} day{item.days_count !== 1 ? 's' : ''}
      </Text>

      {item.note && <Text style={styles.noteText}>{item.note}</Text>}

      {item.review_note && (
        <View style={styles.reviewNote}>
          <Ionicons name="chatbubble-outline" size={14} color="#64748B" />
          <Text style={styles.reviewNoteText}>{item.review_note}</Text>
        </View>
      )}

      {item.status === 'pending' && (
        <TouchableOpacity style={styles.cancelButton} onPress={() => handleCancel(item.id)}>
          <Text style={styles.cancelButtonText}>Cancel Request</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderLeaveTypeOption = (type: string) => (
    <TouchableOpacity
      key={type}
      style={styles.dropdownItem}
      onPress={() => {
        setLeaveType(type);
        setShowLeaveTypeDropdown(false);
      }}
    >
      <Text style={styles.dropdownItemText}>{type}</Text>
      {leaveType === type && <Ionicons name="checkmark" size={18} color="#3B82F6" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Time Off</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="calendar-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Time Off Requests</Text>
          <Text style={styles.emptyText}>Tap + to request time off</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowModal(false);
                resetForm();
              }}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Request Time Off</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Leave Type</Text>

              <TouchableOpacity
                style={styles.dropdownButton}
                onPress={() => setShowLeaveTypeDropdown(!showLeaveTypeDropdown)}
              >
                <View style={styles.dropdownButtonLeft}>
                  <Ionicons name="briefcase-outline" size={20} color="#64748B" />
                  <Text style={styles.dropdownButtonText}>{leaveType}</Text>
                </View>
                <Ionicons
                  name={showLeaveTypeDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>

              {showLeaveTypeDropdown && (
                <View style={styles.dropdownMenu}>
                  {LEAVE_TYPES.map(renderLeaveTypeOption)}
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => {
                  setShowLeaveTypeDropdown(false);
                  setShowStartPicker(true);
                }}
              >
                <View style={styles.datePickerButtonLeft}>
                  <Ionicons name="calendar-outline" size={20} color="#64748B" />
                  <Text style={styles.datePickerText}>{formatDateForDisplay(startDateObj)}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => {
                  setShowLeaveTypeDropdown(false);
                  setShowEndPicker(true);
                }}
              >
                <View style={styles.datePickerButtonLeft}>
                  <Ionicons name="calendar-outline" size={20} color="#64748B" />
                  <Text style={styles.datePickerText}>{formatDateForDisplay(endDateObj)}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Note (optional)</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note..."
                placeholderTextColor="#94A3B8"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={startDateObj}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleStartDateChange}
              minimumDate={new Date()}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={endDateObj}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={handleEndDateChange}
              minimumDate={startDateObj}
            />
          )}
        </SafeAreaView>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#334155',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 8,
  },
  listContent: {
    padding: 20,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 8,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  daysCount: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: '#475569',
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 20,
  },
  reviewNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#F1F5F9',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  reviewNoteText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
  },
  cancelButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  modalContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  dropdownButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#1E293B',
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#1E293B',
  },
  datePickerButton: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 16,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  datePickerText: {
    fontSize: 16,
    color: '#1E293B',
  },
  noteInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    fontSize: 16,
    color: '#1E293B',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});