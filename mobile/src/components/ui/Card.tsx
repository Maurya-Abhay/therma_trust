import React from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
  bordered?: boolean;
  className?: string;
}

export const Card = ({ children, style, padded = true, elevated = false, bordered = true, className }: CardProps) => {
  const { t } = useTheme();
  return (
    <View
      className={className}
      style={[
        { backgroundColor: t.card, borderRadius: 20, padding: padded ? 16 : 0, borderWidth: bordered ? 1 : 0, borderColor: t.line },
        elevated && { shadowColor: '#0B2F5B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 12, elevation: 2 },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const CardHeader = ({ title, subtitle, action, style }: { title: string; subtitle?: string; action?: React.ReactNode; style?: StyleProp<ViewStyle> }) => {
  const { t } = useTheme();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 10 }, style]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: t.text }}>{title}</Text>
        {!!subtitle && <Text style={{ fontSize: 12, color: t.sub, marginTop: 3 }}>{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
};

export const CardContent = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => <View style={style}>{children}</View>;

export const CardFooter = ({ children, style, divided = true }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; divided?: boolean }) => {
  const { t } = useTheme();
  return (
    <View style={[{ marginTop: 14, paddingTop: divided ? 12 : 0, borderTopWidth: divided ? 1 : 0, borderTopColor: t.line, flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}>
      {children}
    </View>
  );
};
