import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider } from '@/features/auth/session-provider';
import { CartProvider } from '@/features/cart/cart-provider';
import { AppQueryProvider } from '@/providers/query-provider';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* El orden importa: la sesión usa la caché de queries y la navegación usa la sesión. */}
      <AppQueryProvider>
        <SessionProvider>
          <CartProvider>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="product/[id]" />
              <Stack.Screen name="auction/[id]" />
              <Stack.Screen name="chat/[id]" />
              <Stack.Screen name="cart" />
              <Stack.Screen name="diagnostics" />
            </Stack>
          </CartProvider>
        </SessionProvider>
      </AppQueryProvider>
    </SafeAreaProvider>
  );
}