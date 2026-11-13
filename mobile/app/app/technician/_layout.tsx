import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { getRoleHomePath } from '@/src/auth/roleRoute';
import { AuthSplash } from '@/src/components/auth/AuthScreenFrame';

export default function TechnicianLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthSplash />;
  if (!user) return <Redirect href="/auth/splash" />;
  if (user.role !== 'technician') return <Redirect href={getRoleHomePath(user.role)} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="passport" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="capabilities" />
      <Stack.Screen name="capabilities/create" />
      <Stack.Screen name="capabilities/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="work-history" />
      <Stack.Screen name="assessments" />
      <Stack.Screen name="assessments/[id]" />
      <Stack.Screen name="jobs/[id]" />
      <Stack.Screen name="jobs/[id]/report" />
      <Stack.Screen name="credentials/[id]" />
      <Stack.Screen name="credentials/create" />
    </Stack>
  );
}
