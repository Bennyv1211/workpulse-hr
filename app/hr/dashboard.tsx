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
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { API_URL, useAuth } from '../../src/context/AuthContext';
import AppIcon from '../../src/components/AppIcon';
import { Ionicons } from '@expo/vector-icons';

type DashboardCardProps = {
  title: string;
  subtitle: string;
  icon: 'employees' | 'add-employee' | 'payroll' | 'paystubs' | 'leave-requests';
  color: string;
  onPress: () => void;
};

export default function HRDashboardScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [backingUp, setBackingUp] = useState(false);

  useEffect(() => {
    if (user?.role === 'manager') {
      router.replace('/manager/dashboard');
      return;
    }

    if (
      user &&
      user.role !== 'super_admin' &&
      user.role !== 'hr_admin' &&
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

  const flattenExportRow = (row: any) => {
    const flat: Record<string, string | number | boolean> = {};

    Object.entries(row || {}).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        flat[key] = '';
      } else if (Array.isArray(value) || typeof value === 'object') {
        flat[key] = JSON.stringify(value);
      } else {
        flat[key] = value as string | number | boolean;
      }
    });

    return flat;
  };

  const handleBackupExport = async () => {
    try {
      setBackingUp(true);
      const token = await getToken();
      const response = await fetch(`${API_URL}/api/admin/backup`, {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : null;

      if (!response.ok) {
        throw new Error(data?.detail || data?.message || 'Failed to export backup');
      }

      const workbook = XLSX.utils.book_new();
      const collections = data?.collections || {};

      Object.entries(collections).forEach(([sheetName, records]) => {
        const rows = Array.isArray(records)
          ? (records as any[]).map(flattenExportRow)
          : [];

        const worksheet = XLSX.utils.json_to_sheet(
          rows.length ? rows : [{ message: `No data found for ${sheetName}` }]
        );

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          String(sheetName).slice(0, 31)
        );
      });

      const wbout = XLSX.write(workbook, {
        type: 'base64',
        bookType: 'xlsx',
      });

      const cacheDirectory = FileSystemLegacy.cacheDirectory;
      if (!cacheDirectory) {
        throw new Error('Temporary file storage is not available on this device.');
      }

      const fileName = `workpulse-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;
      const fileUri = `${cacheDirectory}${fileName}`;

      await FileSystemLegacy.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystemLegacy.EncodingType.Base64,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('Backup Saved', `Backup file saved to:\n${fileUri}`);
        return;
      }

      await Sharing.shareAsync(fileUri, {
        mimeType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Save HR Backup Workbook',
        UTI: 'org.openxmlformats.spreadsheetml.sheet',
      });
    } catch (error: any) {
      Alert.alert('Backup Failed', error.message || 'Could not create backup export');
    } finally {
      setBackingUp(false);
    }
  };

  const DashboardCard = ({ title, subtitle, icon, color, onPress }: DashboardCardProps) => (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.cardIcon, { backgroundColor: `${color}15` }]}>
        <AppIcon name={icon} size={26} color={color} />
      </View>

      <View style={styles.cardTextWrap}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>

      <Text style={styles.chevron}>{'>'}</Text>
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
                  <AppIcon name="seed" size={18} color="#FFFFFF" />
                  <Text style={styles.seedButtonText}>Seed Demo Data</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.backupCard}>
          <View style={styles.backupTextWrap}>
            <Text style={styles.backupTitle}>Backup app data</Text>
            <Text style={styles.backupSubtitle}>
              Export employees, attendance, leave, payroll, paystubs, notifications, and logs into one Excel workbook.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.backupButton, backingUp && styles.seedButtonDisabled]}
            onPress={handleBackupExport}
            disabled={backingUp}
            activeOpacity={0.85}
          >
            {backingUp ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.seedButtonText}>Export Backup</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Management</Text>

          <DashboardCard
            title="Employees"
            subtitle="View and manage all employees"
            icon="employees"
            color="#3B82F6"
            onPress={() => router.push('/hr/employees')}
          />

          <DashboardCard
            title="Add Employee"
            subtitle="Create a new employee record"
            icon="add-employee"
            color="#10B981"
            onPress={() => router.push('/hr/employee-new')}
          />

          <DashboardCard
            title="Payroll"
            subtitle="Calculate and manage payroll"
            icon="payroll"
            color="#8B5CF6"
            onPress={() => router.push('/hr/payroll')}
          />

          <DashboardCard
            title="Paystubs"
            subtitle="Review and publish employee paystubs"
            icon="paystubs"
            color="#F59E0B"
            onPress={() => router.push('/hr/paystubs')}
          />

          <DashboardCard
            title="Leave Requests"
            subtitle="Review employee leave requests"
            icon="leave-requests"
            color="#EF4444"
            onPress={() => router.push('/hr/leave-requests')}
          />
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <AppIcon name="logout" size={20} color="#EF4444" />
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
  backupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    gap: 14,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  backupTextWrap: {
    gap: 6,
  },
  backupTitle: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '700',
  },
  backupSubtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 20,
  },
  backupButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
  chevron: {
    fontSize: 22,
    lineHeight: 22,
    color: '#CBD5E1',
    marginLeft: 12,
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
