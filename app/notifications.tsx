import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth, API_URL } from '../src/context/AuthContext';
type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  content?: string;
  type?: string;
  priority?: string;
  read?: boolean;
  created_at?: string;
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = async () => {
    try {
      const res = await fetch(`${API_URL}/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadNotifications();
    }, [])
  );

  const markRead = async (id: string) => {
    try {
      await fetch(`${API_URL}/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
    } catch {
      Alert.alert('Error', 'Could not mark notification as read');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNotifications();
              }}
            />
          }
          contentContainerStyle={items.length === 0 ? styles.center : styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.read && styles.unreadCard]}
              onPress={() => markRead(item.id)}
            >
              <View style={styles.row}>
                <Ionicons
                  name={item.read ? 'mail-open-outline' : 'notifications-outline'}
                  size={20}
                  color={item.read ? '#64748B' : '#EC4899'}
                />
                <View style={styles.content}>
                  <Text style={styles.title}>{item.title || item.type || 'Notification'}</Text>
                  <Text style={styles.message}>{item.message || item.content || ''}</Text>
                  {item.created_at ? (
                    <Text style={styles.time}>
                      {new Date(item.created_at).toLocaleString()}
                    </Text>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
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
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16 },
  emptyText: { fontSize: 16, color: '#64748B' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  unreadCard: {
    borderWidth: 1,
    borderColor: '#F9A8D4',
    backgroundColor: '#FFF1F7',
  },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  content: { flex: 1, marginLeft: 12 },
  title: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  message: { fontSize: 14, color: '#475569', marginTop: 4 },
  time: { fontSize: 12, color: '#94A3B8', marginTop: 8 },
});