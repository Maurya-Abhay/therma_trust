import React from 'react';
import { Image, Pressable, StyleProp, Text, View, ViewStyle } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/src/auth/AuthContext';
import { useTheme } from '@/src/theme/ThemeProvider';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showProfile?: boolean;
  showBrand?: boolean;
  backHref?: string;
  rightAction?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

// Pages reachable from Settings or a dashboard (not bottom-tab roots).
const SUB_PAGES = new Set([
  'capabilities-review', 'contractor-docs-review', 'audit-verify', 'profile', 'equipment', 'calendar', 'refrigerant-dashboard', 'compliance',
  'cylinders', 'capabilities', 'passport', 'notifications', 'work-history', 'assessments', 'search', 'onboarding',
]);
const MENU_ROOTS = new Set([
  'dashboard', 'credentials-review', 'contractor-verifications-review', 'settings',
  'facilities', 'jobs', 'company', 'roster', 'index', 'technician', 'credentials',
]);
const COMPACT_DETAIL_HEADERS = new Set(['capabilities-review', 'contractor-docs-review', 'audit-verify']);

export const Header = ({ title, subtitle, showBack, showProfile = true, showBrand, backHref, rightAction, style }: HeaderProps) => {
  const router = useRouter();
  const segments = useSegments();
  const { user } = useAuth();
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const last = String(segments[segments.length - 1] ?? '');
  const tabGroupIndex = segments.lastIndexOf('(tabs)');
  const tabRoute = tabGroupIndex >= 0 ? String(segments[tabGroupIndex + 1] ?? '') : '';
  const isContractorCapabilitiesTab = segments.includes('contractor') && tabGroupIndex >= 0 && tabRoute === 'capabilities';
  const isMenuRoot = MENU_ROOTS.has(last) || isContractorCapabilitiesTab || (tabGroupIndex >= 0 && (!tabRoute || MENU_ROOTS.has(tabRoute)));
  const isBrand = showBrand ?? isMenuRoot;
  const back = showBrand ? false : showBack ?? (!isContractorCapabilitiesTab && (SUB_PAGES.has(last) || (segments.length >= 4 && !isMenuRoot)));
  const isCompact = isBrand || back || COMPACT_DETAIL_HEADERS.has(last);
  const initials = `${user?.first_name?.[0] ?? 'T'}${user?.last_name?.[0] ?? ''}`.toUpperCase();
  const profile = rightAction ?? (showProfile && user ? (
    <View style={{ width: isCompact ? 36 : 40, height: isCompact ? 36 : 40, borderRadius: 20, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: t.primary, fontWeight: '800', fontSize: isCompact ? 13 : 14 }}>{initials}</Text>
    </View>
  ) : null);

  return (
    <View
      style={[
        {
          backgroundColor: t.chrome,
          paddingTop: Math.max(insets.top, isCompact ? 4 : 12) + (isCompact ? 2 : 6),
          paddingBottom: isCompact ? 12 : 20,
          paddingHorizontal: isCompact ? 18 : 20,
        },
        style,
      ]}
    >
      {isBrand && !back ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Image
              source={require('../../../assets/icon.png')}
              style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: t.card, borderWidth: 1, borderColor: t.line }}
              resizeMode="contain"
              accessibilityLabel="ThermaTrust"
            />
            <Text style={{ color: t.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 }}>ThermaTrust</Text>
          </View>
          {profile}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: isCompact ? 10 : 12 }}>
          {back ? (
            <Pressable
              onPress={() => (backHref ? router.push(backHref as any) : router.canGoBack() ? router.back() : router.replace('/'))}
              accessibilityLabel="Go back"
              style={{ width: isCompact ? 36 : 40, height: isCompact ? 36 : 40, borderRadius: isCompact ? 18 : 14, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}
            >
              <ArrowLeft size={isCompact ? 19 : 20} color={t.primary} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: isCompact ? 16 : 22, fontWeight: '800' }}>{title}</Text>
            {subtitle && !back ? <Text numberOfLines={1} style={{ color: t.sub, fontSize: isCompact ? 9 : 13, marginTop: 1 }}>{subtitle}</Text> : null}
          </View>
          {profile}
        </View>
      )}
    </View>
  );
};
