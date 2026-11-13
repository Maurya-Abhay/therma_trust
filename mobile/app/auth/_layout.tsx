import { Redirect, Stack } from 'expo-router';
import { AuthSplash } from '@/src/components/auth/AuthScreenFrame';
import { useAuth } from '@/src/auth/AuthContext';
import { getRoleHomePath } from '@/src/auth/roleRoute';

export default function AuthLayout() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthSplash />;
  if (user) return <Redirect href={getRoleHomePath(user.role)} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
