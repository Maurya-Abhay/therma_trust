import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { getRoleHomePath } from '@/src/auth/roleRoute';
import { AuthSplash } from '@/src/components/auth/AuthScreenFrame';

export default function FacilityManagerTabs() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthSplash />;
  if (!user) return <Redirect href="/auth/splash" />;
  if (user.role !== 'facility_manager') return <Redirect href={getRoleHomePath(user.role)} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="equipment" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="refrigerant-dashboard" />
      <Stack.Screen name="facilities/[id]" />
      <Stack.Screen name="facilities/create" />
      <Stack.Screen name="equipment/[id]" />
      <Stack.Screen name="equipment/create" />
      <Stack.Screen name="jobs/[id]" />
      <Stack.Screen name="jobs/create" />
    </Stack>
  );
}
