import { Tabs } from 'expo-router';
import { BadgeCheck, Home, Settings, Users } from 'lucide-react-native';
import { useTabOptions } from '@/src/components/layout/tabBarOptions';

export default function ContractorTabs() {
  const options = useTabOptions();
  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen name="company" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="roster" options={{ title: 'Team', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tabs.Screen name="capabilities" options={{ title: 'Capabilities', tabBarIcon: ({ color, size }) => <BadgeCheck color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
  );
}
