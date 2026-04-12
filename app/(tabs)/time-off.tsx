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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import AppIcon from '../../src/components/AppIcon';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');
const OFFLINE_TIME_OFF_QUEUE_KEY = 'offline_time_off_queue_v1';
const CACHED_TIME_OFF_REQUESTS_KEY = 'cached_time_off_requests_v1';
const CACHED_LEAVE_TYPES_KEY = 'cached_leave_types_v1';
const CACHED_LEAVE_BALANCE_KEY = 'cached_leave_balance_v1';
const REQUEST_TIMEOUT_MS = 8000;
const CALENDAR_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface LeaveTypeOption {
  id: string;
  name: string;
  days_per_year: number;
}

interface LeaveBalanceDetail {
  days: number;
  hours: number;
  leave_type_id: string;
}

interface TimeOffRequest {
  id: string;
  start_date: string;
  end_date: string;
  leave_type_id?: string;
  leave_type_name?: string;
  note?: string;
  status: 'pending' | 'approved' | 'denied';
  days_count: number;
  created_at: string;
  review_note?: string;
  sync_status?: 'synced' | 'pending_sync';
}

interface OfflineTimeOffAction {
  id: string;
  body: {
    start_date: string;
    end_date: string;
    note: string;
    leave_type_id?: string;
  };
  leave_type_name: string;
  created_at: string;
}

type CalendarCell = {
  key: string;
  date: Date;
  inMonth: boolean;
};

export default function TimeOffScreen() {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<Record<string, LeaveBalanceDetail>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showLeaveTypeModal, setShowLeaveTypeModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const hasVisibleContent =
    requests.length > 0 || Object.keys(leaveBalance).length > 0 || leaveTypes.length > 0;

  const todayDate = new Date();
  const today = formatDateForApi(todayDate);

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [note, setNote] = useState('');
  const [leaveType, setLeaveType] = useState('Annual Leave');
  const [leaveTypeId, setLeaveTypeId] = useState<string>('');

  const [startDateObj, setStartDateObj] = useState<Date>(todayDate);
  const [endDateObj, setEndDateObj] = useState<Date>(todayDate);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [pickerDraftDate, setPickerDraftDate] = useState<Date>(todayDate);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => {
    const seeded = new Date(todayDate);
    seeded.setDate(1);
    return seeded;
  });

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

  function formatMonthYear(date: Date) {
    return date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  function startOfMonth(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function addMonths(date: Date, amount: number) {
    return new Date(date.getFullYear(), date.getMonth() + amount, 1);
  }

  function stripTime(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function isSameDay(left: Date, right: Date) {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  function buildCalendarDays(month: Date) {
    const firstDay = startOfMonth(month);
    const firstWeekday = firstDay.getDay();
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const current = new Date(gridStart);
      current.setDate(gridStart.getDate() + index);
      return {
        key: `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`,
        date: current,
        inMonth: current.getMonth() === month.getMonth(),
      } satisfies CalendarCell;
    });
  }

  function countBusinessDays(start: string, end: string) {
    const startValue = new Date(`${start}T00:00:00`);
    const endValue = new Date(`${end}T00:00:00`);
    let count = 0;

    for (
      let cursor = new Date(startValue);
      cursor <= endValue;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        count += 1;
      }
    }

    return count || 1;
  }

  const getOfflineQueue = useCallback(async (): Promise<OfflineTimeOffAction[]> => {
    try {
      const raw = await AsyncStorage.getItem(OFFLINE_TIME_OFF_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, []);

  const saveOfflineQueue = useCallback(async (queue: OfflineTimeOffAction[]) => {
    await AsyncStorage.setItem(OFFLINE_TIME_OFF_QUEUE_KEY, JSON.stringify(queue));
    setPendingSyncCount(queue.length);
  }, []);

  const readCachedJson = useCallback(async <T,>(key: string, fallback: T): Promise<T> => {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }, []);

  const mergeOfflineRequests = useCallback(
    async (serverRequests: TimeOffRequest[]) => {
      const queue = await getOfflineQueue();
      const offlineRequests: TimeOffRequest[] = queue.map((item) => ({
        id: item.id,
        start_date: item.body.start_date,
        end_date: item.body.end_date,
        leave_type_id: item.body.leave_type_id,
        leave_type_name: item.leave_type_name,
        note: item.body.note,
        status: 'pending',
        days_count: countBusinessDays(item.body.start_date, item.body.end_date),
        created_at: item.created_at,
        review_note: 'Saved offline. Waiting to sync.',
        sync_status: 'pending_sync',
      }));

      return [...offlineRequests, ...serverRequests];
    },
    [getOfflineQueue]
  );

  const apiRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
    const authToken = await AsyncStorage.getItem('auth_token');
    const token = authToken || (await AsyncStorage.getItem('token'));
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
        data = { detail: raw || 'Request failed' };
      }

      if (!response.ok) {
        throw new Error(data?.detail || 'Request failed');
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

  const fetchLeaveTypes = useCallback(async () => {
    let types: LeaveTypeOption[] = [];

    try {
      const data = await apiRequest('/api/leave-types');
      types = Array.isArray(data) ? (data as LeaveTypeOption[]) : [];
      await AsyncStorage.setItem(CACHED_LEAVE_TYPES_KEY, JSON.stringify(types));
    } catch {
      types = await readCachedJson<LeaveTypeOption[]>(CACHED_LEAVE_TYPES_KEY, []);
    }

    setLeaveTypes(types);

    if (!leaveTypeId && types.length > 0) {
      const defaultType =
        types.find((type) => type.name === 'Annual Leave') ||
        types.find((type) => type.days_per_year > 0) ||
        types[0];

      setLeaveType(defaultType.name);
      setLeaveTypeId(defaultType.id);
    }
  }, [leaveTypeId, readCachedJson]);

  const fetchLeaveBalance = useCallback(async () => {
    try {
      const data = await apiRequest('/api/leave-balance/me');
      const details = data?.details || {};
      setLeaveBalance(details);
      await AsyncStorage.setItem(CACHED_LEAVE_BALANCE_KEY, JSON.stringify(details));
    } catch {
      const cached = await readCachedJson<Record<string, LeaveBalanceDetail>>(
        CACHED_LEAVE_BALANCE_KEY,
        {}
      );
      setLeaveBalance(cached);
    }
  }, [readCachedJson]);

  const fetchRequests = useCallback(async () => {
    try {
      const data = await apiRequest('/api/time-off');
      const merged = await mergeOfflineRequests(Array.isArray(data) ? data : []);
      setRequests(merged);
      await AsyncStorage.setItem(CACHED_TIME_OFF_REQUESTS_KEY, JSON.stringify(merged));
    } catch (error) {
      console.log('Fetch error:', error);
      const cached = await readCachedJson<TimeOffRequest[]>(CACHED_TIME_OFF_REQUESTS_KEY, []);
      const merged = await mergeOfflineRequests(
        cached.filter((item) => item.sync_status !== 'pending_sync')
      );
      setRequests(merged);
    }
  }, [mergeOfflineRequests, readCachedJson]);

  const syncOfflineRequests = useCallback(async () => {
    const queue = await getOfflineQueue();
    if (!queue.length) {
      setPendingSyncCount(0);
      return;
    }

    const state = await NetInfo.fetch();
    const online = !!state.isConnected && !!state.isInternetReachable;
    if (!online) {
      setPendingSyncCount(queue.length);
      return;
    }

    const remaining: OfflineTimeOffAction[] = [];

    for (const item of queue) {
      try {
        await apiRequest('/api/time-off', 'POST', item.body);
      } catch (error) {
        console.log('Offline time-off sync failed:', error);
        remaining.push(item);
        break;
      }
    }

    await saveOfflineQueue(remaining);
  }, [apiRequest, getOfflineQueue, saveOfflineQueue]);

  const loadScreenData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [cachedTypes, cachedBalance, cachedRequests] = await Promise.all([
        readCachedJson<LeaveTypeOption[]>(CACHED_LEAVE_TYPES_KEY, []),
        readCachedJson<Record<string, LeaveBalanceDetail>>(CACHED_LEAVE_BALANCE_KEY, {}),
        readCachedJson<TimeOffRequest[]>(CACHED_TIME_OFF_REQUESTS_KEY, []),
      ]);

      if (cachedTypes.length) {
        setLeaveTypes(cachedTypes);
      }

      if (Object.keys(cachedBalance).length) {
        setLeaveBalance(cachedBalance);
      }

      const mergedCachedRequests = await mergeOfflineRequests(
        cachedRequests.filter((item) => item.sync_status !== 'pending_sync')
      );
      if (mergedCachedRequests.length) {
        setRequests(mergedCachedRequests);
      }

      setIsLoading(false);

      await syncOfflineRequests();
      await Promise.all([fetchLeaveTypes(), fetchLeaveBalance(), fetchRequests()]);
    } finally {
      setIsLoading(false);
    }
  }, [
    fetchLeaveBalance,
    fetchLeaveTypes,
    fetchRequests,
    mergeOfflineRequests,
    readCachedJson,
    syncOfflineRequests,
  ]);

  useEffect(() => {
    loadScreenData();
  }, [loadScreenData]);

  useEffect(() => {
    const init = async () => {
      const queue = await getOfflineQueue();
      setPendingSyncCount(queue.length);
    };

    init();

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);

      if (online) {
        syncOfflineRequests()
          .then(fetchRequests)
          .catch((error) => console.log('Time-off sync listener error:', error));
      }
    });

    return () => unsubscribe();
  }, [fetchRequests, getOfflineQueue, syncOfflineRequests]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadScreenData();
    setRefreshing(false);
  }, [loadScreenData]);

  const resetForm = () => {
    const newToday = new Date();
    const formatted = formatDateForApi(newToday);
    setStartDate(formatted);
    setEndDate(formatted);
    setStartDateObj(newToday);
    setEndDateObj(newToday);
    setNote('');
    const defaultType =
      leaveTypes.find((type) => type.name === 'Annual Leave') ||
      leaveTypes.find((type) => type.days_per_year > 0) ||
      leaveTypes[0];

    setLeaveType(defaultType?.name || 'Annual Leave');
    setLeaveTypeId(defaultType?.id || '');
    setShowLeaveTypeModal(false);
    setShowDatePickerModal(false);
    setActivePicker(null);
    setPickerDraftDate(newToday);
    setCalendarMonth(startOfMonth(newToday));
  };

  const closeRequestModal = () => {
    setShowModal(false);
    resetForm();
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
      const payload = {
        start_date: startDate,
        end_date: endDate,
        note: formattedNote,
        leave_type_id: leaveTypeId || undefined,
      };

      const network = await NetInfo.fetch();
      const online = !!network.isConnected && !!network.isInternetReachable;

      if (!online) {
        const queuedRequest: OfflineTimeOffAction = {
          id: `offline-timeoff-${Date.now()}`,
          body: payload,
          leave_type_name: leaveType,
          created_at: new Date().toISOString(),
        };

        const queue = await getOfflineQueue();
        queue.push(queuedRequest);
        await saveOfflineQueue(queue);

        const offlineRequest: TimeOffRequest = {
          id: queuedRequest.id,
          start_date: startDate,
          end_date: endDate,
          leave_type_id: leaveTypeId || undefined,
          leave_type_name: leaveType,
          note: formattedNote,
          status: 'pending',
          days_count: countBusinessDays(startDate, endDate),
          created_at: queuedRequest.created_at,
          review_note: 'Saved offline. Waiting to sync.',
          sync_status: 'pending_sync',
        };

        const nextRequests = [offlineRequest, ...requests];
        setRequests(nextRequests);
        await AsyncStorage.setItem(CACHED_TIME_OFF_REQUESTS_KEY, JSON.stringify(nextRequests));
        closeRequestModal();
        Alert.alert(
          'Saved Offline',
          'Your leave request was saved on this device and will sync automatically when internet returns.'
        );
        return;
      }

      const authToken = await AsyncStorage.getItem('auth_token');
      const token = authToken || (await AsyncStorage.getItem('token'));
      const response = await fetch(`${API_URL}/api/time-off`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      let data: any = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = { detail: raw || 'Request failed' };
      }

      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to submit leave request');
      }

      closeRequestModal();
      await loadScreenData();
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
            if (id.startsWith('offline-timeoff-')) {
              const queue = await getOfflineQueue();
              const nextQueue = queue.filter((item) => item.id !== id);
              await saveOfflineQueue(nextQueue);
              const nextRequests = requests.filter((item) => item.id !== id);
              setRequests(nextRequests);
              await AsyncStorage.setItem(CACHED_TIME_OFF_REQUESTS_KEY, JSON.stringify(nextRequests));
              return;
            }

            await apiRequest(`/api/time-off/${id}`, 'DELETE');
            await fetchRequests();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const openPicker = (type: 'start' | 'end') => {
    setShowLeaveTypeModal(false);
    setActivePicker(type);
    const nextDate = type === 'start' ? startDateObj : endDateObj;
    setPickerDraftDate(nextDate);
    setCalendarMonth(startOfMonth(nextDate));
    setShowDatePickerModal(true);
  };

  const closePicker = () => {
    setShowDatePickerModal(false);
    setActivePicker(null);
  };

  const applyPickerDate = (selectedDate: Date) => {
    if (activePicker === 'start') {
      setStartDateObj(selectedDate);
      const formatted = formatDateForApi(selectedDate);
      setStartDate(formatted);
      if (formatted > endDate) {
        setEndDate(formatted);
        setEndDateObj(selectedDate);
      }
    }

    if (activePicker === 'end') {
      const formatted = formatDateForApi(selectedDate);
      if (formatted < startDate) {
        Alert.alert('Invalid Date', 'End date cannot be before start date.');
        return;
      }
      setEndDateObj(selectedDate);
      setEndDate(formatted);
    }

    closePicker();
  };

  const minimumSelectableDate = activePicker === 'end' ? stripTime(startDateObj) : stripTime(todayDate);
  const calendarDays = buildCalendarDays(calendarMonth);

  const selectCalendarDate = (selectedDate: Date) => {
    if (stripTime(selectedDate) < minimumSelectableDate) {
      return;
    }

    setPickerDraftDate(selectedDate);
    applyPickerDate(selectedDate);
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
          <View style={styles.dateTextWrap}>
            <Text style={styles.dateText}>{formatDateRange(item.start_date, item.end_date)}</Text>
            <Text style={styles.leaveTypePill}>{item.leave_type_name || 'Time Off'}</Text>
          </View>
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

  const renderLeaveTypeOption = ({ item: type }: { item: LeaveTypeOption }) => (
    <TouchableOpacity
      style={styles.leaveTypeOption}
      onPress={() => {
        setLeaveType(type.name);
        setLeaveTypeId(type.id);
        setShowLeaveTypeModal(false);
      }}
    >
      <View style={styles.leaveTypeOptionTextWrap}>
        <Text style={styles.leaveTypeOptionText}>{type.name}</Text>
        <Text style={styles.leaveTypeOptionSub}>
          {type.days_per_year} day{type.days_per_year === 1 ? '' : 's'} per year
        </Text>
      </View>
      {leaveTypeId === type.id && <Ionicons name="checkmark" size={18} color="#3B82F6" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Time Off</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
          <AppIcon name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.syncBannerWrap}>
        <View style={[styles.syncBadge, isOnline ? styles.syncOnline : styles.syncOffline]}>
          <Ionicons
            name={isOnline ? 'wifi-outline' : 'cloud-offline-outline'}
            size={16}
            color={isOnline ? '#065F46' : '#92400E'}
          />
          <Text style={[styles.syncBadgeText, isOnline ? styles.syncOnlineText : styles.syncOfflineText]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        {pendingSyncCount > 0 && (
          <View style={styles.syncPendingBadge}>
            <Ionicons name="cloud-upload-outline" size={16} color="#92400E" />
            <Text style={styles.syncPendingText}>{pendingSyncCount} request(s) waiting to sync</Text>
          </View>
        )}
      </View>

      {Object.keys(leaveBalance).length > 0 && (
        <View style={styles.balanceSection}>
          <Text style={styles.balanceSectionTitle}>Remaining Leave Balance</Text>
          <FlatList
            horizontal
            data={Object.entries(leaveBalance)}
            keyExtractor={([key]) => key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.balanceList}
            renderItem={({ item: [label, detail] }) => (
              <View style={styles.balanceCard}>
                <Text style={styles.balanceDays}>{detail.days}</Text>
                <Text style={styles.balanceUnit}>days</Text>
                <Text style={styles.balanceLabel}>{label}</Text>
              </View>
            )}
          />
        </View>
      )}

      {isLoading && !hasVisibleContent ? (
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
              onPress={closeRequestModal}
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
                onPress={() => setShowLeaveTypeModal(true)}
              >
                <View style={styles.dropdownButtonLeft}>
                  <Ionicons name="briefcase-outline" size={20} color="#64748B" />
                  <Text style={styles.dropdownButtonText}>{leaveType}</Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => openPicker('start')}
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
                onPress={() => openPicker('end')}
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

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.backButtonSecondary} onPress={closeRequestModal}>
                <Ionicons name="arrow-back-outline" size={18} color="#475569" />
                <Text style={styles.backButtonSecondaryText}>Back</Text>
              </TouchableOpacity>

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
          </View>

        </SafeAreaView>
      </Modal>

      <Modal
        visible={showDatePickerModal}
        animationType="fade"
        transparent
        onRequestClose={closePicker}
      >
        <View style={styles.datePickerModalOverlay}>
          <View style={styles.datePickerModalCard}>
            <Text style={styles.datePickerModalTitle}>
              {activePicker === 'start' ? 'Choose Start Date' : 'Choose End Date'}
            </Text>
            <Text style={styles.datePickerModalSub}>
              Tap a day to use it for this request
            </Text>

            <View style={styles.calendarNavRow}>
              <TouchableOpacity
                style={styles.calendarNavButton}
                onPress={() => setCalendarMonth((current) => addMonths(current, -1))}
              >
                <Ionicons name="chevron-back" size={18} color="#334155" />
              </TouchableOpacity>

              <Text style={styles.calendarMonthLabel}>{formatMonthYear(calendarMonth)}</Text>

              <TouchableOpacity
                style={styles.calendarNavButton}
                onPress={() => setCalendarMonth((current) => addMonths(current, 1))}
              >
                <Ionicons name="chevron-forward" size={18} color="#334155" />
              </TouchableOpacity>
            </View>

            <View style={styles.calendarWeekHeader}>
              {CALENDAR_WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.calendarWeekLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((cell) => {
                const cellDate = stripTime(cell.date);
                const disabled = cellDate < minimumSelectableDate;
                const selected = isSameDay(cell.date, pickerDraftDate);

                return (
                  <TouchableOpacity
                    key={cell.key}
                    style={[
                      styles.calendarCell,
                      selected && styles.calendarCellSelected,
                      !cell.inMonth && styles.calendarCellOutsideMonth,
                      disabled && styles.calendarCellDisabled,
                    ]}
                    disabled={disabled}
                    onPress={() => selectCalendarDate(cell.date)}
                  >
                    <Text
                      style={[
                        styles.calendarCellText,
                        !cell.inMonth && styles.calendarCellTextMuted,
                        selected && styles.calendarCellTextSelected,
                        disabled && styles.calendarCellTextDisabled,
                      ]}
                    >
                      {cell.date.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.iosPickerActions}>
              <TouchableOpacity style={styles.iosPickerButtonSecondary} onPress={closePicker}>
                <Text style={styles.iosPickerButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLeaveTypeModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLeaveTypeModal(false)}
      >
        <View style={styles.leaveTypeModalOverlay}>
          <View style={styles.leaveTypeModalCard}>
            <View style={styles.leaveTypeModalHeader}>
              <Text style={styles.leaveTypeModalTitle}>Choose Leave Type</Text>
              <TouchableOpacity onPress={() => setShowLeaveTypeModal(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={leaveTypes}
              keyExtractor={(item) => item.id}
              renderItem={renderLeaveTypeOption}
              ItemSeparatorComponent={() => <View style={styles.leaveTypeDivider} />}
            />
          </View>
        </View>
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
  syncBannerWrap: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 8,
  },
  syncBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  syncOnline: {
    backgroundColor: '#D1FAE5',
  },
  syncOffline: {
    backgroundColor: '#FEF3C7',
  },
  syncBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  syncOnlineText: {
    color: '#065F46',
  },
  syncOfflineText: {
    color: '#92400E',
  },
  syncPendingBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
  },
  syncPendingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400E',
  },
  balanceSection: {
    paddingTop: 16,
  },
  balanceSectionTitle: {
    paddingHorizontal: 24,
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 12,
  },
  balanceList: {
    paddingHorizontal: 24,
    paddingBottom: 4,
    gap: 12,
  },
  balanceCard: {
    width: 128,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  balanceDays: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2563EB',
  },
  balanceUnit: {
    fontSize: 12,
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  balanceLabel: {
    fontSize: 13,
    color: '#1E293B',
    marginTop: 8,
    textAlign: 'center',
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
  dateTextWrap: {
    flex: 1,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  leaveTypePill: {
    marginTop: 6,
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
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
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  backButtonSecondary: {
    flex: 1,
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  backButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  iosPickerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingTop: 8,
  },
  iosPickerButtonSecondary: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  iosPickerButtonSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  iosPickerButtonPrimary: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#3B82F6',
  },
  iosPickerButtonPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  datePickerModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
  },
  datePickerModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
  },
  datePickerModalSub: {
    marginTop: 6,
    marginBottom: 14,
    textAlign: 'center',
    fontSize: 13,
    color: '#64748B',
  },
  calendarNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNavButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  calendarWeekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarWeekLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  calendarCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    marginBottom: 6,
  },
  calendarCellSelected: {
    backgroundColor: '#3B82F6',
  },
  calendarCellOutsideMonth: {
    opacity: 0.45,
  },
  calendarCellDisabled: {
    opacity: 0.2,
  },
  calendarCellText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  calendarCellTextMuted: {
    color: '#94A3B8',
  },
  calendarCellTextSelected: {
    color: '#FFFFFF',
  },
  calendarCellTextDisabled: {
    color: '#CBD5E1',
  },
  leaveTypeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'flex-end',
  },
  leaveTypeModalCard: {
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 18,
  },
  leaveTypeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  leaveTypeModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  leaveTypeOption: {
    minHeight: 68,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leaveTypeOptionTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  leaveTypeOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  leaveTypeOptionSub: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
  },
  leaveTypeDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginLeft: 20,
  },
});
