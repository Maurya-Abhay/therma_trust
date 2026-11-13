import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export async function getStoredValue(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  }

  return AsyncStorage.getItem(key);
}

export async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
    return;
  }

  await AsyncStorage.setItem(key, value);
}
