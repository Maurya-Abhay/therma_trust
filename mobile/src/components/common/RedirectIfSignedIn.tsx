import { useEffect } from 'react';
import { useAuth } from '@/src/auth/AuthContext';
import { router } from 'expo-router';

export function RedirectIfSignedIn() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  return null;
}