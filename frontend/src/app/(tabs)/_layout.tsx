import { Tabs } from 'expo-router';
import { FloatingTabBar } from '@/components/ui/floating-tab-bar';
import { Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colors.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="explore" options={{ title: 'Explorar' }} />
      <Tabs.Screen name="cart" options={{ title: 'Carrito' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}