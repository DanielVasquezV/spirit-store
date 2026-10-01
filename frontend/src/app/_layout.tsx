import { DarkTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthGate } from '@/features/auth/auth-gate';
import { SessionProvider } from '@/features/auth/session-provider';
import { AppQueryProvider } from '@/providers/query-provider';
import { Colors } from '@/constants/theme';

// Sin tema, React Navigation usa el claro por defecto y su fondo blanco asoma en el gesto de volver.
const NAV_THEME: Theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Colors.bg, card: Colors.bg, border: Colors.border, text: Colors.text, primary: Colors.accent },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={NAV_THEME}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {/* El orden importa: la sesión usa la caché de queries y la navegación usa la sesión. */}
        <AppQueryProvider>
          <SessionProvider>
            <AuthGate>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="product/[id]" />
                <Stack.Screen name="auction/[id]" />
                <Stack.Screen name="chat/[id]" />
                <Stack.Screen name="checkout/[id]" />
                <Stack.Screen name="purchases" />
                <Stack.Screen name="purchase/[id]" />
                <Stack.Screen name="diagnostics" />
                <Stack.Screen name="vehicle/new" />
                <Stack.Screen name="my-vehicles" />
                <Stack.Screen name="my-bids" />
                <Stack.Screen name="profile-edit" />
              </Stack>
            </AuthGate>
          </SessionProvider>
        </AppQueryProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
