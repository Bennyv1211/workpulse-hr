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
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Asset } from 'expo-asset';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

type PayrollItem = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_number?: string;
  department?: string;
  pay_period_start: string;
  pay_period_end: string;
  total_hours: number;
  hourly_rate?: number;
  salary_amount?: number;
  gross_pay: number;
  deductions: number;
  tax: number;
  benefits_deduction?: number;
  bonus?: number;
  net_pay: number;
  status?: 'draft' | 'approved' | 'sent';
};

const API_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

export default function HRPaystubsScreen() {
  const [items, setItems] = useState<PayrollItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayrollItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string>('');

  useEffect(() => {
    loadLogo();
    loadPayroll();
  }, []);

  const totalReady = useMemo(
    () => items.filter((x) => x.status !== 'sent').length,
    [items]
  );

  const getToken = async () => {
    return await AsyncStorage.getItem('token');
  };

  const loadLogo = async () => {
    try {
      const asset = Asset.fromModule(require('../../assets/images/icon.png'));
      await asset.downloadAsync();

      if (!asset.localUri) {
        throw new Error('Logo asset localUri not found');
      }

      const base64 = await FileSystemLegacy.readAsStringAsync(asset.localUri, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });

      setLogoBase64(`data:image/png;base64,${base64}`);
    } catch (error) {
      console.log('Failed to load logo:', error);
    }
  };

  const loadPayroll = async () => {
    try {
      setLoading(true);

      const token = await getToken();
      const response = await fetch(`${API_URL}/api/payroll`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : [];

      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to load payroll');
      }

      setItems(Array.isArray(data) ? data : []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load payroll records');
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

  const escapeHtml = (value: string | number | undefined | null) => {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const buildPaystubHtml = (item: PayrollItem) => {
    return `
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
              color: #0f172a;
              padding: 28px;
              font-size: 12px;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 16px;
              margin-bottom: 20px;
            }
            .brand {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .logo {
              width: 56px;
              height: 56px;
              object-fit: contain;
              border-radius: 12px;
            }
            .company {
              font-size: 22px;
              font-weight: 700;
              color: #1e3a8a;
            }
            .title {
              font-size: 20px;
              font-weight: 700;
              text-align: right;
            }
            .sub {
              color: #475569;
              margin-top: 4px;
            }
            .section {
              margin-top: 18px;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
              overflow: hidden;
            }
            .section-title {
              background: #eff6ff;
              padding: 10px 14px;
              font-weight: 700;
              color: #1d4ed8;
            }
            .grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 0;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 10px 14px;
              border-top: 1px solid #f1f5f9;
            }
            .label {
              color: #475569;
            }
            .value {
              font-weight: 600;
            }
            .totals .row:last-child {
              background: #f8fafc;
              font-size: 14px;
            }
            .net {
              color: #047857;
              font-weight: 800;
            }
            .footer {
              margin-top: 24px;
              color: #64748b;
              font-size: 11px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              ${
                logoBase64
                  ? `<img class="logo" src="${logoBase64}" />`
                  : ''
              }
              <div>
                <div class="company">Emplora</div>
                <div class="sub">Employee Pay Statement</div>
              </div>
            </div>
            <div>
              <div class="title">Paystub</div>
              <div class="sub">Status: ${escapeHtml(item.status || 'draft')}</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Employee Details</div>
            <div class="grid">
              <div class="row"><span class="label">Employee</span><span class="value">${escapeHtml(item.employee_name)}</span></div>
              <div class="row"><span class="label">Employee No.</span><span class="value">${escapeHtml(item.employee_number || '-')}</span></div>
              <div class="row"><span class="label">Department</span><span class="value">${escapeHtml(item.department || '-')}</span></div>
              <div class="row"><span class="label">Pay Period</span><span class="value">${escapeHtml(formatDate(item.pay_period_start))} - ${escapeHtml(formatDate(item.pay_period_end))}</span></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Hours & Rate</div>
            <div class="row"><span class="label">Hours Worked</span><span class="value">${escapeHtml(item.total_hours.toFixed(2))}</span></div>
            <div class="row"><span class="label">Hourly Rate</span><span class="value">${escapeHtml(currency(item.hourly_rate))}</span></div>
            <div class="row"><span class="label">Salary Basis</span><span class="value">${escapeHtml(currency(item.salary_amount))}</span></div>
          </div>

          <div class="section totals">
            <div class="section-title">Earnings & Deductions</div>
            <div class="row"><span class="label">Gross Pay</span><span class="value">${escapeHtml(currency(item.gross_pay))}</span></div>
            <div class="row"><span class="label">Bonus</span><span class="value">${escapeHtml(currency(item.bonus))}</span></div>
            <div class="row"><span class="label">Deductions</span><span class="value">${escapeHtml(currency(item.deductions))}</span></div>
            <div class="row"><span class="label">Tax</span><span class="value">${escapeHtml(currency(item.tax))}</span></div>
            <div class="row"><span class="label">Benefits</span><span class="value">${escapeHtml(currency(item.benefits_deduction))}</span></div>
            <div class="row"><span class="label">Net Pay</span><span class="value net">${escapeHtml(currency(item.net_pay))}</span></div>
          </div>

          <div class="footer">
            This paystub was generated by Emplora.
          </div>
        </body>
      </html>
    `;
  };

  const generatePdf = async (item: PayrollItem) => {
    try {
      setBusy(true);

      const html = buildPaystubHtml(item);

      const result = await Print.printToFileAsync({
        html,
        base64: false,
      });

      return result.uri;
    } catch (error: any) {
      Alert.alert('PDF Error', error.message || 'Failed to generate PDF');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const previewOrSharePdf = async (item: PayrollItem) => {
    const uri = await generatePdf(item);
    if (!uri) return;

    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Unavailable', 'Sharing is not available on this device.');
      return;
    }

    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${item.employee_name} paystub`,
      UTI: '.pdf',
    });
  };

  const markReadyAndSend = async (item: PayrollItem) => {
    try {
      setBusy(true);

      const token = await getToken();
      const pdfUri = await generatePdf(item);
      if (!pdfUri) return;

      const pdfBase64 = await FileSystemLegacy.readAsStringAsync(pdfUri, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });

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
          benefits_deduction: item.benefits_deduction || 0,
          bonus: item.bonus || 0,
          net_pay: item.net_pay,
          published: true,
          pdf_base64: pdfBase64,
          file_name: `paystub-${item.employee_name}-${item.pay_period_end}.pdf`,
        }),
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(data?.detail || 'Failed to send paystub');
      }

      Alert.alert('Success', 'Paystub sent to employee pay tab.');

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
        <Text style={styles.value}>{item.total_hours.toFixed(2)}</Text>
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
                  <Text style={styles.label}>Tax</Text>
                  <Text style={styles.value}>{currency(selected.tax)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Deductions</Text>
                  <Text style={styles.value}>{currency(selected.deductions)}</Text>
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
                  {busy ? 'Sending...' : 'Send to Employee Pay Tab'}
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