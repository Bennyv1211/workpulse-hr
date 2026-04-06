import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useHRStore } from '../../src/store/hrStore';

export default function PayrollDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { payroll, fetchPayroll } = useHRStore();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await fetchPayroll();
    setLoading(false);
  };

  const payrollRecord = payroll.find((p) => p.id === id);

  const generatePDF = async () => {
    if (!payrollRecord) return;

    setGenerating(true);
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              padding: 40px;
              color: #1E293B;
              max-width: 800px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #3B82F6;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .company-name {
              font-size: 28px;
              font-weight: bold;
              color: #3B82F6;
              margin-bottom: 5px;
            }
            .document-title {
              font-size: 18px;
              color: #64748B;
            }
            .employee-info {
              background-color: #F8FAFC;
              padding: 20px;
              border-radius: 8px;
              margin-bottom: 30px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 10px;
            }
            .info-label {
              color: #64748B;
            }
            .info-value {
              font-weight: 600;
            }
            .section-title {
              font-size: 16px;
              font-weight: 600;
              color: #334155;
              margin-bottom: 15px;
              padding-bottom: 10px;
              border-bottom: 1px solid #E2E8F0;
            }
            .breakdown-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .breakdown-table th,
            .breakdown-table td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #E2E8F0;
            }
            .breakdown-table th {
              background-color: #F8FAFC;
              font-weight: 600;
              color: #64748B;
            }
            .amount {
              text-align: right;
              font-variant-numeric: tabular-nums;
            }
            .earnings { color: #10B981; }
            .deductions { color: #EF4444; }
            .total-row {
              background-color: #3B82F6;
              color: white;
            }
            .total-row td {
              font-weight: bold;
              font-size: 18px;
            }
            .footer {
              margin-top: 40px;
              text-align: center;
              color: #94A3B8;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">WorkPulse HR</div>
            <div class="document-title">Payslip</div>
          </div>
          
          <div class="employee-info">
            <div class="info-row">
              <span class="info-label">Employee Name</span>
              <span class="info-value">${payrollRecord.employee_name || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Employee ID</span>
              <span class="info-value">${payrollRecord.employee_code || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Department</span>
              <span class="info-value">${payrollRecord.department_name || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Position</span>
              <span class="info-value">${payrollRecord.job_title || 'N/A'}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Pay Period</span>
              <span class="info-value">${format(parseISO(payrollRecord.pay_period_start), 'MMM d')} - ${format(parseISO(payrollRecord.pay_period_end), 'MMM d, yyyy')}</span>
            </div>
          </div>

          <div class="section-title">Earnings</div>
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Basic Salary</td>
                <td class="amount earnings">$${payrollRecord.basic_salary.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              ${payrollRecord.overtime_pay > 0 ? `
              <tr>
                <td>Overtime Pay (${payrollRecord.overtime_hours} hrs @ ${payrollRecord.overtime_rate}x)</td>
                <td class="amount earnings">$${payrollRecord.overtime_pay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              ${payrollRecord.bonus > 0 ? `
              <tr>
                <td>Bonus</td>
                <td class="amount earnings">$${payrollRecord.bonus.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              <tr style="background-color: #F0FDF4;">
                <td><strong>Gross Pay</strong></td>
                <td class="amount"><strong>$${payrollRecord.gross_pay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="section-title">Deductions</div>
          <table class="breakdown-table">
            <thead>
              <tr>
                <th>Description</th>
                <th class="amount">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Income Tax</td>
                <td class="amount deductions">-$${payrollRecord.tax.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              ${payrollRecord.benefits_deduction > 0 ? `
              <tr>
                <td>Benefits Deduction</td>
                <td class="amount deductions">-$${payrollRecord.benefits_deduction.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              ${payrollRecord.deductions > 0 ? `
              <tr>
                <td>Other Deductions</td>
                <td class="amount deductions">-$${payrollRecord.deductions.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
              ` : ''}
              <tr style="background-color: #FEF2F2;">
                <td><strong>Total Deductions</strong></td>
                <td class="amount"><strong>-$${(payrollRecord.tax + payrollRecord.benefits_deduction + payrollRecord.deductions).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></td>
              </tr>
            </tbody>
          </table>

          <table class="breakdown-table">
            <tbody>
              <tr class="total-row">
                <td>NET PAY</td>
                <td class="amount">$${payrollRecord.net_pay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p>This is a computer-generated document and does not require a signature.</p>
            <p>Generated on ${format(new Date(), 'MMMM d, yyyy')} by WorkPulse HR</p>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Payslip',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('Success', 'PDF generated successfully!');
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to generate PDF: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const PayrollRow = ({ label, amount, type = 'neutral' }: { label: string; amount: number; type?: 'earning' | 'deduction' | 'neutral' | 'total' }) => (
    <View style={[styles.payrollRow, type === 'total' && styles.totalRow]}>
      <Text style={[styles.payrollLabel, type === 'total' && styles.totalLabel]}>{label}</Text>
      <Text
        style={[
          styles.payrollAmount,
          type === 'earning' && styles.earningAmount,
          type === 'deduction' && styles.deductionAmount,
          type === 'total' && styles.totalAmount,
        ]}
      >
        {type === 'deduction' ? '-' : ''}${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!payrollRecord) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Payslip</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Payroll record not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payslip</Text>
        <TouchableOpacity onPress={generatePDF} style={styles.downloadButton} disabled={generating}>
          {generating ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Ionicons name="download-outline" size={24} color="#3B82F6" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Employee Info Card */}
        <View style={styles.employeeCard}>
          <View style={styles.employeeAvatar}>
            <Text style={styles.employeeAvatarText}>
              {payrollRecord.employee_name?.split(' ').map((n) => n[0]).join('') || '?'}
            </Text>
          </View>
          <Text style={styles.employeeName}>{payrollRecord.employee_name}</Text>
          <Text style={styles.employeeTitle}>{payrollRecord.job_title}</Text>
          <View style={styles.employeeMeta}>
            <Text style={styles.employeeId}>{payrollRecord.employee_code}</Text>
            <Text style={styles.separator}>|</Text>
            <Text style={styles.departmentName}>{payrollRecord.department_name}</Text>
          </View>
          <View style={styles.periodBadge}>
            <Ionicons name="calendar-outline" size={14} color="#3B82F6" />
            <Text style={styles.periodText}>
              {format(parseISO(payrollRecord.pay_period_start), 'MMM d')} - {format(parseISO(payrollRecord.pay_period_end), 'MMM d, yyyy')}
            </Text>
          </View>
        </View>

        {/* Net Pay Card */}
        <View style={styles.netPayCard}>
          <Text style={styles.netPayLabel}>Net Pay</Text>
          <Text style={styles.netPayAmount}>
            ${payrollRecord.net_pay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
          <View style={[styles.statusChip, { backgroundColor: payrollRecord.status === 'paid' ? '#D1FAE5' : '#FEF3C7' }]}>
            <Text style={[styles.statusText, { color: payrollRecord.status === 'paid' ? '#10B981' : '#F59E0B' }]}>
              {payrollRecord.status}
            </Text>
          </View>
        </View>

        {/* Earnings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <View style={styles.breakdownCard}>
            <PayrollRow label="Basic Salary" amount={payrollRecord.basic_salary} type="earning" />
            {payrollRecord.overtime_pay > 0 && (
              <PayrollRow
                label={`Overtime (${payrollRecord.overtime_hours}h @ ${payrollRecord.overtime_rate}x)`}
                amount={payrollRecord.overtime_pay}
                type="earning"
              />
            )}
            {payrollRecord.bonus > 0 && (
              <PayrollRow label="Bonus" amount={payrollRecord.bonus} type="earning" />
            )}
            <PayrollRow label="Gross Pay" amount={payrollRecord.gross_pay} type="neutral" />
          </View>
        </View>

        {/* Deductions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Deductions</Text>
          <View style={styles.breakdownCard}>
            <PayrollRow label="Income Tax" amount={payrollRecord.tax} type="deduction" />
            {payrollRecord.benefits_deduction > 0 && (
              <PayrollRow label="Benefits" amount={payrollRecord.benefits_deduction} type="deduction" />
            )}
            {payrollRecord.deductions > 0 && (
              <PayrollRow label="Other Deductions" amount={payrollRecord.deductions} type="deduction" />
            )}
            <PayrollRow
              label="Total Deductions"
              amount={payrollRecord.tax + payrollRecord.benefits_deduction + payrollRecord.deductions}
              type="deduction"
            />
          </View>
        </View>

        {/* Total Section */}
        <View style={styles.section}>
          <View style={styles.totalCard}>
            <PayrollRow label="NET PAY" amount={payrollRecord.net_pay} type="total" />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  downloadButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748B',
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  employeeAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  employeeAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  employeeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  employeeTitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  employeeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  employeeId: {
    fontSize: 13,
    color: '#94A3B8',
  },
  separator: {
    fontSize: 13,
    color: '#CBD5E1',
    marginHorizontal: 8,
  },
  departmentName: {
    fontSize: 13,
    color: '#3B82F6',
  },
  periodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
    gap: 6,
  },
  periodText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3B82F6',
  },
  netPayCard: {
    backgroundColor: '#3B82F6',
    margin: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  netPayLabel: {
    fontSize: 14,
    color: '#BFDBFE',
    marginBottom: 4,
  },
  netPayAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  statusChip: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  payrollRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  totalRow: {
    backgroundColor: '#3B82F6',
    borderBottomWidth: 0,
  },
  payrollLabel: {
    fontSize: 14,
    color: '#334155',
  },
  totalLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  payrollAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  earningAmount: {
    color: '#10B981',
  },
  deductionAmount: {
    color: '#EF4444',
  },
  totalAmount: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  totalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});