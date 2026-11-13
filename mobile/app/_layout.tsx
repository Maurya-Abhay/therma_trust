import '../global.css';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Providers } from '@/src/providers';
import { useTheme } from '@/src/theme/ThemeProvider';

function Shell() {
  const { t, isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="app" />
        <Stack.Screen name="public" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Providers>
        <Shell />
      </Providers>
    </SafeAreaProvider>
  );
}
