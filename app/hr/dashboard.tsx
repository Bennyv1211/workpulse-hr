import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { API_URL } from '../../src/context/AuthContext';

type DashboardCardProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
};

export default function HRDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    if (
      user &&
      user.role !== 'super_admin' &&
      user.role !== 'hr_admin' &&
      user.role !== 'manager' &&
      user.role !== 'hr'
    ) {
      router.replace('/(tabs)/dashboard');
    }
  }, [user, router]);

  const canSeedDemoData = useMemo(
    () => user?.role === 'super_admin' || user?.role === 'hr_admin' || user?.role === 'hr',
    [user?.role]
  );

  const getToken = async () => {
    const authToken = await AsyncStorage.getItem('auth_token');
    if (authToken) return authToken;
    return await AsyncStorage.getItem('token');
  };

  const handleSeedDemoData = () => {
    Alert.alert(
      'Seed Demo Data',
      'This will add demo records for testing. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Data',
          onPress: async () => {
            try {
              setSeeding(true);
              const token = await getToken();
              const response = await fetch(`${API_URL}/api/seed-data`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
              });

              const raw = await response.text();
              let data: any = null;

              try {
                data = raw ? JSON.parse(raw) : null;
              } catch {
                data = { detail: raw || 'Seed request failed' };
              }

              if (!response.ok) {
                throw new Error(data?.detail || data?.message || 'Failed to seed demo data');
              }

              Alert.alert(
                'Success',
                data?.message || 'Demo data added successfully. Refresh the pages to view it.'
              );
            } catch (error: any) {
              Alert.alert('Seed Failed', error.message || 'Could not seed demo data');
            } finally {
              setSeeding(false);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/hr-login');
        },
      },
    ]);
  };

  const DashboardCard = ({ title, subtitle, icon, color, onPress }: DashboardCardProps) => (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.cardIcon, { backgroundColor: `${color}15` }]}>
        <Ionicons name={icon} size={26} color={color} />
      </View>

      <View style={styles.cardTextWrap}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.welcome}>HR Dashboard</Text>
          <Text style={styles.subheading}>
            Welcome back, {user?.first_name || 'Admin'}
          </Text>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summaryLabel}>Signed in as</Text>
              <Text style={styles.summaryName}>
                {user?.first_name} {user?.last_name}
              </Text>
            </View>

            <View style={styles.roleBadge}>
              <Text style={styles.roleBadgeText}>{user?.role || 'admin'}</Text>
            </View>
          </View>

          <Text style={styles.summaryText}>
            Manage employees, payroll, paystubs, and leave requests from one place.
          </Text>
        </View>

        {canSeedDemoData && (
          <View style={styles.seedCard}>
            <View style={styles.seedTextWrap}>
              <Text style={styles.seedTitle}>Seed demo data</Text>
              <Text style={styles.seedSubtitle}>
                Add test employees, attendance, payroll, and leave data for quick end-to-end testing.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.seedButton, seeding && styles.seedButtonDisabled]}
              onPress={handleSeedDemoData}
              disabled={seeding}
              activeOpacity={0.85}
            >
              {seeding ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="flask-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.seedButtonText}>Seed Demo Data</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management</Text>

          <DashboardCard
            title="Employees"
            subtitle="View and manage all employees"
            icon="people-outline"
            color="#3B82F6"
            onPress={() => router.push('/hr/employees')}
          />

          <DashboardCard
            title="Add Employee"
            subtitle="Create a new employee record"
            icon="person-add-outline"
            color="#10B981"
            onPress={() => router.push('/hr/employee-new')}
          />

          <DashboardCard
            title="Payroll"
            subtitle="Calculate and manage payroll"
            icon="cash-outline"
            color="#8B5CF6"
            onPress={() => router.push('/hr/payroll')}
          />

          <DashboardCard
            title="Paystubs"
            subtitle="Review and publish employee paystubs"
            icon="document-text-outline"
            color="#F59E0B"
            onPress={() => router.push('/hr/paystubs')}
          />

          <DashboardCard
            title="Leave Requests"
            subtitle="Review employee leave requests"
            icon="calendar-outline"
            color="#EF4444"
            onPress={() => router.push('/hr/leave-requests')}
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  welcome: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1E293B',
  },
  subheading: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  summaryName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  roleBadgeText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  summaryText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  seedCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    gap: 14,
  },
  seedTextWrap: {
    gap: 6,
  },
  seedTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  seedSubtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  seedButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  seedButtonDisabled: {
    opacity: 0.75,
  },
  seedButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  section: {
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  logoutButton: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 15,
  },
});
