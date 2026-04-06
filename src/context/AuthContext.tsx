import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const RAW_API_URL =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL ||
  'https://workpulse-hr.onrender.com';

const API_URL = RAW_API_URL.replace(/\/+$/, '');

// Global token setter to sync with store
let globalTokenSetter: ((token: string | null) => void) | null = null;

export function setGlobalTokenSetter(setter: (token: string | null) => void) {
  globalTokenSetter = setter;
}

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  employee_id?: string;
  created_at?: string;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (
    email: string,
    password: string,
    rememberMe?: boolean
  ) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<any>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');

      if (storedToken && storedUser) {
        const parsedUser: User = JSON.parse(storedUser);

        setToken(storedToken);
        setUser(parsedUser);

        if (globalTokenSetter) {
          globalTokenSetter(storedToken);
        }

        try {
          const response = await fetch(`${API_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (!response.ok) {
            await logout();
          }
        } catch (e) {
          console.log('Token verification failed, keeping stored auth');
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (
    email: string,
    password: string,
    rememberMe: boolean = false
  ): Promise<User> => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        remember_me: rememberMe,
      }),
    });

    const raw = await response.text();

    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { detail: raw || 'Login failed' };
    }

    if (!response.ok) {
      throw new Error(data?.detail || 'Login failed');
    }

    await AsyncStorage.setItem('auth_token', data.access_token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));
    await AsyncStorage.setItem('remember_me', rememberMe ? 'true' : 'false');

    setToken(data.access_token);
    setUser(data.user);

    if (globalTokenSetter) {
      globalTokenSetter(data.access_token);
    }

    return data.user as User;
  };

  const register = async (registerData: RegisterData): Promise<User> => {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerData),
    });

    const raw = await response.text();

    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { detail: raw || 'Registration failed' };
    }

    if (!response.ok) {
      throw new Error(data?.detail || 'Registration failed');
    }

    await AsyncStorage.setItem('auth_token', data.access_token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(data.user));

    setToken(data.access_token);
    setUser(data.user);

    if (globalTokenSetter) {
      globalTokenSetter(data.access_token);
    }

    return data.user as User;
  };

  const logout = async () => {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
    await AsyncStorage.removeItem('remember_me');

    setToken(null);
    setUser(null);

    if (globalTokenSetter) {
      globalTokenSetter(null);
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string
  ) => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });

    const raw = await response.text();

    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = { detail: raw || 'Password change failed' };
    }

    if (!response.ok) {
      throw new Error(data?.detail || 'Password change failed');
    }

    return data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        changePassword,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export { API_URL };