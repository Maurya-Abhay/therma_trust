import React from 'react';
import { ScrollView, StyleProp, View, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';
import { Header } from './Header';

interface Props {
  children: React.ReactNode;
  header?: React.ReactNode;
  headerTitle?: string;
  headerSubtitle?: string;
  headerRightAction?: React.ReactNode;
  showBack?: boolean;
  showProfile?: boolean;
  showBrand?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  scrollable?: boolean;
}

export const ScreenContainer = ({ children, header, headerTitle, headerSubtitle, headerRightAction, showBack, showProfile, showBrand, style, contentStyle, scrollable = false }: Props) => {
  const { t, isDark } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: t.bg }, style]}>
      {header || (headerTitle ? <Header title={headerTitle} subtitle={headerSubtitle} rightAction={headerRightAction} showBack={showBack} showProfile={showProfile} showBrand={showBrand} /> : null)}
      {/* key remounts content when the theme changes so every screen re-reads colours */}
      <React.Fragment key={isDark ? 'd' : 'l'}>
        {scrollable ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={[{ padding: 18, paddingBottom: 36, flexGrow: 1 }, contentStyle]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12 }, contentStyle]}>{children}</View>
        )}
      </React.Fragment>
    </View>
  );
};
