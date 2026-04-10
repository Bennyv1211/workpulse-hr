import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import Logo from '../../src/components/EmploraLogo.png';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showTermsPreview, setShowTermsPreview] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      const signedInUser = await login(email.trim(), password, rememberMe);

      if (signedInUser.role === 'manager') {
        router.replace('/manager/dashboard');
        return;
      }

      if (
        signedInUser.role === 'hr_admin' ||
        signedInUser.role === 'super_admin' ||
        signedInUser.role === 'hr'
      ) {
        router.replace('/hr/dashboard');
        return;
      }

      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Image source={Logo} style={styles.logo} resizeMode="center" />
            <Text style={styles.tagline}>Smart Attendance & Workforce Management</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#64748B"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.rememberMeContainer}>
              <TouchableOpacity
                style={styles.rememberMeRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                </View>
                <Text style={styles.rememberMeText}>Remember me</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.hrLoginButton}
              onPress={() => router.push('/(auth)/hr-login')}
            >
              <Ionicons name="briefcase-outline" size={16} color="#3B82F6" />
              <Text style={styles.hrLoginText}>HR / Admin Login</Text>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don&apos;t have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <TouchableOpacity>
                  <Text style={styles.registerLink}>Sign Up</Text>
                </TouchableOpacity>
              </Link>
            </View>

            <View style={styles.termsCard}>
              <TouchableOpacity
                onPress={() => setShowTermsPreview(!showTermsPreview)}
                style={styles.termsToggle}
                activeOpacity={0.8}
              >
                <Text style={styles.termsToggleText}>Terms & Privacy</Text>
                <Ionicons
                  name={showTermsPreview ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#475569"
                />
              </TouchableOpacity>

              {showTermsPreview && (
                <View style={styles.termsPreviewBody}>
                  <Text style={styles.termsPreviewText}>
                    We collect account, employee, attendance, leave, payroll, paystub, session, and optional GPS
                    attendance data only to run Emplora securely and make the app function.
                  </Text>
                  <TouchableOpacity onPress={() => setShowTerms(true)} style={styles.termsReadMoreButton}>
                    <Text style={styles.termsReadMoreText}>Read full Terms & Privacy</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          <View style={styles.demoInfo}>
            <Text style={styles.demoTitle}>Test Accounts</Text>
            <Text style={styles.demoText}>(HR) hr@company.com</Text>
            <Text style={styles.demoText}>(Manager) manager@company.com</Text>
            <Text style={styles.demoText}>(Employee) employee@company.com</Text>
            <Text style={styles.demoPassword}>Password: Test123!</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showTerms} animationType="slide" onRequestClose={() => setShowTerms(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Terms & Privacy</Text>
            <TouchableOpacity onPress={() => setShowTerms(false)}>
              <Ionicons name="close" size={24} color="#0F172A" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalSectionTitle}>What Emplora collects</Text>
            <Text style={styles.modalBody}>
              We collect the information needed to run the workforce platform, including account details,
              employee profile information, attendance and shift records, leave requests, payroll and paystub
              records, device login/session information, and location data when a user clocks in, clocks out,
              or uses location-aware attendance features.
            </Text>

            <Text style={styles.modalSectionTitle}>Why we collect it</Text>
            <Text style={styles.modalBody}>
              This data is used only to provide the service: sign users in securely, manage employees and
              roles, process attendance and time tracking, review leave, generate payroll and paystubs,
              support manager and HR dashboards, create reports and backups, and keep records accurate across
              the mobile app and web dashboard.
            </Text>

            <Text style={styles.modalSectionTitle}>How your data is handled</Text>
            <Text style={styles.modalBody}>
              Emplora does not sell your data. We do not send your workforce data to third-party apps for
              advertising or resale. Data is used solely for app functionality, security, storage,
              infrastructure, and service delivery that supports the platform.
            </Text>

            <Text style={styles.modalSectionTitle}>Location and device data</Text>
            <Text style={styles.modalBody}>
              When enabled, GPS data may be collected during attendance actions so managers and HR can verify
              where a user clocked in or out. Device and session data may also be used to keep accounts secure
              and maintain reliable sign-in.
            </Text>

            <Text style={styles.modalSectionTitle}>Your acknowledgement</Text>
            <Text style={styles.modalBody}>
              By using Emplora, you acknowledge that this data is collected and processed for workforce
              management functionality only. If your organization has internal policies about employee data,
              those policies should also be followed by administrators using this platform.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 320,
    height: 120,
    marginBottom: 16,
  },
  tagline: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#1E293B',
  },
  eyeButton: {
    padding: 8,
  },
  rememberMeContainer: {
    marginBottom: 16,
  },
  rememberMeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  rememberMeText: {
    fontSize: 14,
    color: '#475569',
  },
  loginButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  hrLoginButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  hrLoginText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    fontSize: 14,
    color: '#64748B',
  },
  registerLink: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  termsButton: {
    marginTop: 18,
    alignItems: 'center',
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
    textAlign: 'center',
  },
  termsCard: {
    marginTop: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  termsToggle: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  termsToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  termsPreviewBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  termsPreviewText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#475569',
  },
  termsReadMoreButton: {
    marginTop: 10,
  },
  termsReadMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  demoInfo: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginBottom: 8,
  },
  demoText: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  demoPassword: {
    fontSize: 12,
    color: '#3B82F6',
    marginTop: 6,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalContent: {
    padding: 20,
    gap: 14,
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
});
