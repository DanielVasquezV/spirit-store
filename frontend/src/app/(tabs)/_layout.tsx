import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { FloatingTabBar } from '@/components/ui/floating-tab-bar';
import { useSession } from '@/features/auth/session-provider';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  const { status } = useSession();

  // Sin sesión resuelta no se decide destino: entrar y rebotar a /login dejaría
  // fuera a un usuario que sí tiene token válido.
  if (status === 'loading') return <View style={styles.blank} />;
  if (status === 'anonymous') return <Redirect href="/login" />;

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