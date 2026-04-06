import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

interface PaystubItem {
  id: string;
  employee_id: string;
  employee_name?: string;
  employee_code?: string;
  pay_period_start: string;
  pay_period_end: string;
  gross_pay: number;
  net_pay: number;
  status?: string;
  pdf_filename?: string;
  pay_date?: string;
  created_at?: string;
  selected?: boolean;
}

export default function SendPaystubsScreen() {
  const [paystubs, setPaystubs] = useState<PaystubItem[]>([]);
  const [filteredPaystubs, setFilteredPaystubs] = useState<PaystubItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchPaystubs();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [search, paystubs]);

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

  const fetchPaystubs = async () => {
    try {
      setLoading(true);

      // Assumes your backend returns payroll records that will act as paystubs to send
      const data = await apiRequest('/api/payroll');

      const mapped: PaystubItem[] = (Array.isArray(data) ? data : []).map((item: any) => ({
        id: item.id,
        employee_id: item.employee_id,
        employee_name: item.employee_name,
        employee_code: item.employee_code,
        pay_period_start: item.pay_period_start,
        pay_period_end: item.pay_period_end,
        gross_pay: Number(item.gross_pay || 0),
        net_pay: Number(item.net_pay || 0),
        status: item.status || 'pending',
        pdf_filename: item.pdf_filename,
        pay_date: item.pay_date,
        created_at: item.created_at,
        selected: false,
      }));

      setPaystubs(mapped);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load paystubs');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchPaystubs();
    } finally {
      setRefreshing(false);
    }
  }, []);

  const applyFilter = () => {
    const term = search.trim().toLowerCase();

    if (!term) {
      setFilteredPaystubs(paystubs);
      return;
    }

    const filtered = paystubs.filter((item) => {
      const name = item.employee_name?.toLowerCase() || '';
      const code = item.employee_code?.toLowerCase() || '';
      const start = item.pay_period_start?.toLowerCase() || '';
      const end = item.pay_period_end?.toLowerCase() || '';
      const status = item.status?.toLowerCase() || '';

      return (
        name.includes(term) ||
        code.includes(term) ||
        start.includes(term) ||
        end.includes(term) ||
        status.includes(term)
      );
    });

    setFilteredPaystubs(filtered);
  };

  const formatCurrency = (amount: number) => {
    return `R ${amount.toFixed(2)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const toggleSelect = (id: string) => {
    setPaystubs((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleSelectAll = () => {
    const visibleIds = new Set(filteredPaystubs.map((item) => item.id));
    const allVisibleSelected =
      filteredPaystubs.length > 0 &&
      filteredPaystubs.every((item) => item.selected);

    setPaystubs((prev) =>
      prev.map((item) =>
        visibleIds.has(item.id)
          ? { ...item, selected: !allVisibleSelected }
          : item
      )
    );
  };

  const selectedItems = useMemo(
    () => paystubs.filter((item) => item.selected),
    [paystubs]
  );

  const handleSendSelected = async () => {
    if (selectedItems.length === 0) {
      Alert.alert('No Selection', 'Please select at least one paystub to send.');
      return;
    }

    Alert.alert(
      'Send Paystubs',
      `Send ${selectedItems.length} paystub${selectedItems.length === 1 ? '' : 's'} to employees?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            try {
              setSending(true);

              // This assumes you add a backend route like POST /api/paystubs/send
              // Body example:
              // { paystub_ids: ["id1", "id2"] }
              await apiRequest('/api/paystubs/send', 'POST', {
                paystub_ids: selectedItems.map((item) => item.id),
              });

              Alert.alert('Success', 'Selected paystubs have been sent.');
              setPaystubs((prev) =>
                prev.map((item) =>
                  item.selected
                    ? { ...item, selected: false, status: 'sent' }
                    : item
                )
              );
            } catch (error: any) {
              Alert.alert(
                'Send Failed',
                error.message ||
                  'Your backend route for sending paystubs is not ready yet.'
              );
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  const handlePreview = async (item: PaystubItem) => {
    try {
      // Optional preview/download route
      // Change if your backend uses another route
      const token = await AsyncStorage.getItem('auth_token');
      const url = `${API_URL}/api/paystubs/${item.id}/download`;

      Alert.alert(
        'Paystub Preview',
        `Preview/download endpoint:\n${url}\n\nIf this does not work yet, your backend download route still needs to be connected.`,
        [{ text: 'OK' }]
      );

      console.log('Preview token exists:', !!token);
      console.log('Preview URL:', url);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not prepare preview');
    }
  };

  const renderItem = ({ item }: { item: PaystubItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.9}
      onPress={() => toggleSelect(item.id)}
    >
      <View style={styles.cardTopRow}>
        <TouchableOpacity
          style={[
            styles.checkbox,
            item.selected && styles.checkboxSelected,
          ]}
          onPress={() => toggleSelect(item.id)}
        >
          {item.selected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </TouchableOpacity>

        <View style={styles.cardMain}>
          <Text style={styles.employeeName}>
            {item.employee_name || 'Unknown Employee'}
          </Text>
          <Text style={styles.employeeMeta}>
            {item.employee_code || item.employee_id}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            item.status === 'sent'
              ? styles.statusSent
              : item.status === 'paid'
                ? styles.statusPaid
                : styles.statusPending,
          ]}
        >
          <Text
            style={[
              styles.statusText,
              item.status === 'sent'
                ? styles.statusSentText
                : item.status === 'paid'
                  ? styles.statusPaidText
                  : styles.statusPendingText,
            ]}
          >
            {(item.status || 'pending').toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.periodRow}>
        <Ionicons name="calendar-outline" size={16} color="#64748B" />
        <Text style={styles.periodText}>
          {formatDate(item.pay_period_start)} - {formatDate(item.pay_period_end)}
        </Text>
      </View>

      <View style={styles.amountRow}>
        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Gross</Text>
          <Text style={styles.amountValue}>{formatCurrency(item.gross_pay)}</Text>
        </View>

        <View style={styles.amountBox}>
          <Text style={styles.amountLabel}>Net</Text>
          <Text style={styles.amountValue}>{formatCurrency(item.net_pay)}</Text>
        </View>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => handlePreview(item)}
        >
          <Ionicons name="document-text-outline" size={18} color="#3B82F6" />
          <Text style={styles.secondaryButtonText}>Preview</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => toggleSelect(item.id)}
        >
          <Ionicons
            name={item.selected ? 'remove-circle-outline' : 'add-circle-outline'}
            size={18}
            color="#3B82F6"
          />
          <Text style={styles.secondaryButtonText}>
            {item.selected ? 'Unselect' : 'Select'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Send Paystubs</Text>
        <Text style={styles.headerSubtitle}>
          Select saved paystubs and send them to employees
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={20} color="#94A3B8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search employee, code, period, status"
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolbarButton} onPress={toggleSelectAll}>
          <Ionicons name="checkmark-done-outline" size={18} color="#3B82F6" />
          <Text style={styles.toolbarButtonText}>
            {filteredPaystubs.length > 0 &&
            filteredPaystubs.every((item) => item.selected)
              ? 'Unselect All'
              : 'Select All'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.selectedText}>
          {selectedItems.length} selected
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.centerStateText}>Loading paystubs...</Text>
        </View>
      ) : filteredPaystubs.length === 0 ? (
        <View style={styles.centerState}>
          <Ionicons name="mail-open-outline" size={60} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No paystubs found</Text>
          <Text style={styles.emptyText}>
            Create payroll records first, then they will appear here for sending.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredPaystubs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.sendButton,
            (sending || selectedItems.length === 0) && styles.sendButtonDisabled,
          ]}
          disabled={sending || selectedItems.length === 0}
          onPress={handleSendSelected}
        >
          {sending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send-outline" size={20} color="#FFFFFF" />
              <Text style={styles.sendButtonText}>
                Send Paystubs ({selectedItems.length})
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  toolbar: {
    marginTop: 12,
    marginHorizontal: 20,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  selectedText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  listContent: {
    padding: 20,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  cardMain: {
    flex: 1,
  },
  employeeName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  employeeMeta: {
    marginTop: 2,
    fontSize: 13,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusPaid: {
    backgroundColor: '#DBEAFE',
  },
  statusSent: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  statusPendingText: {
    color: '#B45309',
  },
  statusPaidText: {
    color: '#1D4ED8',
  },
  statusSentText: {
    color: '#15803D',
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  periodText: {
    fontSize: 14,
    color: '#475569',
  },
  amountRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  amountBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
  },
  amountLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  centerStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#334155',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sendButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});