import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import * as Location from 'expo-location';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

const OFFLINE_QUEUE_KEY = 'offline_shift_queue';
const OFFLINE_STATE_KEY = 'offline_shift_state_v1';

type ShiftStatus = 'clocked_out' | 'working' | 'on_break';
type OfflineActionType = 'clock_in' | 'clock_out' | 'start_break' | 'end_break';

interface ShiftData {
  id: string;
  status: ShiftStatus;
  clock_in?: string;
  clock_in_local?: string;
  current_break?: {
    id: string;
    start: string;
    start_local: string;
    start_location?: {
      latitude: number;
      longitude: number;
    } | null;
  } | null;
  breaks?: Array<{
    id: string;
    start: string;
    start_local?: string;
    end?: string;
    end_local?: string;
    duration_seconds?: number;
  }>;
  total_break_seconds?: number;
}

interface OfflineShiftAction {
  id: string;
  type: OfflineActionType;
  endpoint: string;
  method: 'POST';
  body: {
    local_time: string;
    timezone: string;
    latitude?: number;
    longitude?: number;
    client_event_id: string;
    auto_clock_out?: boolean;
  };
  created_at: string;
}

interface OfflineShiftState {
  shiftStatus: ShiftStatus;
  shiftData: ShiftData | null;
  workDuration: number;
  breakTimeLeft: number;
  updatedAt: string;
}

const makeClientId = () =>
  `evt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getOfflineQueue = async (): Promise<OfflineShiftAction[]> => {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveOfflineQueue = async (queue: OfflineShiftAction[]) => {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

const enqueueOfflineAction = async (action: OfflineShiftAction) => {
  const queue = await getOfflineQueue();
  queue.push(action);
  await saveOfflineQueue(queue);
};

const clearOfflineQueue = async () => {
  await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
};

const getOfflineState = async (): Promise<OfflineShiftState | null> => {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const saveOfflineState = async (state: OfflineShiftState) => {
  await AsyncStorage.setItem(OFFLINE_STATE_KEY, JSON.stringify(state));
};

const clearOfflineState = async () => {
  await AsyncStorage.removeItem(OFFLINE_STATE_KEY);
};

export default function ClockScreen() {
  const { user } = useAuth();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [shiftStatus, setShiftStatus] = useState<ShiftStatus>('clocked_out');
  const [shiftData, setShiftData] = useState<ShiftData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [workDuration, setWorkDuration] = useState(0);
  const [breakTimeLeft, setBreakTimeLeft] = useState(0);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [booting, setBooting] = useState(true);

  const refreshPendingCount = useCallback(async () => {
    const queue = await getOfflineQueue();
    setPendingCount(queue.length);
  }, []);

  const persistLocalShiftState = useCallback(
    async (
      nextShiftStatus: ShiftStatus,
      nextShiftData: ShiftData | null,
      nextWorkDuration: number,
      nextBreakTimeLeft: number
    ) => {
      await saveOfflineState({
        shiftStatus: nextShiftStatus,
        shiftData: nextShiftData,
        workDuration: nextWorkDuration,
        breakTimeLeft: nextBreakTimeLeft,
        updatedAt: new Date().toISOString(),
      });
    },
    []
  );

  const setLocalShiftState = useCallback(
    async (
      nextShiftStatus: ShiftStatus,
      nextShiftData: ShiftData | null,
      nextWorkDuration = 0,
      nextBreakTimeLeft = 0
    ) => {
      setShiftStatus(nextShiftStatus);
      setShiftData(nextShiftData);
      setWorkDuration(nextWorkDuration);
      setBreakTimeLeft(nextBreakTimeLeft);

      await persistLocalShiftState(
        nextShiftStatus,
        nextShiftData,
        nextWorkDuration,
        nextBreakTimeLeft
      );
    },
    [persistLocalShiftState]
  );

  const checkBiometrics = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricSupported(compatible && enrolled);
    } catch (error) {
      console.log('Biometric check error:', error);
    }
  };

  const authenticate = async (): Promise<boolean> => {
    if (!biometricSupported) return true;

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verify your identity',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
      });
      return result.success;
    } catch (error) {
      console.log('Auth error:', error);
      return true;
    }
  };

  const getLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.log('Location error:', error);
      return null;
    }
  };

  const getToken = async () => {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (authToken) return authToken;
    return await AsyncStorage.getItem('token');
  };

  const apiRequest = async (endpoint: string, method: string = 'GET', body?: any) => {
    const token = await getToken();
    const url = `${API_URL}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body?.client_event_id ? { 'X-Client-Event-Id': body.client_event_id } : {}),
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
          : Array.isArray(data?.detail)
          ? data.detail.map((item: any) => item?.msg || JSON.stringify(item)).join(', ')
          : data?.message || `Request failed (${response.status})`;

      throw new Error(message);
    }

    return data;
  };

  const fetchCurrentShift = useCallback(async () => {
  try {
    const data = await apiRequest('/api/shifts/current');

    if (data) {
      const nextStatus: ShiftStatus = data.status;

      let nextWorkDuration = 0;
      let nextBreakTimeLeft = 0;

      const clockInValue = data.clock_in_local || data.clock_in;
      const breakStartValue =
        data.current_break?.start_local || data.current_break?.start;

      if (nextStatus === 'working' && clockInValue) {
        const clockInTime = new Date(clockInValue).getTime();
        const now = Date.now();
        const totalBreakMs = Number(data.total_break_seconds || 0) * 1000;

        nextWorkDuration = Math.max(
          0,
          Math.floor((now - clockInTime - totalBreakMs) / 1000)
        );

        nextBreakTimeLeft = 0;
      } else if (nextStatus === 'on_break' && breakStartValue) {
        const breakStart = new Date(breakStartValue).getTime();
        const breakDuration = 60 * 60 * 1000;
        const elapsed = Date.now() - breakStart;
        const remaining = Math.max(0, breakDuration - elapsed);

        nextBreakTimeLeft = Math.floor(remaining / 1000);
      } else {
        nextWorkDuration = 0;
        nextBreakTimeLeft = 0;
      }

      await setLocalShiftState(
        nextStatus,
        data,
        nextWorkDuration,
        nextBreakTimeLeft
      );
    } else {
      await setLocalShiftState('clocked_out', null, 0, 0);
    }
  } catch (error) {
    console.log('Fetch shift error:', error);
  }
}, [setLocalShiftState]);

  const syncOfflineQueue = useCallback(async () => {
    const token = await getToken();
    if (!token) return;

    const queue = await getOfflineQueue();
    if (!queue.length) return;

    const remaining: OfflineShiftAction[] = [];

    for (const item of queue) {
      try {
        const response = await fetch(`${API_URL}${item.endpoint}`, {
          method: item.method,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Client-Event-Id': item.id,
          },
          body: JSON.stringify(item.body),
        });

        if (!response.ok) {
          const text = await response.text();
          console.log('Offline sync failed:', item.type, text);
          remaining.push(item);
          break;
        }
      } catch (error) {
        console.log('Offline sync network error:', error);
        remaining.push(item);
        break;
      }
    }

    if (remaining.length) {
      await saveOfflineQueue(remaining);
    } else {
      await clearOfflineQueue();
      await fetchCurrentShift();
    }

    await refreshPendingCount();
  }, [fetchCurrentShift, refreshPendingCount]);

  const restoreState = useCallback(async () => {
    const offlineState = await getOfflineState();
    if (offlineState) {
      setShiftStatus(offlineState.shiftStatus);
      setShiftData(offlineState.shiftData);
      setWorkDuration(offlineState.workDuration || 0);
      setBreakTimeLeft(offlineState.breakTimeLeft || 0);
    }
    await refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
  const timer = setInterval(async () => {
    const nowDate = new Date();
    const nowMs = nowDate.getTime();

    setCurrentTime(nowDate);

    if (shiftStatus === 'working') {
      const clockInValue = shiftData?.clock_in_local || shiftData?.clock_in;

      if (clockInValue) {
        const clockInTime = new Date(clockInValue).getTime();
        const totalBreakMs = Number(shiftData?.total_break_seconds || 0) * 1000;

        setWorkDuration(
          Math.max(0, Math.floor((nowMs - clockInTime - totalBreakMs) / 1000))
        );

        const clockInDate = new Date(clockInValue);
        const crossedMidnight =
          nowDate.toDateString() !== clockInDate.toDateString() &&
          nowDate.getHours() === 0 &&
          nowDate.getMinutes() === 0 &&
          nowDate.getSeconds() <= 2;

        if (crossedMidnight && !isLoading) {
          await handleAutoClockOutAtMidnight();
        }
      }
    }

    if (shiftStatus === 'on_break') {
      const breakStartValue =
        shiftData?.current_break?.start_local || shiftData?.current_break?.start;

      if (breakStartValue) {
        const breakStart = new Date(breakStartValue).getTime();
        const breakDuration = 60 * 60 * 1000;
        const elapsed = nowMs - breakStart;
        const remaining = Math.max(0, breakDuration - elapsed);

        setBreakTimeLeft(Math.floor(remaining / 1000));

        const breakStartDate = new Date(breakStartValue);
        const crossedMidnight =
          nowDate.toDateString() !== breakStartDate.toDateString() &&
          nowDate.getHours() === 0 &&
          nowDate.getMinutes() === 0 &&
          nowDate.getSeconds() <= 2;

        if (crossedMidnight && !isLoading) {
          await handleAutoClockOutAtMidnight();
        }
      }
    }
  }, 1000);

  return () => clearInterval(timer);
}, [
  shiftStatus,
  shiftData?.clock_in,
  shiftData?.clock_in_local,
  shiftData?.total_break_seconds,
  shiftData?.current_break?.start,
  shiftData?.current_break?.start_local,
  isLoading,
]);
  useEffect(() => {
    const init = async () => {
      await checkBiometrics();
      await restoreState();

      const state = await NetInfo.fetch();
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);

      if (online) {
        await syncOfflineQueue();
        await fetchCurrentShift();
      }

      setBooting(false);
    };

    init();
  }, [fetchCurrentShift, restoreState, syncOfflineQueue]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);

      if (online) {
        syncOfflineQueue();
      }
    });

    return () => unsub();
  }, [syncOfflineQueue]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    const state = await NetInfo.fetch();
    const online = !!state.isConnected && !!state.isInternetReachable;

    if (online) {
      await syncOfflineQueue();
      await fetchCurrentShift();
    } else {
      await restoreState();
    }

    setRefreshing(false);
  }, [fetchCurrentShift, restoreState, syncOfflineQueue]);

  const sendOrQueueShiftAction = async (
    type: OfflineActionType,
    endpoint: string,
    nextStatus: ShiftStatus,
    options?: { autoClockOut?: boolean }
  ) => {
    const authenticated = await authenticate();
    if (!authenticated) {
      Alert.alert('Authentication Required', 'Please verify your identity.');
      return false;
    }

    const location = await getLocation();
    const localTime = new Date().toISOString();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const client_event_id = makeClientId();

    const body = {
      local_time: localTime,
      timezone,
      latitude: location?.latitude,
      longitude: location?.longitude,
      client_event_id,
      auto_clock_out: options?.autoClockOut || false,
    };

    const net = await NetInfo.fetch();
    const online = !!net.isConnected && !!net.isInternetReachable;

    if (!online) {
      const action: OfflineShiftAction = {
        id: client_event_id,
        type,
        endpoint,
        method: 'POST',
        body,
        created_at: new Date().toISOString(),
      };

      await enqueueOfflineAction(action);
      await refreshPendingCount();

      if (type === 'clock_in') {
        const offlineShift: ShiftData = {
          id: `offline-${client_event_id}`,
          status: 'working',
          clock_in: localTime,
          clock_in_local: localTime,
          current_break: null,
          breaks: [],
          total_break_seconds: 0,
        };
        await setLocalShiftState('working', offlineShift, 0, 0);
      }

      if (type === 'start_break') {
        const offlineShift: ShiftData | null = shiftData
          ? {
              ...shiftData,
              status: 'on_break',
              current_break: {
                id: `offline-break-${client_event_id}`,
                start: localTime,
                start_local: localTime,
                start_location: location
                  ? {
                      latitude: location.latitude,
                      longitude: location.longitude,
                    }
                  : null,
              },
            }
          : null;

        await setLocalShiftState('on_break', offlineShift, workDuration, 60 * 60);
      }

      if (type === 'end_break') {
        const offlineShift: ShiftData | null = shiftData
          ? {
              ...shiftData,
              status: 'working',
              current_break: null,
            }
          : null;

        await setLocalShiftState('working', offlineShift, workDuration, 0);
      }

      if (type === 'clock_out') {
        await setLocalShiftState('clocked_out', null, 0, 0);
      }

      return true;
    }

    const data = await apiRequest(endpoint, 'POST', body);

    if (type === 'clock_in') {
      let nextWorkDuration = 0;
      if (data?.clock_in) {
        const clockInTime = new Date(data.clock_in).getTime();
        const now = Date.now();
        const totalBreakMs = (data.total_break_seconds || 0) * 1000;
        nextWorkDuration = Math.max(
          0,
          Math.floor((now - clockInTime - totalBreakMs) / 1000)
        );
      }

      await setLocalShiftState('working', data, nextWorkDuration, 0);
    }

    if (type === 'start_break') {
      let nextBreakTimeLeft = 60 * 60;

      if (data?.current_break?.start) {
        const breakStart = new Date(data.current_break.start).getTime();
        const breakDuration = 60 * 60 * 1000;
        const elapsed = Date.now() - breakStart;
        const remaining = Math.max(0, breakDuration - elapsed);
        nextBreakTimeLeft = Math.floor(remaining / 1000);
      }

      await setLocalShiftState('on_break', data, workDuration, nextBreakTimeLeft);
    }

    if (type === 'end_break') {
      let nextWorkDuration = workDuration;

      if (data?.clock_in) {
        const clockInTime = new Date(data.clock_in).getTime();
        const now = Date.now();
        const totalBreakMs = (data.total_break_seconds || 0) * 1000;
        nextWorkDuration = Math.max(
          0,
          Math.floor((now - clockInTime - totalBreakMs) / 1000)
        );
      }

      await setLocalShiftState('working', data, nextWorkDuration, 0);
    }

    if (type === 'clock_out') {
      await setLocalShiftState('clocked_out', null, 0, 0);
    }

    return true;
  };

  const handleClockIn = async () => {
    setIsLoading(true);
    try {
      const ok = await sendOrQueueShiftAction(
        'clock_in',
        '/api/shifts/clock-in',
        'working'
      );

      if (ok) {
        Alert.alert(
          'Clocked In',
          isOnline
            ? 'Your shift has started!'
            : 'Saved offline. It will sync when internet returns.'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Clock in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (shiftStatus === 'on_break') {
      Alert.alert('End Break First', 'Please end your break before clocking out.');
      return;
    }

    setIsLoading(true);
    try {
      const ok = await sendOrQueueShiftAction(
        'clock_out',
        '/api/shifts/clock-out',
        'clocked_out'
      );

      if (ok) {
        Alert.alert(
          'Clocked Out',
          isOnline
            ? 'Your shift has ended. Great work!'
            : 'Saved offline. It will sync when internet returns.'
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Clock out failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (shiftStatus !== 'working') {
      Alert.alert('Not Working', 'You need to be clocked in to start a break.');
      return;
    }

    setIsLoading(true);
    try {
      const ok = await sendOrQueueShiftAction(
        'start_break',
        '/api/shifts/break/start',
        'on_break'
      );

      if (ok && !isOnline) {
        Alert.alert('Break Started', 'Saved offline. It will sync when internet returns.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Start break failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (shiftStatus !== 'on_break') {
      Alert.alert('No Active Break', 'You are not currently on a break.');
      return;
    }

    setIsLoading(true);
    try {
      const ok = await sendOrQueueShiftAction(
        'end_break',
        '/api/shifts/break/end',
        'working'
      );

      if (ok && !isOnline) {
        Alert.alert('Break Ended', 'Saved offline. It will sync when internet returns.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'End break failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoClockOutAtMidnight = async () => {
    if (shiftStatus === 'clocked_out') return;

    setIsLoading(true);
    try {
      if (shiftStatus === 'on_break') {
        await sendOrQueueShiftAction(
          'end_break',
          '/api/shifts/break/end',
          'working',
          { autoClockOut: true }
        );
      }

      await sendOrQueueShiftAction(
        'clock_out',
        '/api/shifts/clock-out',
        'clocked_out',
        { autoClockOut: true }
      );

      Alert.alert(
        'Auto Clock Out',
        isOnline
          ? 'You were automatically clocked out at midnight.'
          : 'Midnight auto clock out was saved offline and will sync when internet returns.'
      );
    } catch (error) {
      console.log('Auto midnight clock out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs
      .toString()
      .padStart(2, '0')}s`;
  };

  const formatBreakTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (booting) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerBoot}>
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
            {getGreeting()}, {user?.first_name || 'Employee'}
          </Text>
          <Text style={styles.date}>
            {currentTime.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        <View style={styles.clockDisplay}>
          <Text style={styles.time}>{formatTime(currentTime)}</Text>
        </View>

        <View style={styles.networkBannerWrap}>
          <View style={[styles.networkBadge, isOnline ? styles.onlineBadge : styles.offlineBadge]}>
            <Ionicons
              name={isOnline ? 'wifi-outline' : 'cloud-offline-outline'}
              size={16}
              color={isOnline ? '#065F46' : '#92400E'}
            />
            <Text style={[styles.networkBadgeText, isOnline ? styles.onlineText : styles.offlineText]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>

          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Ionicons name="cloud-upload-outline" size={16} color="#92400E" />
              <Text style={styles.pendingBadgeText}>
                {pendingCount} pending sync
              </Text>
            </View>
          )}
        </View>

        <View style={styles.statusCard}>
          {shiftStatus === 'clocked_out' && (
            <>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.statusText}>Not Clocked In</Text>
              </View>
              <Text style={styles.statusSubtext}>Tap below to start your shift</Text>
            </>
          )}

          {shiftStatus === 'working' && (
            <>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.statusText, { color: '#10B981' }]}>Working</Text>
              </View>
              <Text style={styles.durationText}>{formatDuration(workDuration)}</Text>
              <Text style={styles.statusSubtext}>
                Started at{' '}
                {shiftData?.clock_in_local || shiftData?.clock_in
  ? new Date(shiftData.clock_in_local || shiftData.clock_in!).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  : '--:--'}
              </Text>
            </>
          )}

          {shiftStatus === 'on_break' && (
            <>
              <View style={styles.statusBadge}>
                <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.statusText, { color: '#F59E0B' }]}>On Break</Text>
              </View>
              <Text style={styles.breakTimeText}>{formatBreakTime(breakTimeLeft)}</Text>
              <Text style={styles.statusSubtext}>remaining</Text>
            </>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {shiftStatus === 'clocked_out' && (
            <TouchableOpacity
              style={[styles.primaryButton, styles.clockInButton]}
              onPress={handleClockIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="large" />
              ) : (
                <>
                  <Ionicons name="finger-print" size={32} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Clock In</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {shiftStatus === 'working' && (
            <>
              <TouchableOpacity
                style={[styles.primaryButton, styles.breakButton]}
                onPress={handleStartBreak}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="large" />
                ) : (
                  <>
                    <Ionicons name="cafe" size={28} color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Start Break</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.secondaryButton, styles.clockOutButton]}
                onPress={handleClockOut}
                disabled={isLoading}
              >
                <Ionicons name="log-out-outline" size={24} color="#EF4444" />
                <Text style={styles.clockOutText}>Clock Out</Text>
              </TouchableOpacity>
            </>
          )}

          {shiftStatus === 'on_break' && (
            <TouchableOpacity
              style={[styles.primaryButton, styles.endBreakButton]}
              onPress={handleEndBreak}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="large" />
              ) : (
                <>
                  <Ionicons name="play" size={32} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>End Break</Text>
                  <Text style={styles.primaryButtonSubtext}>Resume Work</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.gpsIndicator}>
          <Ionicons name="location-outline" size={16} color="#64748B" />
          <Text style={styles.gpsText}>GPS location will be captured</Text>
        </View>

        <View style={styles.midnightInfo}>
          <Ionicons name="moon-outline" size={16} color="#64748B" />
          <Text style={styles.midnightInfoText}>Auto clock out runs at midnight</Text>
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
  centerBoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    marginTop: 20,
    marginBottom: 10,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
  },
  date: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 4,
  },
  clockDisplay: {
    alignItems: 'center',
    marginVertical: 30,
  },
  time: {
    fontSize: 52,
    fontWeight: '200',
    color: '#1E293B',
    fontVariant: ['tabular-nums'],
  },
  networkBannerWrap: {
    gap: 10,
    marginBottom: 16,
  },
  networkBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
  },
  onlineBadge: {
    backgroundColor: '#D1FAE5',
  },
  offlineBadge: {
    backgroundColor: '#FEF3C7',
  },
  networkBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  onlineText: {
    color: '#065F46',
  },
  offlineText: {
    color: '#92400E',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 10,
  },
  pendingBadgeText: {
    color: '#92400E',
    fontSize: 13,
    fontWeight: '700',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#334155',
  },
  statusSubtext: {
    fontSize: 14,
    color: '#64748B',
  },
  durationText: {
    fontSize: 36,
    fontWeight: '300',
    color: '#1E293B',
    marginVertical: 8,
  },
  breakTimeText: {
    fontSize: 48,
    fontWeight: '200',
    color: '#F59E0B',
    marginVertical: 8,
  },
  actionsContainer: {
    gap: 16,
  },
  primaryButton: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    borderRadius: 20,
    gap: 8,
  },
  clockInButton: {
    backgroundColor: '#10B981',
  },
  breakButton: {
    backgroundColor: '#F59E0B',
  },
  endBreakButton: {
    backgroundColor: '#3B82F6',
  },
  primaryButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  primaryButtonSubtext: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    borderWidth: 2,
  },
  clockOutButton: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  clockOutText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
  },
  gpsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  gpsText: {
    fontSize: 13,
    color: '#64748B',
  },
  midnightInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
  },
  midnightInfoText: {
    fontSize: 13,
    color: '#64748B',
  },
});