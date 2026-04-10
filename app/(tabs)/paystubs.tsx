import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Sharing from 'expo-sharing';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import AppIcon from '../../src/components/AppIcon';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

interface Paystub {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date?: string;
  gross_pay: number;
  net_pay: number;
  pdf_filename?: string;
  file_name?: string;
  pdf_url?: string;
  pdf_base64?: string;
}

export default function PaystubsScreen() {
  const [paystubs, setPaystubs] = useState<Paystub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPaystubs();
  }, []);

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
    let data: any = [];

    try {
      data = raw ? JSON.parse(raw) : [];
    } catch {
      data = [];
    }

    if (!response.ok) {
      throw new Error(data?.detail || data?.message || 'Request failed');
    }

    return data;
  };

  const fetchPaystubs = async () => {
    try {
      setIsLoading(true);

      let data: any[] = [];
      try {
        data = await apiRequest('/api/paystubs/me');
      } catch {
        data = await apiRequest('/api/paystubs');
      }

      setPaystubs(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.log('Fetch paystubs error:', error);
      Alert.alert('Error', error.message || 'Failed to load paystubs');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPaystubs();
    setRefreshing(false);
  }, []);

  const saveAndShareBase64Pdf = async (paystub: Paystub) => {
    try {
      if (!paystub.pdf_base64) {
        Alert.alert('Error', 'No PDF available for this paystub');
        return;
      }

      const fileName =
        paystub.file_name ||
        paystub.pdf_filename ||
        `paystub-${paystub.id}.pdf`;

      const fileUri = `${FileSystemLegacy.documentDirectory}${fileName}`;

      await FileSystemLegacy.writeAsStringAsync(fileUri, paystub.pdf_base64, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Open Paystub PDF',
        UTI: '.pdf',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to open PDF');
    }
  };

  const handleDownload = async (paystub: Paystub) => {
    try {
      const token = await getToken();

      if (paystub.pdf_base64) {
        await saveAndShareBase64Pdf(paystub);
        return;
      }

      const cacheDirectory = FileSystemLegacy.cacheDirectory;
      if (!cacheDirectory) {
        throw new Error('Temporary file storage is not available on this device.');
      }

      const safeName = (paystub.pdf_filename || `paystub-${paystub.id}.pdf`).replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );
      const fileUri = `${cacheDirectory}${safeName}`;

      await FileSystemLegacy.downloadAsync(
        `${API_URL}/api/paystubs/${paystub.id}/download`,
        fileUri,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Saved', `Paystub downloaded to:\n${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Download Paystub PDF',
        UTI: '.pdf',
      });
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download paystub');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(amount || 0));
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    return `${startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} - ${endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`;
  };

  const formatPayDate = (payDate?: string) => {
    if (!payDate) return 'Pay date unavailable';

    return new Date(payDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderPaystub = ({ item }: { item: Paystub }) => (
    <TouchableOpacity style={styles.paystubCard} onPress={() => handleDownload(item)}>
      <View style={styles.paystubIcon}>
        <AppIcon name="paystubs" size={26} color="#3B82F6" />
      </View>

      <View style={styles.paystubContent}>
        <Text style={styles.paystubPeriod}>
          {formatDateRange(item.pay_period_start, item.pay_period_end)}
        </Text>

        <Text style={styles.payDate}>Paid: {formatPayDate(item.pay_date)}</Text>

        <View style={styles.payAmounts}>
          <Text style={styles.netPay}>{formatCurrency(item.net_pay)}</Text>
          <Text style={styles.grossPay}>
            Gross: {formatCurrency(item.gross_pay)}
          </Text>
        </View>
      </View>

      <View style={styles.downloadIcon}>
        <Ionicons name="download-outline" size={24} color="#64748B" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Paystubs</Text>
      </View>

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : paystubs.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="wallet-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No Paystubs Yet</Text>
          <Text style={styles.emptyText}>Your paystubs will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={paystubs}
          keyExtractor={(item) => item.id}
          renderItem={renderPaystub}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
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
  paystubCard: {
    flexDirection: 'row',
    alignItems: 'center',
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
  paystubIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  paystubContent: {
    flex: 1,
  },
  paystubPeriod: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  payDate: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  payAmounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  netPay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  grossPay: {
    fontSize: 13,
    color: '#94A3B8',
  },
  downloadIcon: {
    padding: 8,
  },
});
