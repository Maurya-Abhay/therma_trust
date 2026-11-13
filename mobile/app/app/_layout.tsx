import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { AuthSplash } from '@/src/components/auth/AuthScreenFrame';

export default function AppLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthSplash />;
  if (!user) return <Redirect href="/auth/splash" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
