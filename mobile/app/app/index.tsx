import { Redirect } from 'expo-router';
import { useAuth } from '@/src/auth/AuthContext';
import { getRoleHomePath } from '@/src/auth/roleRoute';

export default function AppIndex() {
  const { user } = useAuth();
  return user ? <Redirect href={getRoleHomePath(user.role)} /> : <Redirect href="/auth/splash" />;
}
