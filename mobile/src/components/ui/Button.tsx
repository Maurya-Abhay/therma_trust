import React from 'react';
import { ActivityIndicator, StyleProp, Text, TextStyle, TouchableOpacity, TouchableOpacityProps, View, ViewStyle } from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

interface ButtonProps extends TouchableOpacityProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  className?: string;
}

const SIZE = { sm: { h: 40, px: 14, f: 12 }, md: { h: 50, px: 20, f: 14 }, lg: { h: 56, px: 24, f: 15 } } as const;

export const Button = React.forwardRef<React.ElementRef<typeof TouchableOpacity>, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, leftIcon, rightIcon, fullWidth, children, style, textStyle, disabled, ...props }, ref) => {
    const { t } = useTheme();
    const p = {
      primary: { bg: t.primary, bd: t.primary, fg: '#FFFFFF' },
      secondary: { bg: t.tint, bd: t.tint, fg: t.primary },
      outline: { bg: 'transparent', bd: t.line, fg: t.text },
      ghost: { bg: 'transparent', bd: 'transparent', fg: t.primary },
      danger: { bg: t.bad, bd: t.bad, fg: '#FFFFFF' },
    }[variant];
    const s = SIZE[size];
    const off = disabled || loading;
    return (
      <TouchableOpacity
        ref={ref}
        disabled={off}
        activeOpacity={0.85}
        accessibilityRole="button"
        style={[
          { minHeight: s.h, paddingHorizontal: s.px, borderRadius: 99, backgroundColor: p.bg, borderColor: p.bd, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
          fullWidth && { width: '100%' },
          off && { opacity: 0.5 },
          style,
        ]}
        {...props}
      >
        {loading ? <ActivityIndicator size="small" color={p.fg} /> : (
          <>
            {leftIcon ? <View>{leftIcon}</View> : null}
            <Text numberOfLines={1} style={[{ color: p.fg, fontSize: s.f, fontWeight: '700', textAlign: 'center' }, textStyle]}>{children}</Text>
            {rightIcon ? <View>{rightIcon}</View> : null}
          </>
        )}
      </TouchableOpacity>
    );
  },
);
Button.displayName = 'Button';
