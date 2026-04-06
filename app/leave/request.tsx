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
import { useHRStore } from '../../src/store/hrStore';
import { format } from 'date-fns';

export default function LeaveRequestScreen() {
  const router = useRouter();
  const { leaveTypes, fetchLeaveTypes, createLeaveRequest, isLoading } = useHRStore();

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reason, setReason] = useState('');
  const [halfDay, setHalfDay] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  useEffect(() => {
    if (leaveTypes.length > 0 && !selectedType && leaveTypes[0]?.id) {
      setSelectedType(String(leaveTypes[0].id));
    }
  }, [leaveTypes, selectedType]);

  const selectedLeaveType = useMemo(() => {
    return leaveTypes.find((lt) => String(lt.id) === String(selectedType)) || null;
  }, [leaveTypes, selectedType]);

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select a leave type');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    try {
      await createLeaveRequest({
        leave_type_id: String(selectedType),
        start_date: startDate,
        end_date: endDate,
        reason: reason.trim() || undefined,
        half_day: halfDay,
      });

      Alert.alert('Success', 'Leave request submitted successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to submit leave request');
    }
  };

  const DateInput = ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.dateInputContainer}>
        <Ionicons name="calendar-outline" size={20} color="#64748B" />
        <TextInput
          style={styles.dateInput}
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94A3B8"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="close" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Request Time Off</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Leave Type</Text>

          {leaveTypes.length === 0 ? (
            <View style={styles.emptyTypeBox}>
              <Text style={styles.emptyTypeText}>No leave types available</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.dropdownTrigger}
                onPress={() => setShowDropdown((prev) => !prev)}
              >
                {selectedLeaveType ? (
                  <View style={styles.selectedTypeDisplay}>
                    <View
                      style={[
                        styles.dropdownDot,
                        { backgroundColor: selectedLeaveType.color || '#3B82F6' },
                      ]}
                    />
                    <View style={styles.selectedTypeText}>
                      <Text style={styles.selectedTypeName}>
                        {selectedLeaveType.name || 'Unknown Leave Type'}
                      </Text>
                      <Text style={styles.selectedTypeDays}>
                        {selectedLeaveType.days_per_year ?? 0} days/year
                      </Text>
                    </View>
                  </View>
                ) : (
                  <Text style={styles.dropdownPlaceholder}>Select leave type</Text>
                )}

                <Ionicons
                  name={showDropdown ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#64748B"
                />
              </TouchableOpacity>

              {showDropdown && (
                <View style={styles.dropdownList}>
                  {leaveTypes.map((item) => (
                    <TouchableOpacity
                      key={String(item.id)}
                      style={[
                        styles.dropdownItem,
                        String(selectedType) === String(item.id) &&
                          styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedType(String(item.id));
                        setShowDropdown(false);
                      }}
                    >
                      <View
                        style={[
                          styles.dropdownDot,
                          { backgroundColor: item.color || '#3B82F6' },
                        ]}
                      />
                      <View style={styles.dropdownItemContent}>
                        <Text
                          style={[
                            styles.dropdownItemText,
                            String(selectedType) === String(item.id) &&
                              styles.dropdownItemTextSelected,
                          ]}
                        >
                          {item.name || 'Unknown Leave Type'}
                        </Text>
                        <Text style={styles.dropdownItemSubtext}>
                          {item.days_per_year ?? 0} days/year
                        </Text>
                      </View>

                      {String(selectedType) === String(item.id) && (
                        <Ionicons name="checkmark" size={20} color="#3B82F6" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Duration</Text>
          <View style={styles.dateRow}>
            <DateInput label="Start Date" value={startDate} onChange={setStartDate} />
            <DateInput label="End Date" value={endDate} onChange={setEndDate} />
          </View>

          <TouchableOpacity
            style={styles.halfDayToggle}
            onPress={() => setHalfDay(!halfDay)}
          >
            <View style={[styles.checkbox, halfDay && styles.checkboxChecked]}>
              {halfDay && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
            </View>
            <Text style={styles.halfDayText}>Half day only</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reason (Optional)</Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Enter a reason for your leave request..."
            placeholderTextColor="#94A3B8"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {selectedLeaveType ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Request Summary</Text>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Leave Type</Text>
              <Text style={styles.summaryValue}>
                {selectedLeaveType.name || 'Unknown Leave Type'}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Period</Text>
              <Text style={styles.summaryValue}>
                {format(new Date(startDate), 'MMM d')} -{' '}
                {format(new Date(endDate), 'MMM d, yyyy')}
              </Text>
            </View>

            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>
                {selectedLeaveType.is_paid ? 'Paid Leave' : 'Unpaid Leave'}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#FFFFFF" />
              <Text style={styles.submitButtonText}>Submit Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 12,
  },
  emptyTypeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  emptyTypeText: {
    color: '#64748B',
    fontSize: 14,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    minHeight: 56,
  },
  selectedTypeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedTypeText: {
    marginLeft: 12,
  },
  selectedTypeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  selectedTypeDays: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#94A3B8',
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dropdownItemSelected: {
    backgroundColor: '#EFF6FF',
  },
  dropdownDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dropdownItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  dropdownItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  dropdownItemTextSelected: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  dropdownItemSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 8,
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  dateInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
  },
  halfDayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  halfDayText: {
    fontSize: 14,
    color: '#334155',
  },
  reasonInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    fontSize: 14,
    color: '#1E293B',
    minHeight: 100,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});