import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useAuth, setGlobalTokenSetter } from '../../src/context/AuthContext';
import { useHRStore } from '../../src/store/hrStore';
import AppIcon from '../../src/components/AppIcon';

function TabIconWrapper({
  children,
  focused,
}: {
  children: React.ReactNode;
  focused: boolean;
}) {
  return (
    <View style={[styles.tabIconWrap, focused && styles.tabIconWrapActive]}>
      {children}
    </View>
  );
}

export default function TabLayout() {
  const { token } = useAuth();
  const { setToken } = useHRStore();

  useEffect(() => {
    setGlobalTokenSetter(setToken);

    if (token) {
      setToken(token);
    }

    return () => {
      setGlobalTokenSetter(() => {});
    };
  }, [setToken, token]);

  useEffect(() => {
    if (token) {
      setToken(token);
    }
  }, [token, setToken]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: styles.tabLabel,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused}>
              <AppIcon name="dashboard" size={22} color={color} />
            </TabIconWrapper>
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: 'Clock',
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused}>
              <AppIcon name="clock" size={22} color={color} />
            </TabIconWrapper>
          ),
        }}
      />

      <Tabs.Screen
        name="time-off"
        options={{
          title: 'Time Off',
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused}>
              <AppIcon name="time-off" size={22} color={color} />
            </TabIconWrapper>
          ),
        }}
      />

      <Tabs.Screen
        name="paystubs"
        options={{
          title: 'Pay',
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused}>
              <AppIcon name="pay" size={22} color={color} />
            </TabIconWrapper>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ color, focused }) => (
            <TabIconWrapper focused={focused}>
              <AppIcon name="profile" size={22} color={color} />
            </TabIconWrapper>
          ),
        }}
      />

      <Tabs.Screen name="attendance" options={{ href: null }} />
      <Tabs.Screen name="leave" options={{ href: null }} />
      <Tabs.Screen name="employees" options={{ href: null }} />
      <Tabs.Screen name="training" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    height: 78,
    paddingBottom: 10,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  tabIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  tabIconWrapActive: {
    backgroundColor: '#DBEAFE',
  },
});
