
import React from 'react';
import {
  View,
  Text,
  StyleProp,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/src/theme/ThemeProvider';

interface ChipProps {
  children?: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  dismissible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  className?: string;
}

const SIZES = {
  xs: { px: 8, py: 3, font: 10 },
  sm: { px: 10, py: 5, font: 11 },
  md: { px: 12, py: 6, font: 12 },
  lg: { px: 15, py: 8, font: 14 },
};

export const Chip = ({
  children,
  variant = 'default',
  size = 'md',
  onPress,
  dismissible,
  onDismiss,
  icon,
  style,
  textStyle,
}: ChipProps) => {
  const { t } = useTheme();
  const colors = {
    default: { bg: t.field, text: t.sub, border: t.line },
    success: { bg: t.okBg, text: t.ok, border: t.okBg },
    warning: { bg: t.warnBg, text: t.warn, border: t.warnBg },
    danger: { bg: t.badBg, text: t.bad, border: t.badBg },
    info: { bg: t.infoBg, text: t.info, border: t.infoBg },
    primary: { bg: t.tint, text: t.primary, border: t.tint },
  }[variant];
  const dimensions = SIZES[size];

  const content = (
    <>
      {icon && <View style={{ marginRight: 4 }}>{icon}</View>}

      <Text
        style={[
          {
            color: colors.text,
            fontSize: dimensions.font,
            fontWeight: '700',
          },
          textStyle,
        ]}
      >
        {children}
      </Text>

      {dismissible && (
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove"
          style={{ marginLeft: 4 }}
        >
          <Text style={{ color: colors.text, fontSize: 17 }}>×</Text>
        </TouchableOpacity>
      )}
    </>
  );

  const containerStyle = [
    {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      alignSelf: 'flex-start' as const,
      borderRadius: 30,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      paddingHorizontal: dimensions.px,
      paddingVertical: dimensions.py,
    },
    style,
  ];

  return onPress ? (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      style={containerStyle}
    >
      {content}
    </TouchableOpacity>
  ) : (
    <View style={containerStyle}>{content}</View>
  );
};

export const StatusChip = ({
  status,
  ...props
}: ChipProps & { status: string }) => {
  const statusMap: Record<string, ChipProps['variant']> = {
    verified: 'success',
    pending: 'warning',
    not_qualified: 'danger',
    document_verified: 'info',
    issuer_confirmed: 'primary',
    platform_verified: 'success',
    suspended: 'warning',
    revoked: 'danger',
    rejected: 'danger',
    open: 'info',
    assigned: 'primary',
    in_progress: 'warning',
    completed: 'success',
    cancelled: 'default',
  };

  return (
    <Chip variant={statusMap[status] || 'default'} {...props}>
      {status.replace(/_/g, ' ')}
    </Chip>
  );
};

export const RiskChip = ({
  risk,
  ...props
}: ChipProps & { risk: string }) => {
  const riskMap: Record<string, ChipProps['variant']> = {
    low: 'success',
    medium: 'warning',
    high: 'danger',
    very_high: 'danger',
    critical: 'danger',
  };

  return (
    <Chip variant={riskMap[risk] || 'default'} {...props}>
      {risk.replace(/_/g, ' ')}
    </Chip>
  );
};

export const RoleChip = ({
  role,
  ...props
}: ChipProps & { role: string }) => {
  const roleMap: Record<string, ChipProps['variant']> = {
    technician: 'primary',
    facility_manager: 'success',
    contractor_manager: 'warning',
    admin: 'primary',
  };

  return (
    <Chip variant={roleMap[role] || 'default'} {...props}>
      {role.replace(/_/g, ' ')}
    </Chip>
  );
};
