import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PayrollItem = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_code?: string;
  department?: string;
  pay_period_start: string;
  pay_period_end: string;
  total_hours?: number;
  basic_salary?: number;
  overtime_hours?: number;
  overtime_rate?: number;
  overtime_pay?: number;
  gross_pay: number;
  deductions: number;
  tax: number;
  insurance_deduction?: number;
  pension_deduction?: number;
  benefits_deduction?: number;
  bonus?: number;
  net_pay: number;
  status?: 'draft' | 'approved' | 'sent';
};

const API_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';
const PAYSTUB_PAYROLL_CACHE_KEY = 'hr_paystubs_payroll_cache_v1';
const REQUEST_TIMEOUT_MS = 10000;

export default function HRPaystubsScreen() {
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayrollItem | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPayroll();
  }, []);

  const totalReady = useMemo(
    () => items.filter((x) => x.status !== 'sent').length,
    [items]
  );

  const getToken = async () => {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (authToken) return authToken;
    return await AsyncStorage.getItem('token');
  };

  const loadPayroll = async () => {
    let hadCachedData = false;
    try {
      setLoading(true);

      const cached = await AsyncStorage.getItem(PAYSTUB_PAYROLL_CACHE_KEY);
      if (cached) {
        setItems(JSON.parse(cached));
        setLoading(false);
        hadCachedData = true;
      }

      const token = await getToken();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(`${API_URL}/api/payroll`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });
      } catch (error: any) {
        if (error?.name === 'AbortError') {
          throw new Error('Payroll request timed out');
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }

      const text = await response.text();
      const data = text ? JSON.parse(text) : [];

      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to load payroll');
      }

      const nextItems = Array.isArray(data) ? data : [];
      setItems(nextItems);
      await AsyncStorage.setItem(PAYSTUB_PAYROLL_CACHE_KEY, JSON.stringify(nextItems));
    } catch (error: any) {
      if (!hadCachedData) {
        Alert.alert('Error', error.message || 'Failed to load payroll records');
      }
    } finally {
      setLoading(false);
    }
  };

  const currency = (value: number | undefined) =>
    `$${Number(value || 0).toFixed(2)}`;

  const formatDate = (value?: string) => {
    if (!value) return '-';
    return new Date(value).toLocaleDateString();
  };

  const formatHours = (item: PayrollItem) =>
    Number(item.total_hours ?? item.overtime_hours ?? 0).toFixed(2);

  const createOrUpdatePaystub = async (item: PayrollItem) => {
    const token = await getToken();
    const response = await fetch(`${API_URL}/api/paystubs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        employee_id: item.employee_id,
        payroll_id: item.id,
        pay_period_start: item.pay_period_start,
        pay_period_end: item.pay_period_end,
        gross_pay: item.gross_pay,
        deductions: item.deductions,
        tax: item.tax,
        insurance_deduction: item.insurance_deduction || 0,
        pension_deduction: item.pension_deduction || 0,
        benefits_deduction: item.benefits_deduction || 0,
        bonus: item.bonus || 0,
        net_pay: item.net_pay,
        pay_date: item.pay_period_end,
        published: true,
        file_name: `paystub-${item.employee_name}-${item.pay_period_end}.pdf`,
      }),
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(data?.detail || 'Failed to create paystub');
    }

    return data as { id: string; pdf_filename?: string };
  };

  const downloadAndSharePaystub = async (paystubId: string, fileName: string) => {
    const token = await getToken();
    const cacheDirectory = FileSystemLegacy.cacheDirectory;
    if (!cacheDirectory) {
      throw new Error('Temporary file storage is not available on this device.');
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileUri = `${cacheDirectory}${safeName}`;

    await FileSystemLegacy.downloadAsync(
      `${API_URL}/api/paystubs/${paystubId}/download`,
      fileUri,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Saved', `Paystub downloaded to:\n${fileUri}`);
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: 'Employee Paystub',
      UTI: '.pdf',
    });
  };

  const previewOrSharePdf = async (item: PayrollItem) => {
    try {
      setBusy(true);
      const paystub = await createOrUpdatePaystub(item);
      await downloadAndSharePaystub(
        paystub.id,
        paystub.pdf_filename || `paystub-${item.employee_name}-${item.pay_period_end}.pdf`
      );
    } catch (error: any) {
      Alert.alert('PDF Error', error.message || 'Failed to open paystub');
    } finally {
      setBusy(false);
    }
  };

  const markReadyAndSend = async (item: PayrollItem) => {
    try {
      setBusy(true);
      const paystub = await createOrUpdatePaystub(item);
      const token = await getToken();

      const sendResponse = await fetch(`${API_URL}/api/paystubs/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paystub_ids: [paystub.id],
        }),
      });

      const sendText = await sendResponse.text();
      const sendData = sendText ? JSON.parse(sendText) : {};

      if (!sendResponse.ok) {
        throw new Error(sendData?.detail || 'Failed to publish paystub');
      }

      Alert.alert('Success', 'Paystub published and sent to the employee pay tab.');

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, status: 'sent' } : row
        )
      );
      setSelected(null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send paystub');
    } finally {
      setBusy(false);
    }
  };

  const renderRow = ({ item }: { item: PayrollItem }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => setSelected(item)}
      activeOpacity={0.85}
    >
      <View style={styles.cardTop}>
        <Text style={styles.name}>{item.employee_name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.status || 'draft'}</Text>
        </View>
      </View>

      <Text style={styles.sub}>
        {formatDate(item.pay_period_start)} - {formatDate(item.pay_period_end)}
      </Text>

      <View style={styles.row}>
        <Text style={styles.label}>Hours</Text>
        <Text style={styles.value}>{formatHours(item)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Gross</Text>
        <Text style={styles.value}>{currency(item.gross_pay)}</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Net</Text>
        <Text style={styles.net}>{currency(item.net_pay)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>HR Paystubs</Text>
        <Text style={styles.subtitle}>{totalReady} ready to process</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={renderRow}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No payroll entries found.</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setSelected(null)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Paystub Review</Text>
            <View style={{ width: 42 }} />
          </View>

          {selected && (
            <ScrollView contentContainerStyle={styles.modalBody}>
              <View style={styles.previewCard}>
                <Text style={styles.previewName}>{selected.employee_name}</Text>
                <Text style={styles.sub}>
                  Pay period: {formatDate(selected.pay_period_start)} - {formatDate(selected.pay_period_end)}
                </Text>

                <View style={styles.row}>
                  <Text style={styles.label}>Gross Pay</Text>
                  <Text style={styles.value}>{currency(selected.gross_pay)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Basic Pay</Text>
                  <Text style={styles.value}>{currency(selected.basic_salary)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Tax</Text>
                  <Text style={styles.value}>{currency(selected.tax)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Deductions</Text>
                  <Text style={styles.value}>{currency(selected.deductions)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Insurance</Text>
                  <Text style={styles.value}>{currency(selected.insurance_deduction)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Pension</Text>
                  <Text style={styles.value}>{currency(selected.pension_deduction)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Benefits</Text>
                  <Text style={styles.value}>{currency(selected.benefits_deduction)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Net Pay</Text>
                  <Text style={styles.net}>{currency(selected.net_pay)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => previewOrSharePdf(selected)}
                disabled={busy}
              >
                <Text style={styles.primaryButtonText}>
                  {busy ? 'Working...' : 'Preview / Save PDF'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryButton, styles.sendButton]}
                onPress={() => markReadyAndSend(selected)}
                disabled={busy}
              >
                <Text style={styles.primaryButtonText}>
                  {busy ? 'Sending...' : 'Publish to Employee Pay Tab'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { marginTop: 4, fontSize: 14, color: '#64748B' },
  listContent: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyText: { color: '#64748B', fontSize: 15 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  sub: { marginTop: 6, fontSize: 13, color: '#64748B' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  label: { color: '#64748B', fontSize: 14 },
  value: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  net: { color: '#047857', fontSize: 15, fontWeight: '800' },
  badge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: { color: '#1D4ED8', fontSize: 12, fontWeight: '700' },
  modalContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeText: { color: '#2563EB', fontSize: 15, fontWeight: '600' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  modalBody: { padding: 16, paddingBottom: 40 },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
  },
  previewName: { fontSize: 21, fontWeight: '800', color: '#0F172A' },
  primaryButton: {
    height: 54,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  sendButton: { backgroundColor: '#059669' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
