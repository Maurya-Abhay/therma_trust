import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { getStoredValue, setStoredValue } from '@/src/storage';
import { setDark } from 'tt-jsx/remap';

export type ThemeMode = 'system' | 'light' | 'dark';

export const LIGHT = {
  bg: '#F3F7FB', card: '#FFFFFF', chrome: '#FFFFFF', text: '#0B1F3A', sub: '#64748B', line: '#E3EAF2',
  primary: '#0F766E', navy: '#0B2F5B', tint: '#E4F4F1', field: '#F3F7FB',
  ok: '#16A34A', okBg: '#DCFCE7', warn: '#D97706', warnBg: '#FEF3C7', bad: '#DC2626', badBg: '#FEE2E2', info: '#2563EB', infoBg: '#DBEAFE',
};
export type Palette = typeof LIGHT;
export const DARK: Palette = {
  bg: '#0A1424', card: '#132238', chrome: '#070F1D', text: '#EAF1FA', sub: '#93A4BA', line: '#223652',
  primary: '#2DD4BF', navy: '#0B2F5B', tint: '#12363A', field: '#0E1B2E',
  ok: '#4ADE80', okBg: '#12361F', warn: '#FBBF24', warnBg: '#3A2D0E', bad: '#F87171', badBg: '#3C1818', info: '#60A5FA', infoBg: '#14294B',
};

interface Ctx { mode: ThemeMode; isDark: boolean; t: Palette; setMode: (m: ThemeMode) => void }
const ThemeContext = createContext<Ctx | null>(null);
const KEY = 'theme_mode';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
  setDark(isDark);

  useEffect(() => {
    getStoredValue(KEY).then((v) => (v === 'light' || v === 'dark' || v === 'system') && setModeState(v)).catch(() => {});
  }, []);

  const setMode = useCallback((m: ThemeMode) => { setModeState(m); setStoredValue(KEY, m).catch(() => {}); }, []);
  const value = useMemo(() => ({ mode, isDark, t: isDark ? DARK : LIGHT, setMode }), [mode, isDark, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}
