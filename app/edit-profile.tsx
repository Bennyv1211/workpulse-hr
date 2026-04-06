import React, { useState, useEffect, memo } from 'react';
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
  TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const RAW_API_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

type FormDataType = {
  first_name: string;
  last_name: string;
  phone: string;
  next_of_kin_name: string;
  next_of_kin_phone: string;
  next_of_kin_relationship: string;
};

type InputFieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: TextInputProps['keyboardType'];
  icon?: keyof typeof Ionicons.glyphMap;
};

const InputField = memo(function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  icon,
}: InputFieldProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color="#64748B"
            style={styles.inputIcon}
          />
        ) : null}

        <TextInput
          style={[styles.input, icon ? { paddingLeft: 0 } : null]}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          autoCapitalize="words"
          autoCorrect={false}
          blurOnSubmit={false}
          returnKeyType="next"
        />
      </View>
    </View>
  );
});

export default function EditProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState<FormDataType>({
    first_name: '',
    last_name: '',
    phone: '',
    next_of_kin_name: '',
    next_of_kin_phone: '',
    next_of_kin_relationship: '',
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setIsLoading(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/employees/me`, { headers });

      if (response.ok) {
        const data = await response.json();

        setFormData({
          first_name: data.first_name || user?.first_name || '',
          last_name: data.last_name || user?.last_name || '',
          phone: data.phone || '',
          next_of_kin_name: data.next_of_kin_name || '',
          next_of_kin_phone: data.next_of_kin_phone || '',
          next_of_kin_relationship: data.next_of_kin_relationship || '',
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          first_name: user?.first_name || '',
          last_name: user?.last_name || '',
        }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);

      setFormData((prev) => ({
        ...prev,
        first_name: user?.first_name || '',
        last_name: user?.last_name || '',
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field: keyof FormDataType, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    setIsSaving(true);

    try {
      const token = await AsyncStorage.getItem('auth_token');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_URL}/api/employees/me`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        Alert.alert('Success', 'Profile updated successfully', [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]);
      } else {
        const raw = await response.text();
        let errorData: any = null;

        try {
          errorData = raw ? JSON.parse(raw) : null;
        } catch {
          errorData = { detail: raw || 'Failed to update profile' };
        }

        Alert.alert('Error', errorData?.detail || 'Failed to update profile');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Edit Profile</Text>

          <TouchableOpacity
            onPress={handleSave}
            disabled={isSaving}
            style={styles.saveButton}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>

            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <InputField
                    label="First Name *"
                    value={formData.first_name}
                    onChangeText={(text) => updateField('first_name', text)}
                    placeholder="John"
                    icon="person-outline"
                  />
                </View>

                <View style={styles.halfInput}>
                  <InputField
                    label="Last Name *"
                    value={formData.last_name}
                    onChangeText={(text) => updateField('last_name', text)}
                    placeholder="Doe"
                  />
                </View>
              </View>

              <InputField
                label="Phone Number"
                value={formData.phone}
                onChangeText={(text) => updateField('phone', text)}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
                icon="call-outline"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact (Next of Kin)</Text>

            <View style={styles.card}>
              <InputField
                label="Contact Name"
                value={formData.next_of_kin_name}
                onChangeText={(text) => updateField('next_of_kin_name', text)}
                placeholder="Jane Doe"
                icon="people-outline"
              />

              <InputField
                label="Contact Phone"
                value={formData.next_of_kin_phone}
                onChangeText={(text) => updateField('next_of_kin_phone', text)}
                placeholder="(555) 987-6543"
                keyboardType="phone-pad"
                icon="call-outline"
              />

              <InputField
                label="Relationship"
                value={formData.next_of_kin_relationship}
                onChangeText={(text) => updateField('next_of_kin_relationship', text)}
                placeholder="Spouse, Parent, Sibling, etc."
                icon="heart-outline"
              />
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
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
    height: 48,
    fontSize: 16,
    color: '#1E293B',
  },
});