import { useTheme } from '@/src/theme/ThemeProvider';

export function useTabOptions() {
  const { t } = useTheme();
  return {
    headerShown: false,
    tabBarActiveTintColor: t.primary,
    tabBarInactiveTintColor: t.sub,
    tabBarHideOnKeyboard: true,
    tabBarStyle: { backgroundColor: t.chrome, borderTopColor: t.line, borderTopWidth: 1, height: 66, paddingTop: 8, paddingBottom: 8, elevation: 0 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '700' as const },
  };
}
