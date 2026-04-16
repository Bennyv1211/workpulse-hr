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
import { useTheme } from '../../src/context/ThemeContext';
import AppIcon from '../../src/components/AppIcon';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
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
    <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.border }]} onPress={onPress}>
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: danger ? (isDark ? '#451A1A' : '#FEE2E2') : `${color}20` },
        ]}
      >
        <AppIcon name={icon} size={22} color={danger ? '#EF4444' : color} />
      </View>
      <Text style={[styles.menuLabel, { color: colors.text }, danger && { color: '#EF4444' }]}>{label}</Text>
      {showArrow && <Text style={[styles.chevron, { color: colors.textMuted }]}>{'>'}</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={[styles.profileHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.first_name} {user?.last_name}</Text>
          <Text style={[styles.profileEmail, { color: colors.textMuted }]}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
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
          <View style={[styles.themeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.themeTextWrap}>
              <Text style={[styles.themeTitle, { color: colors.text }]}>Theme</Text>
              <Text style={[styles.themeSubtitle, { color: colors.textMuted }]}>
                Switch between light and dark mode
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.themeToggle,
                { backgroundColor: isDark ? colors.primary : colors.primarySoft },
              ]}
              onPress={toggleTheme}
              activeOpacity={0.85}
            >
              <Text style={styles.themeToggleText}>{isDark ? 'Dark' : 'Light'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
            <MenuItem
              icon="help"
              label="Help & Support"
              onPress={() => Alert.alert('Help', 'Contact your HR department for assistance.')}
              color="#10B981"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={[styles.menuCard, { backgroundColor: colors.surface }]}>
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
          <Text style={[styles.footerText, { color: colors.textMuted }]}>Emplora v2.0</Text>
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
  },
  themeCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeTextWrap: {
    flex: 1,
    paddingRight: 16,
  },
  themeTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  themeSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  themeToggle: {
    minWidth: 88,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  themeToggleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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
