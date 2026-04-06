import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useHRStore } from '../../src/store/hrStore';

export default function PayrollHistoryScreen() {
  const router = useRouter();
  const { payroll, fetchPayroll, isLoading } = useHRStore();

  useEffect(() => {
    fetchPayroll();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payroll History</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={payroll}
          keyExtractor={(item) => item.id}
          contentContainerStyle={payroll.length === 0 ? styles.center : styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No payroll records found</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push(`/payroll/${item.id}`)}>
              <View>
                <Text style={styles.title}>
                  {item.pay_period_start} → {item.pay_period_end}
                </Text>
                <Text style={styles.sub}>{item.job_title || 'Payroll record'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.amount}>${Number(item.net_pay || 0).toFixed(2)}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16 },
  emptyText: { color: '#64748B', fontSize: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  sub: { fontSize: 13, color: '#64748B', marginTop: 4 },
  amount: { fontSize: 16, fontWeight: '700', color: '#10B981' },
  status: { fontSize: 12, color: '#64748B', marginTop: 4, textTransform: 'capitalize' },
});