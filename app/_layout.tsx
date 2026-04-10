import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from '../src/context/AuthContext';
import OfflineIndicator from '../src/components/OfflineIndicator';
import { EmploraWordmark } from '../src/components/EmploraLogo';
import { LinearGradient } from 'expo-linear-gradient';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { configureNotificationChannel } from '../src/lib/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function prepare() {
      try {
        await configureNotificationChannel();
        await Font.loadAsync(Ionicons.font);
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (e) {
        console.warn(e);
      } finally {
        if (isMounted) {
          setAppIsReady(true);
        }
      }
    }

    prepare();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      router.push('/notifications');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync().catch(() => {});
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return (
      <View style={styles.splashContainer}>
        <LinearGradient
          colors={['#7B6EF6', '#4A90E2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <EmploraWordmark size={32} />
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <AuthProvider>
        <StatusBar style="dark" />
        <View style={{ flex: 1 }}>
          <OfflineIndicator />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="hr" />
            <Stack.Screen name="employee/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="leave/request" options={{ presentation: 'modal' }} />
            <Stack.Screen name="payroll/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="change-password" options={{ presentation: 'modal' }} />
            <Stack.Screen name="edit-profile" options={{ presentation: 'card' }} />
          </Stack>
        </View>
      </AuthProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
