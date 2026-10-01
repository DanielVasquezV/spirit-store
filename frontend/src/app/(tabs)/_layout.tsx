import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FloatingTabBar } from '@/components/ui/floating-tab-bar';
import { useSession } from '@/features/auth/session-provider';
import { useRealtimeSync } from '@/features/realtime/use-realtime-sync';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const { status } = useSession();
  useRealtimeSync(status === 'authenticated');

  // Sin sesión resuelta no se decide destino: rebotar a /login dejaría fuera a quien sí tiene token.
  if (status === 'loading') return <View style={styles.blank} />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colors.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="search" options={{ title: 'Buscar' }} />
      <Tabs.Screen name="auctions" options={{ title: 'Subastas' }} />
      <Tabs.Screen name="chats" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: Colors.bg },
});