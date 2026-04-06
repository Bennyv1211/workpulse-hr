import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import offlineService from '../services/offlineService';

interface OfflineIndicatorProps {
  showPendingCount?: boolean;
}

export default function OfflineIndicator({ showPendingCount = true }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [slideAnim] = useState(new Animated.Value(-60));

  useEffect(() => {
    // Set initial state
    setIsOnline(offlineService.getIsOnline());
    loadPendingCount();

    // Subscribe to network changes
    const unsubscribe = offlineService.addListener((online) => {
      setIsOnline(online);
      if (online) {
        loadPendingCount();
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    // Animate banner in/out
    Animated.timing(slideAnim, {
      toValue: isOnline ? -60 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline]);

  const loadPendingCount = async () => {
    const queue = await offlineService.getOfflineQueue();
    setPendingCount(queue.length);
  };

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { transform: [{ translateY: slideAnim }] },
        !isOnline ? styles.offlineContainer : styles.syncContainer,
      ]}
    >
      <Ionicons
        name={isOnline ? 'cloud-upload-outline' : 'cloud-offline-outline'}
        size={18}
        color="#FFFFFF"
      />
      <Text style={styles.text}>
        {!isOnline
          ? 'You are offline. Changes will sync when online.'
          : `Syncing ${pendingCount} pending action${pendingCount !== 1 ? 's' : ''}...`}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  offlineContainer: {
    backgroundColor: '#EF4444',
  },
  syncContainer: {
    backgroundColor: '#3B82F6',
  },
  text: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
});
