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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || 
  'https://workpulse-hr.onrender.com';

interface Paystub {
  id: string;
  pay_period_start: string;
  pay_period_end: string;
  pay_date: string;
  gross_pay: number;
  net_pay: number;
  pdf_filename: string;
  pdf_url?: string;
}

export default function PaystubsScreen() {
  const [paystubs, setPaystubs] = useState<Paystub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchPaystubs();
  }, []);

  const apiRequest = async (endpoint: string) => {
    const token = await AsyncStorage.getItem('auth_token');
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || 'Request failed');
    }
    
    return response.json();
  };

  const fetchPaystubs = async () => {
    try {
      const data = await apiRequest('/api/paystubs');
      setPaystubs(data);
    } catch (error) {
      console.log('Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPaystubs();
    setRefreshing(false);
  }, []);

  const handleDownload = async (paystub: Paystub) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      const downloadUrl = `${API_URL}/api/paystubs/${paystub.id}/download?token=${token}`;
      
      const supported = await Linking.canOpenURL(downloadUrl);
      if (supported) {
        await Linking.openURL(downloadUrl);
      } else {
        Alert.alert('Error', 'Cannot open download link');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to download paystub');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  };

  const renderPaystub = ({ item }: { item: Paystub }) => (
    <TouchableOpacity
      style={styles.paystubCard}
      onPress={() => handleDownload(item)}
    >
      <View style={styles.paystubIcon}>
        <Ionicons name="document-text" size={28} color="#3B82F6" />
      </View>
      
      <View style={styles.paystubContent}>
        <Text style={styles.paystubPeriod}>
          {formatDateRange(item.pay_period_start, item.pay_period_end)}
        </Text>
        <Text style={styles.payDate}>
          Paid: {new Date(item.pay_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
        <View style={styles.payAmounts}>
          <Text style={styles.netPay}>{formatCurrency(item.net_pay)}</Text>
          <Text style={styles.grossPay}>Gross: {formatCurrency(item.gross_pay)}</Text>
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
