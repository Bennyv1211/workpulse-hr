import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth, API_URL } from '../src/context/AuthContext';
import { useHRStore } from '../src/store/hrStore';

export default function PersonalInfoScreen() {
  const router = useRouter();
  const { user, token } = useAuth();
  const { employees, fetchEmployees } = useHRStore();

  const employee = useMemo(
    () => employees.find((e) => e.email === user?.email),
    [employees, user]
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });

  useEffect(() => {
    const init = async () => {
      await fetchEmployees();
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!employee) return;

    setForm({
      first_name: employee.first_name || '',
      last_name: employee.last_name || '',
      phone: employee.phone || '',
      address: employee.address || '',
      emergency_contact_name: employee.emergency_contact?.name || '',
      emergency_contact_phone: employee.emergency_contact?.phone || '',
    });
  }, [employee]);

  const saveProfile = async () => {
    setSaving(true);

    try {
      const res = await fetch(`${API_URL}/api/employees/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          first_name: form.first_name,
          last_name: form.last_name,
          phone: form.phone,
          address: form.address,
          emergency_contact: {
            name: form.emergency_contact_name,
            phone: form.emergency_contact_phone,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || 'Failed to save profile');
      }

      Alert.alert('Success', 'Your information was updated');
      await fetchEmployees();
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    label,
    value,
    onChangeText,
    multiline = false,
  }: {
    label: string;
    value: string;
    onChangeText: (text: string) => void;
    multiline?: boolean;
  }) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Basic Information</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Field
          label="First Name"
          value={form.first_name}
          onChangeText={(v) => setForm({ ...form, first_name: v })}
        />

        <Field
          label="Last Name"
          value={form.last_name}
          onChangeText={(v) => setForm({ ...form, last_name: v })}
        />

        <Field
          label="Phone"
          value={form.phone}
          onChangeText={(v) => setForm({ ...form, phone: v })}
        />

        <Field
          label="Address"
          value={form.address}
          onChangeText={(v) => setForm({ ...form, address: v })}
          multiline
        />

        <Text style={styles.sectionTitle}>Next of Kin</Text>

        <Field
          label="Name"
          value={form.emergency_contact_name}
          onChangeText={(v) => setForm({ ...form, emergency_contact_name: v })}
        />

        <Field
          label="Phone"
          value={form.emergency_contact_phone}
          onChangeText={(v) => setForm({ ...form, emergency_contact_phone: v })}
        />

        <TouchableOpacity
          style={styles.saveButton}
          onPress={saveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveText}>Save Changes</Text>
          )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 10,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  saveButton: {
    marginTop: 20,
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});