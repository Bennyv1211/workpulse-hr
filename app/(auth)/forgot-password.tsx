import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

const RAW_API_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const requestJson = async (endpoint: string, body: Record<string, string>) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;
    if (!response.ok) {
      throw new Error(data?.detail || 'Request failed');
    }
    return data;
  };

  const handleRequestQuestion = async () => {
    setLoading(true);
    try {
      const data = await requestJson('/api/auth/forgot-password', { email: email.trim() });
      setQuestion(data.security_question);
    } catch (error: any) {
      Alert.alert('Unable to continue', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAnswer = async () => {
    setLoading(true);
    try {
      const data = await requestJson('/api/auth/verify-security-answer', {
        email: email.trim(),
        security_answer: answer.trim(),
      });
      setResetToken(data.reset_token);
    } catch (error: any) {
      Alert.alert('Verification failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    try {
      await requestJson('/api/auth/reset-password', {
        email: email.trim(),
        reset_token: resetToken,
        new_password: newPassword,
      });
      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (error: any) {
      Alert.alert('Reset failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Ionicons name="arrow-back" size={20} color="#0F172A" />
            <Text style={styles.backText}>Back to sign in</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>
            Verify your security question, then choose a new password.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@company.com" />
            {!question && (
              <TouchableOpacity style={styles.primaryButton} onPress={handleRequestQuestion} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Show Security Question</Text>}
              </TouchableOpacity>
            )}

            {!!question && !resetToken && (
              <>
                <Text style={styles.label}>Security Question</Text>
                <View style={styles.questionCard}>
                  <Text style={styles.questionText}>{question}</Text>
                </View>
                <Text style={styles.label}>Answer</Text>
                <TextInput style={styles.input} value={answer} onChangeText={setAnswer} placeholder="Enter your answer" />
                <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyAnswer} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Verify Answer</Text>}
                </TouchableOpacity>
              </>
            )}

            {!!resetToken && (
              <>
                <Text style={styles.label}>New Password</Text>
                <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="Minimum 8 chars, uppercase, number, special" />
                <TouchableOpacity style={styles.primaryButton} onPress={handleResetPassword} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Reset Password</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  flex: { flex: 1 },
  content: { padding: 24, paddingTop: 20, gap: 18 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { color: '#334155', fontWeight: '600' },
  title: { fontSize: 30, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#64748B', lineHeight: 22 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  label: { fontWeight: '700', color: '#0F172A' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: '#0F172A', backgroundColor: '#FFFFFF' },
  questionCard: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 16 },
  questionText: { color: '#1E3A8A', fontWeight: '600' },
  primaryButton: { marginTop: 8, backgroundColor: '#2563EB', paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '700' },
});
