import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Keys for offline storage
const OFFLINE_QUEUE_KEY = 'offline_action_queue';
const CACHED_DATA_PREFIX = 'cached_';

export interface OfflineAction {
  id: string;
  type: 'clock_in' | 'clock_out' | 'leave_request' | 'update';
  endpoint: string;
  method: string;
  body: any;
  timestamp: number;
  retries: number;
}

class OfflineService {
  private isOnline: boolean = true;
  private listeners: Set<(isOnline: boolean) => void> = new Set();

  constructor() {
    this.initNetworkListener();
  }

  private initNetworkListener() {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected ?? true;
      
      // Notify listeners
      this.listeners.forEach(listener => listener(this.isOnline));
      
      // If we just came back online, try to sync
      if (!wasOnline && this.isOnline) {
        this.syncOfflineActions();
      }
    });
  }

  addListener(callback: (isOnline: boolean) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }

  // Queue an action for later sync
  async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const queue = await this.getOfflineQueue();
    const newAction: OfflineAction = {
      ...action,
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retries: 0,
    };
    queue.push(newAction);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }

  // Get pending offline actions
  async getOfflineQueue(): Promise<OfflineAction[]> {
    try {
      const queue = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      return queue ? JSON.parse(queue) : [];
    } catch (error) {
      console.error('Error getting offline queue:', error);
      return [];
    }
  }

  // Remove an action from queue
  async removeFromQueue(actionId: string): Promise<void> {
    const queue = await this.getOfflineQueue();
    const filtered = queue.filter(a => a.id !== actionId);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  }

  // Sync offline actions when back online
  async syncOfflineActions(): Promise<{ success: number; failed: number }> {
    const queue = await this.getOfflineQueue();
    let success = 0;
    let failed = 0;

    for (const action of queue) {
      try {
        const token = await AsyncStorage.getItem('auth_token');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(action.endpoint, {
          method: action.method,
          headers,
          body: JSON.stringify(action.body),
        });

        if (response.ok) {
          await this.removeFromQueue(action.id);
          success++;
        } else {
          // Increment retry count
          action.retries++;
          if (action.retries >= 3) {
            // Remove after 3 failed attempts
            await this.removeFromQueue(action.id);
          }
          failed++;
        }
      } catch (error) {
        console.error('Error syncing action:', error);
        failed++;
      }
    }

    return { success, failed };
  }

  // Cache data for offline access
  async cacheData(key: string, data: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${CACHED_DATA_PREFIX}${key}`,
        JSON.stringify({
          data,
          cachedAt: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  // Get cached data
  async getCachedData<T>(key: string): Promise<{ data: T; cachedAt: number } | null> {
    try {
      const cached = await AsyncStorage.getItem(`${CACHED_DATA_PREFIX}${key}`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  // Clear specific cache
  async clearCache(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${CACHED_DATA_PREFIX}${key}`);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  // Clear all offline data
  async clearAllOfflineData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const offlineKeys = keys.filter(
        k => k.startsWith(CACHED_DATA_PREFIX) || k === OFFLINE_QUEUE_KEY
      );
      await AsyncStorage.multiRemove(offlineKeys);
    } catch (error) {
      console.error('Error clearing offline data:', error);
    }
  }
}

export const offlineService = new OfflineService();
export default offlineService;
