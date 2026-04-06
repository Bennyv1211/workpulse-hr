import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

export default function HRDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();

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

  const DashboardCard = ({
    title,
    subtitle,
    icon,
    color,
    onPress,
  }: {
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    onPress: () => void;
  }) => (
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
    marginBottom: 24,
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
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  logoutButton: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#EF4444',
  },
});