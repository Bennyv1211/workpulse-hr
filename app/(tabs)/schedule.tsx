import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

type ScheduleRow = {
  id: string;
  date: string;
  start_time?: string | null;
  end_time?: string | null;
  total_hours?: number;
  notes?: string | null;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatIsoDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function getStartOfWeek(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default function ScheduleScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [schedule, setSchedule] = useState<ScheduleRow[]>([]);

  const getToken = async () => {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (authToken) return authToken;
    return await AsyncStorage.getItem('token');
  };

  const apiRequest = async (endpoint: string) => {
    const token = await getToken();
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      throw new Error(data?.detail || 'Request failed');
    }
    return data;
  };

  const loadSchedule = useCallback(async () => {
    const start = getStartOfWeek(weekOffset);
    const rows = (await apiRequest(`/api/schedule/week/${formatIsoDate(start)}`)) as ScheduleRow[];
    setSchedule(Array.isArray(rows) ? rows : []);
  }, [weekOffset]);

  useEffect(() => {
    loadSchedule()
      .catch(() => setSchedule([]))
      .finally(() => setLoading(false));
  }, [loadSchedule]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadSchedule();
    } finally {
      setRefreshing(false);
    }
  }, [loadSchedule]);

  const weekStart = useMemo(() => getStartOfWeek(weekOffset), [weekOffset]);
  const weekDays = useMemo(() => {
    const base = getStartOfWeek(weekOffset);
    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(base);
      current.setDate(base.getDate() + index);
      const iso = formatIsoDate(current);
      const row = schedule.find((entry) => entry.date === iso);
      return {
        key: iso,
        label: WEEKDAY_LABELS[current.getDay()],
        dateLabel: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        row,
      };
    });
  }, [schedule, weekOffset]);

  const totalWeeklyHours = useMemo(
    () => weekDays.reduce((sum, day) => sum + Number(day.row?.total_hours || 0), 0),
    [weekDays]
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Schedule</Text>
            <Text style={styles.subtitle}>
              Week of {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            </Text>
          </View>
          <View style={styles.weekNav}>
            <TouchableOpacity style={styles.weekButton} onPress={() => setWeekOffset((value) => value - 1)}>
              <Text style={styles.weekButtonText}>Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.weekButton} onPress={() => setWeekOffset((value) => value + 1)}>
              <Text style={styles.weekButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Scheduled Hours</Text>
          <Text style={styles.summaryValue}>{totalWeeklyHours.toFixed(2)}h</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#2563EB" style={styles.loader} />
        ) : (
          weekDays.map((day) => (
            <View key={day.key} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{day.label}</Text>
                <Text style={styles.dayDate}>{day.dateLabel}</Text>
              </View>
              {day.row?.start_time && day.row?.end_time ? (
                <>
                  <Text style={styles.shiftText}>
                    {day.row.start_time} - {day.row.end_time}
                  </Text>
                  <Text style={styles.hoursText}>{Number(day.row.total_hours || 0).toFixed(2)} scheduled hours</Text>
                  {!!day.row.notes && <Text style={styles.notesText}>{day.row.notes}</Text>}
                </>
              ) : (
                <Text style={styles.offText}>Off</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 20, paddingBottom: 36, gap: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 30, fontWeight: '800', color: '#0F172A' },
  subtitle: { marginTop: 6, color: '#64748B', fontSize: 15 },
  weekNav: { flexDirection: 'row', gap: 10 },
  weekButton: { backgroundColor: '#DBEAFE', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  weekButtonText: { color: '#1D4ED8', fontWeight: '700' },
  summaryCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  summaryLabel: { color: '#64748B', fontWeight: '600' },
  summaryValue: { marginTop: 8, fontSize: 28, fontWeight: '800', color: '#0F172A' },
  loader: { marginTop: 80 },
  dayCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  dayLabel: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  dayDate: { color: '#64748B', fontWeight: '600' },
  shiftText: { fontSize: 18, fontWeight: '700', color: '#1D4ED8' },
  hoursText: { marginTop: 6, color: '#475569' },
  notesText: { marginTop: 8, color: '#64748B', fontStyle: 'italic' },
  offText: { color: '#94A3B8', fontWeight: '700' },
});
