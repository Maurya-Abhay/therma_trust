import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { getRoleHomePath } from '@/src/auth/roleRoute';
import { AuthSplash } from '@/src/components/auth/AuthScreenFrame';

export default function ContractorLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthSplash />;
  if (!user) return <Redirect href="/auth/splash" />;
  if (user.role !== 'contractor_manager') return <Redirect href={getRoleHomePath(user.role)} />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="compliance" />
      <Stack.Screen name="cylinders" />
      <Stack.Screen name="calendar" />
    </Stack>
  );
}
