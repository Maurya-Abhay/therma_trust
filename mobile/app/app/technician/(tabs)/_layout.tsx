import { Tabs } from 'expo-router';
import { BriefcaseBusiness, FileBadge, Home, Settings } from 'lucide-react-native';
import { useTabOptions } from '@/src/components/layout/tabBarOptions';

export default function TechnicianTabs() {
  const options = useTabOptions();
  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: ({ color, size }) => <BriefcaseBusiness color={color} size={size} /> }} />
      <Tabs.Screen name="credentials" options={{ title: 'Credentials', tabBarIcon: ({ color, size }) => <FileBadge color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
  );
}
