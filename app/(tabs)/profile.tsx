import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import AppIcon from '../../src/components/AppIcon';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/(auth)/login');
          },
        },
      ]
    );
  };

  const MenuItem = ({ icon, label, onPress, showArrow = true, color = '#3B82F6', danger = false }: any) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: danger ? '#FEE2E2' : color + '15' }]}>
        <AppIcon name={icon} size={22} color={danger ? '#EF4444' : color} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: '#EF4444' }]}>{label}</Text>
      {showArrow && <Text style={styles.chevron}>{'>'}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.first_name} {user?.last_name}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="edit-profile"
              label="Edit Profile"
              onPress={() => router.push('/edit-profile')}
              color="#3B82F6"
            />
            <MenuItem
              icon="change-password"
              label="Change Password"
              onPress={() => router.push('/change-password')}
              color="#8B5CF6"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="help"
              label="Help & Support"
              onPress={() => Alert.alert('Help', 'Contact your HR department for assistance.')}
              color="#10B981"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="logout"
              label="Logout"
              onPress={handleLogout}
              showArrow={false}
              danger
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Emplora v2.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  profileHeader: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  profileEmail: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  footerText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  chevron: {
    fontSize: 24,
    lineHeight: 24,
    color: '#CBD5E1',
    marginLeft: 12,
  },
});
