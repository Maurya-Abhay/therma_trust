import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { getRoleHomePath } from '@/src/auth/roleRoute';
import { AuthSplash } from '@/src/components/auth/AuthScreenFrame';

export default function AdminLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthSplash />;
  if (!user) return <Redirect href="/auth/splash" />;
  if (user.role !== 'admin') return <Redirect href={getRoleHomePath(user.role)} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="capabilities-review" />
      <Stack.Screen name="contractor-docs-review" />
      <Stack.Screen name="audit-verify" />
    </Stack>
  );
}
