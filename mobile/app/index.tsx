import { Redirect } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { AuthSplash } from '@/src/components/auth/AuthScreenFrame';
import { getRoleHomePath } from '@/src/auth/roleRoute';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <AuthSplash />;
  if (!user) return <Redirect href="/auth/splash" />;
  return <Redirect href={getRoleHomePath(user.role)} />;
}