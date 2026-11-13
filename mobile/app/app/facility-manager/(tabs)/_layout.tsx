import { Tabs } from 'expo-router';
import { BriefcaseBusiness, Building2, Home, Settings } from 'lucide-react-native';
import { useTabOptions } from '@/src/components/layout/tabBarOptions';

export default function FacilityManagerTabs() {
  const options = useTabOptions();
  return (
    <Tabs screenOptions={options}>
      <Tabs.Screen name="dashboard" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }} />
      <Tabs.Screen name="facilities" options={{ title: 'Facilities', tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} /> }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: ({ color, size }) => <BriefcaseBusiness color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }} />
    </Tabs>
  );
}
