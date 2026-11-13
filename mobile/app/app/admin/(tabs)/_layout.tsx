import { Tabs } from 'expo-router';
import { Building2, FileCheck2, Home, Settings } from 'lucide-react-native';
import { useTabOptions } from '@/src/components/layout/tabBarOptions';

export default function AdminTabs() {
  const options = useTabOptions();
  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="credentials-review" options={{ title: 'Reviews', tabBarIcon: ({ color, size }) => <FileCheck2 color={color} size={size} /> }} />
      <Tabs.Screen name="contractor-verifications-review" options={{ title: 'Companies', tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
  );
}
