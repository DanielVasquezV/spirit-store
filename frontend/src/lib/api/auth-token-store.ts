import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'spirit-store.access-token';

// SecureStore no existe en web, así que el export estático guarda el token en
// localStorage: mismo contrato de API para que el cliente no tenga que branching.
const storage = {
  get: () => (Platform.OS === 'web' ? localStorage.getItem(KEY) : SecureStore.getItemAsync(KEY)),
  set: (token: string) => (Platform.OS === 'web' ? localStorage.setItem(KEY, token) : SecureStore.setItemAsync(KEY, token)),
  clear: () => (Platform.OS === 'web' ? localStorage.removeItem(KEY) : SecureStore.deleteItemAsync(KEY)),
};

export function getAccessToken(): Promise<string | null> {
  return Promise.resolve(storage.get()).then((value) => value ?? null);
}

export function setAccessToken(token: string): Promise<void> {
  return Promise.resolve(storage.set(token));
}

export function clearAccessToken(): Promise<void> {
  return Promise.resolve(storage.clear());
}