import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

type ThemePalette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primarySoft: string;
  success: string;
  warning: string;
  danger: string;
};

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemePalette;
  toggleTheme: () => Promise<void>;
  setTheme: (mode: ThemeMode) => Promise<void>;
};

const STORAGE_KEY = 'emplora_theme_mode_v1';

const lightColors: ThemePalette = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF6FF',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#64748B',
  primary: '#2563EB',
  primarySoft: '#DBEAFE',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

const darkColors: ThemePalette = {
  background: '#07111F',
  surface: '#101B2D',
  surfaceAlt: '#172554',
  border: '#22324A',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  primary: '#60A5FA',
  primarySoft: '#1E3A8A',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setModeState(stored);
        }
      } catch (error) {
        console.log('Theme restore error:', error);
      }
    };

    loadTheme();
  }, []);

  const setTheme = async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    await AsyncStorage.setItem(STORAGE_KEY, nextMode);
  };

  const toggleTheme = async () => {
    const nextMode = mode === 'dark' ? 'light' : 'dark';
    await setTheme(nextMode);
  };

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: mode === 'dark' ? darkColors : lightColors,
      toggleTheme,
      setTheme,
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return context;
}
